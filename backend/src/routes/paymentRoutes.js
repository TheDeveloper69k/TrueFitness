// routes/paymentRoutes.js

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const {
  createOrder,
  verifyPayment,
  getMyPayments,
  getAllPayments,
  getPayment,
  refundPayment,
  getPaymentStats,
} = require("../controllers/paymentController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many payment requests. Try again later." },
});

const refundLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many refund requests. Try again later." },
});

// ─── User Routes ──────────────────────────────────────────────────────────────
// POST /api/v1/payments/create-order → create Razorpay order (step 1)
// POST /api/v1/payments/verify       → verify payment after checkout (step 2)
// GET  /api/v1/payments/me           → user's payment history
router.post("/create-order", protect, orderLimiter, createOrder);
router.post("/verify", protect, verifyPayment);
router.get("/me", protect, getMyPayments);

// ─── Admin Routes (specific before generic) ───────────────────────────────────
// GET  /api/v1/payments/stats        → revenue & count stats  ✅ before "/"
// GET  /api/v1/payments              → all payments
// GET  /api/v1/payments/:id          → single payment detail
// POST /api/v1/payments/:id/refund   → initiate refund
router.get("/stats", protect, adminOnly, getPaymentStats);      // ✅ moved above "/"
router.get("/", protect, adminOnly, getAllPayments);
router.get("/:id", protect, adminOnly, getPayment);
router.post("/:id/refund", protect, adminOnly, refundLimiter, refundPayment);

module.exports = router;