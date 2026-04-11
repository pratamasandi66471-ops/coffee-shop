const db = require("../config/database");
const { getPaymentMethodConfig } = require("../config/paymentMethods");
const { runPaymentHandler } = require("./paymentService");

const ALLOWED_DELIVERY_TYPES = new Set(["delivery", "dinein"]);
const ALLOWED_PAYMENT_STATUS_FILTERS = new Set(["pending", "paid", "failed"]);
const ADMIN_PAYMENT_ACTIONS = Object.freeze({
  confirm: Object.freeze({
    paymentStatus: "paid",
    orderStatus: "paid",
    label: "confirm",
  }),
  reject: Object.freeze({
    paymentStatus: "failed",
    orderStatus: "pending",
    label: "reject",
  }),
});

class OrderValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "OrderValidationError";
    this.statusCode = statusCode;
  }
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizePaymentStatusFilter(rawValue) {
  const value = String(rawValue || "").toLowerCase().trim();
  if (!value || value === "all") {
    return "all";
  }

  return ALLOWED_PAYMENT_STATUS_FILTERS.has(value) ? value : "all";
}

function toCents(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.round(numeric * 100);
}

function fromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

function normalizeCheckoutInput(rawInput) {
  const deliveryType = String(rawInput.delivery_type || "delivery").toLowerCase().trim();
  const paymentMethod = String(rawInput.payment_method || "").toLowerCase().trim();
  const address = String(rawInput.address || "").trim();
  const tableNumber = parsePositiveInteger(rawInput.table);

  return {
    deliveryType,
    paymentMethod,
    address,
    tableNumber,
  };
}

function validateCheckoutInput({ userId, input }) {
  if (!userId) {
    throw new OrderValidationError("User belum login.", 401);
  }

  if (!ALLOWED_DELIVERY_TYPES.has(input.deliveryType)) {
    throw new OrderValidationError("Tipe pengiriman tidak valid.");
  }

  const paymentConfig = getPaymentMethodConfig(input.paymentMethod);
  if (!paymentConfig) {
    throw new OrderValidationError("Metode pembayaran tidak valid.");
  }

  if (input.deliveryType === "delivery" && !input.address) {
    throw new OrderValidationError("Alamat pengiriman wajib diisi.");
  }

  if (input.deliveryType === "dinein" && !input.tableNumber) {
    throw new OrderValidationError("Nomor meja wajib diisi.");
  }

  return paymentConfig;
}

async function getValidatedCart(connection, userId) {
  const [cartItems] = await connection.execute(
    `
    SELECT c.id, c.product_id, c.quantity, p.name, p.price
    FROM cart c
    JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.id ASC
    `,
    [userId],
  );

  if (!cartItems.length) {
    throw new OrderValidationError("Keranjang kosong.");
  }

  let totalCents = 0;
  const normalizedItems = cartItems.map((item) => {
    const quantity = parsePositiveInteger(item.quantity);
    const priceCents = toCents(item.price);

    if (!quantity || !priceCents || priceCents <= 0) {
      throw new OrderValidationError(
        `Data item keranjang tidak valid untuk produk: ${item.name || item.product_id}.`,
      );
    }

    totalCents += priceCents * quantity;

    return {
      productId: item.product_id,
      quantity,
      unitPrice: fromCents(priceCents),
    };
  });

  if (totalCents <= 0) {
    throw new OrderValidationError("Total pembayaran tidak valid.");
  }

  return {
    items: normalizedItems,
    totalPrice: fromCents(totalCents),
  };
}

async function createOrder({
  connection,
  userId,
  totalPrice,
  deliveryType,
  address,
  tableNumber,
  paymentMethodDbValue,
  paymentStatus,
  orderStatus,
}) {
  const safeAddress = deliveryType === "delivery" ? address : "";
  const safeTableNumber = deliveryType === "dinein" ? tableNumber : null;

  const [result] = await connection.execute(
    `
    INSERT INTO orders (
      user_id,
      total_price,
      status,
      address,
      table_number,
      payment_method,
      payment_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [userId, totalPrice, orderStatus, safeAddress, safeTableNumber, paymentMethodDbValue, paymentStatus],
  );

  return result.insertId;
}

async function createOrderItems(connection, orderId, items) {
  for (const item of items) {
    await connection.execute(
      `
      INSERT INTO order_items (order_id, product_id, quantity, price)
      VALUES (?, ?, ?, ?)
      `,
      [orderId, item.productId, item.quantity, item.unitPrice],
    );
  }
}

async function updateOrderPaymentState(connection, orderId, paymentStatus, orderStatus) {
  await connection.execute(
    `
    UPDATE orders
    SET payment_status = ?, status = ?
    WHERE id = ?
    `,
    [paymentStatus, orderStatus, orderId],
  );
}

async function clearUserCart(connection, userId) {
  await connection.execute("DELETE FROM cart WHERE user_id = ?", [userId]);
}

async function getAdminOrders({ paymentStatus = "all", limit = 100 } = {}) {
  const normalizedFilter = normalizePaymentStatusFilter(paymentStatus);
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 250) : 100;

  const whereClause = normalizedFilter === "all" ? "" : "WHERE o.payment_status = ?";
  const params = normalizedFilter === "all" ? [safeLimit] : [normalizedFilter, safeLimit];

  const [orders] = await db.execute(
    `
    SELECT
      o.id,
      o.user_id,
      u.name AS user_name,
      u.email AS user_email,
      o.total_price,
      o.status,
      o.payment_method,
      o.payment_status,
      o.address,
      o.table_number,
      o.created_at
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    ${whereClause}
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT ?
    `,
    params,
  );

  return {
    orders,
    activePaymentStatus: normalizedFilter,
  };
}

async function updateOrderPaymentByAdmin({ orderId, adminUserId, action }) {
  const parsedOrderId = parsePositiveInteger(orderId);
  if (!parsedOrderId) {
    throw new OrderValidationError("Order ID tidak valid.");
  }

  const actionConfig = ADMIN_PAYMENT_ACTIONS[action];
  if (!actionConfig) {
    throw new OrderValidationError("Aksi admin tidak valid.");
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.execute(
      `
      SELECT id, payment_status, status, payment_method
      FROM orders
      WHERE id = ?
      FOR UPDATE
      `,
      [parsedOrderId],
    );

    if (!orders.length) {
      throw new OrderValidationError("Order tidak ditemukan.", 404);
    }

    const currentOrder = orders[0];
    if (String(currentOrder.payment_status).toLowerCase() !== "pending") {
      throw new OrderValidationError("Hanya order dengan status pending yang bisa diproses.", 409);
    }

    await connection.execute(
      `
      UPDATE orders
      SET payment_status = ?, status = ?
      WHERE id = ?
      `,
      [actionConfig.paymentStatus, actionConfig.orderStatus, parsedOrderId],
    );

    await connection.commit();

    console.info(
      "[admin-payment-action]",
      JSON.stringify({
        adminUserId,
        orderId: parsedOrderId,
        action: actionConfig.label,
        paymentMethod: currentOrder.payment_method,
        paymentStatus: actionConfig.paymentStatus,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      orderId: parsedOrderId,
      paymentStatus: actionConfig.paymentStatus,
      orderStatus: actionConfig.orderStatus,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function processCheckout({ userId, input: rawInput }) {
  const input = normalizeCheckoutInput(rawInput);
  const paymentConfig = validateCheckoutInput({ userId, input });

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { items, totalPrice } = await getValidatedCart(connection, userId);
    const initialPaymentStatus = paymentConfig.initialPaymentStatus;
    const initialOrderStatus = initialPaymentStatus === "paid" ? "paid" : "pending";

    const orderId = await createOrder({
      connection,
      userId,
      totalPrice,
      deliveryType: input.deliveryType,
      address: input.address,
      tableNumber: input.tableNumber,
      paymentMethodDbValue: paymentConfig.dbValue,
      paymentStatus: initialPaymentStatus,
      orderStatus: initialOrderStatus,
    });

    await createOrderItems(connection, orderId, items);

    const paymentResult = await runPaymentHandler({
      userId,
      orderId,
      paymentMethod: paymentConfig.code,
      totalPrice,
    });

    if (
      paymentResult.paymentStatus !== initialPaymentStatus ||
      paymentResult.orderStatus !== initialOrderStatus
    ) {
      await updateOrderPaymentState(
        connection,
        orderId,
        paymentResult.paymentStatus,
        paymentResult.orderStatus,
      );
    }

    await clearUserCart(connection, userId);
    await connection.commit();

    console.info(
      "[order-flow]",
      JSON.stringify({
        userId,
        orderId,
        paymentMethod: paymentConfig.code,
        paymentStatus: paymentResult.paymentStatus,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      orderId,
      totalPrice,
      paymentMethod: paymentResult.paymentMethodLabel,
      paymentStatus: paymentResult.paymentStatus,
      paymentMetadata: paymentResult.metadata,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  OrderValidationError,
  processCheckout,
  getAdminOrders,
  updateOrderPaymentByAdmin,
  normalizePaymentStatusFilter,
};
