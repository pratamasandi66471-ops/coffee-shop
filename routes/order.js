const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const isAuth = require("../middleware/auth");
const isAdmin = require("../middleware/admin");

// Cart endpoints
router.get("/cart", isAuth, orderController.getCart);
router.post("/cart/add", isAuth, orderController.addToCart);
router.patch("/cart/update/:cartId", isAuth, orderController.updateCartItem);
router.delete("/cart/remove/:cartId", isAuth, orderController.removeCartItem);
router.get("/checkout", isAuth, orderController.getCheckout);
router.get("/admin", isAuth, isAdmin, orderController.getAdminOrders);
router.post("/admin/:orderId/confirm", isAuth, isAdmin, orderController.confirmPayment);
router.post("/admin/:orderId/reject", isAuth, isAdmin, orderController.rejectPayment);

// Orders
router.get("/", isAuth, orderController.getOrders); 
router.post("/checkout", isAuth, orderController.processCheckout);

module.exports = router;
