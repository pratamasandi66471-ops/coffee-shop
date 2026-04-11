const express = require("express");
const multer = require("multer");
const router = express.Router();
const productController = require("../controllers/productController");
const isAuth = require("../middleware/auth");
const isAdmin = require("../middleware/admin");
const upload = require("../middleware/upload");
const csrfMiddleware = require("../middleware/csrf");

function multerErrorHandler(err, req, res, next) {
  if (!err) {
    return next();
  }

  console.error("Multer upload error:", err);
  const message = err instanceof multer.MulterError
    ? err.message
    : err.message || "Upload file gagal.";

  const wantsJson =
    Boolean(req.headers["x-csrf-token"]) ||
    req.headers.accept?.includes("application/json");

  const formData = {
    name: String(req.body?.name || "").trim(),
    description: String(req.body?.description || "").trim(),
    price: String(req.body?.price || ""),
    image: "",
  };

  if (wantsJson) {
    return res.status(400).json({ success: false, message });
  }

  return res.status(400).render("admin-product-create", {
    formData,
    errorMessage: message,
    successMessage: null,
  });
}

router.get("/", productController.getAllProducts);
router.get("/admin/new", isAuth, isAdmin, productController.getCreateProductPage);
router.post(
  "/admin/new",
  isAuth,
  isAdmin,
  upload.single("image"),
  multerErrorHandler,
  csrfMiddleware.protect,
  productController.createProduct,
);
router.get("/:id", productController.getProductById);

module.exports = router;
