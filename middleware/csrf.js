const crypto = require("crypto");

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function ensureToken(req) {
  if (!req.session) return "";

  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken();
  }

  return req.session.csrfToken;
}

function safeEqual(a, b) {
  if (!a || !b) return false;

  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;

  return crypto.timingSafeEqual(aBuf, bBuf);
}

function getRequestToken(req) {
  return (
    req.body?._csrf ||
    req.headers["x-csrf-token"] ||
    req.headers["csrf-token"] ||
    ""
  );
}

function attachToken(req, res, next) {
  res.locals.csrfToken = ensureToken(req);
  next();
}

function protect(req, res, next) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const sessionToken = ensureToken(req);
  const requestToken = getRequestToken(req);
  
  console.log("SESSION TOKEN:", sessionToken ? '[present]' : 'missing');
  console.log("REQUEST TOKEN:", requestToken ? '[present]' : 'missing');
  console.log("HEADERS x-csrf-token:", req.headers['x-csrf-token']);
  console.log("BODY _csrf:", req.body?._csrf);
  console.log("BODY:", req.body);

  if (!safeEqual(sessionToken, requestToken)) {
    const acceptsJson =
      req.originalUrl.startsWith("/orders/cart/") ||
      req.headers.accept?.includes("application/json");

    if (acceptsJson) {
      return res.status(403).json({ message: "CSRF token tidak valid." });
    }

    return res.status(403).send("CSRF token tidak valid.");
  }

  return next();
}

module.exports = {
  attachToken,
  protect,
};
