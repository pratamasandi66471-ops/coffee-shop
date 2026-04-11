const PAYMENT_METHODS = Object.freeze({
  cash: Object.freeze({
    code: "cash",
    label: "Cash",
    dbValue: "Cash",
    type: "offline",
    initialPaymentStatus: "paid",
  }),
  qris: Object.freeze({
    code: "qris",
    label: "QRIS",
    dbValue: "QRIS",
    type: "online",
    initialPaymentStatus: "pending",
  }),
  dana: Object.freeze({
    code: "dana",
    label: "DANA",
    dbValue: "DANA",
    type: "online",
    initialPaymentStatus: "pending",
  }),
});

function getPaymentMethodConfig(rawCode) {
  const code = String(rawCode || "").toLowerCase().trim();
  return PAYMENT_METHODS[code] || null;
}

module.exports = {
  PAYMENT_METHODS,
  getPaymentMethodConfig,
};

