const db = require("../config/database");
const {
  OrderValidationError,
  processCheckout: processCheckoutOrder,
  getAdminOrders: getAdminOrdersFromService,
  updateOrderPaymentByAdmin,
  normalizePaymentStatusFilter,
} = require("../services/orderService");

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function calculateCartTotal(cartItems) {
  return cartItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
}

function getAdminFlashMessage(flashCode) {
  switch (String(flashCode || "").toLowerCase()) {
    case "confirmed":
      return { type: "success", text: "Pembayaran berhasil dikonfirmasi." };
    case "rejected":
      return { type: "warning", text: "Pembayaran ditandai sebagai gagal." };
    case "invalid_order":
      return { type: "danger", text: "Order tidak valid atau tidak ditemukan." };
    case "already_processed":
      return { type: "info", text: "Order sudah diproses sebelumnya." };
    case "failed":
      return { type: "danger", text: "Gagal memproses pembayaran. Coba lagi." };
    default:
      return null;
  }
}

function resolveFilterFromRequest(req) {
  return normalizePaymentStatusFilter(req.body?.payment_status || req.query?.payment_status || "all");
}

exports.getOrders = async (req, res) => {
  res.redirect("/orders/cart");
};

exports.getCart = async (req, res) => {
  const userId = req.session.userId;

  try {
    const [cartItems] = await db.execute(
      `
      SELECT c.id, c.product_id, c.quantity, p.name, p.price, p.image
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.id DESC
      `,
      [userId],
    );

    const total = calculateCartTotal(cartItems);

    return res.render("cart", {
      cartItems,
      total,
    });
  } catch (error) {
    console.error("Cart error:", error);
    return res.status(500).send("Error memuat keranjang");
  }
};

exports.addToCart = async (req, res) => {
  const userId = req.session.userId;
  const productId = parsePositiveInteger(req.body.product_id);
  const quantity = parsePositiveInteger(req.body.quantity);

  if (!userId) {
    return res.redirect("/login");
  }

  if (!productId || !quantity) {
    return res.status(400).send("Produk atau quantity tidak valid.");
  }

  try {
    const [products] = await db.execute("SELECT id FROM products WHERE id = ?", [productId]);
    if (products.length === 0) {
      return res.status(404).send("Produk tidak ditemukan.");
    }

    await db.execute(
      `
      INSERT INTO cart (user_id, product_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = quantity + ?
      `,
      [userId, productId, quantity, quantity],
    );

    return res.redirect("/orders/cart");
  } catch (error) {
    console.error("Add to cart error:", error);
    return res.status(500).send("Gagal menambahkan ke keranjang");
  }
};

exports.getCheckout = async (req, res) => {
  const userId = req.session.userId;

  try {
    const [cartItems] = await db.execute(
      `
      SELECT c.id, c.product_id, c.quantity, p.name, p.price, p.image
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.id DESC
      `,
      [userId],
    );

    if (cartItems.length === 0) {
      return res.redirect("/orders/cart");
    }

    const total = calculateCartTotal(cartItems);

    return res.render("checkout", {
      cartItems,
      subtotal: total,
      total,
    });
  } catch (error) {
    console.error("Checkout page error:", error);
    return res.status(500).send("Error memuat halaman checkout");
  }
};

exports.updateCartItem = async (req, res) => {
  const userId = req.session.userId;
  const cartId = parsePositiveInteger(req.params.cartId);
  const quantity = parsePositiveInteger(req.body.quantity);

  if (!cartId) {
    return res.status(400).json({ message: "cartId tidak valid" });
  }

  if (!quantity) {
    return res.status(400).json({ message: "quantity minimal 1" });
  }

  try {
    const [result] = await db.execute(
      `
      UPDATE cart
      SET quantity = ?
      WHERE id = ? AND user_id = ?
      `,
      [quantity, cartId, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item keranjang tidak ditemukan" });
    }

    return res.json({ message: "Jumlah item diperbarui" });
  } catch (error) {
    console.error("Update cart error:", error);
    return res.status(500).json({ message: "Gagal memperbarui keranjang" });
  }
};

exports.removeCartItem = async (req, res) => {
  const userId = req.session.userId;
  const cartId = parsePositiveInteger(req.params.cartId);

  if (!cartId) {
    return res.status(400).json({ message: "cartId tidak valid" });
  }

  try {
    const [result] = await db.execute("DELETE FROM cart WHERE id = ? AND user_id = ?", [
      cartId,
      userId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item keranjang tidak ditemukan" });
    }

    return res.json({ message: "Item berhasil dihapus" });
  } catch (error) {
    console.error("Remove cart error:", error);
    return res.status(500).json({ message: "Gagal menghapus item keranjang" });
  }
};

exports.processCheckout = async (req, res) => {
  try {
    const result = await processCheckoutOrder({
      userId: req.session.userId,
      input: req.body,
    });

    return res.render("order-success", {
      orderId: result.orderId,
      total_price: result.totalPrice,
      payment_method: result.paymentMethod,
      payment_status: result.paymentStatus,
      payment_metadata: result.paymentMetadata,
    });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      if (error.statusCode === 401) {
        return res.redirect("/login");
      }
      return res.status(error.statusCode || 400).send(error.message);
    }

    console.error("Checkout error:", error);
    return res.status(500).send("Checkout gagal karena kesalahan server.");
  }
};

exports.getAdminOrders = async (req, res) => {
  try {
    const filter = normalizePaymentStatusFilter(req.query.payment_status || "all");
    const { orders, activePaymentStatus } = await getAdminOrdersFromService({
      paymentStatus: filter,
    });

    return res.render("admin-orders", {
      orders,
      activePaymentStatus,
      flashMessage: getAdminFlashMessage(req.query.flash),
    });
  } catch (error) {
    console.error("Admin orders error:", error);
    return res.status(500).send("Gagal memuat data pembayaran admin.");
  }
};

async function handleAdminPaymentAction(req, res, action) {
  const orderId = parsePositiveInteger(req.params.orderId);
  const paymentStatusFilter = resolveFilterFromRequest(req);
  const redirectBase = `/orders/admin?payment_status=${encodeURIComponent(paymentStatusFilter)}`;

  if (!orderId) {
    return res.redirect(`${redirectBase}&flash=invalid_order`);
  }

  try {
    await updateOrderPaymentByAdmin({
      orderId,
      adminUserId: req.session.userId,
      action,
    });

    const flashCode = action === "confirm" ? "confirmed" : "rejected";
    return res.redirect(`${redirectBase}&flash=${flashCode}`);
  } catch (error) {
    if (error instanceof OrderValidationError) {
      if (error.statusCode === 404) {
        return res.redirect(`${redirectBase}&flash=invalid_order`);
      }
      if (error.statusCode === 409) {
        return res.redirect(`${redirectBase}&flash=already_processed`);
      }
      return res.redirect(`${redirectBase}&flash=failed`);
    }

    console.error("Admin payment action error:", error);
    return res.redirect(`${redirectBase}&flash=failed`);
  }
}

exports.confirmPayment = async (req, res) => handleAdminPaymentAction(req, res, "confirm");
exports.rejectPayment = async (req, res) => handleAdminPaymentAction(req, res, "reject");

exports.checkout = exports.processCheckout;
