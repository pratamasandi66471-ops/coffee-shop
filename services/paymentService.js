const { getPaymentMethodConfig } = require("../config/paymentMethods");

const ALLOWED_PAYMENT_STATUSES = new Set(["pending", "paid", "failed"]);
const ALLOWED_ORDER_STATUSES = new Set(["pending", "paid", "completed"]);

function logPaymentEvent({ stage, userId, paymentMethod, paymentStatus, orderId, note }) {
  const payload = {
    stage,
    userId,
    orderId: orderId || null,
    paymentMethod,
    paymentStatus: paymentStatus || null,
    timestamp: new Date().toISOString(),
  };

  if (note) {
    payload.note = note;
  }

  console.info("[payment-flow]", JSON.stringify(payload));
}

function ensureStatusValue(value, allowedSet, fallback) {
  if (!value) return fallback;
  const normalized = String(value).toLowerCase();
  return allowedSet.has(normalized) ? normalized : fallback;
}

async function handleCash(context) {
  return {
    paymentStatus: "paid",
    orderStatus: "paid",
    metadata: {
      channel: "cash",
      message: "Pembayaran cash ditandai langsung sebagai paid.",
      totalPrice: context.totalPrice,
    },
  };
}

async function handleQRIS(context) {
  return {
    paymentStatus: "pending",
    orderStatus: "pending",
    metadata: {
      channel: "qris",
      message: "Menunggu konfirmasi pembayaran QRIS.",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      totalPrice: context.totalPrice,
    },
  };
}

async function handleDANA(context) {
  return {
    paymentStatus: "pending",
    orderStatus: "pending",
    metadata: {
      channel: "dana",
      message: "Menunggu konfirmasi pembayaran DANA.",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      totalPrice: context.totalPrice,
    },
  };
}

const paymentHandlers = Object.freeze({
  cash: handleCash,
  qris: handleQRIS,
  dana: handleDANA,
});

async function runPaymentHandler({ userId, orderId, paymentMethod, totalPrice }) {
  const config = getPaymentMethodConfig(paymentMethod);
  if (!config) {
    const error = new Error("Metode pembayaran tidak valid.");
    error.statusCode = 400;
    throw error;
  }

  const handler = paymentHandlers[paymentMethod];
  if (!handler) {
    const error = new Error("Handler pembayaran belum tersedia.");
    error.statusCode = 500;
    throw error;
  }

  logPaymentEvent({
    stage: "handler_start",
    userId,
    orderId,
    paymentMethod,
    paymentStatus: config.initialPaymentStatus,
  });

  const result = await handler({
    userId,
    orderId,
    paymentMethod,
    totalPrice,
    config,
  });

  const paymentStatus = ensureStatusValue(
    result?.paymentStatus,
    ALLOWED_PAYMENT_STATUSES,
    config.initialPaymentStatus,
  );

  const orderStatus = ensureStatusValue(
    result?.orderStatus,
    ALLOWED_ORDER_STATUSES,
    paymentStatus === "paid" ? "paid" : "pending",
  );

  logPaymentEvent({
    stage: "handler_done",
    userId,
    orderId,
    paymentMethod,
    paymentStatus,
    note: result?.metadata?.message,
  });

  return {
    paymentStatus,
    orderStatus,
    paymentMethodDbValue: config.dbValue,
    paymentMethodLabel: config.label,
    metadata: result?.metadata || null,
  };
}

module.exports = {
  paymentHandlers,
  runPaymentHandler,
};

