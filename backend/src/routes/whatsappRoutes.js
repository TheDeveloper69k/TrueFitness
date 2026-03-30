// routes/whatsappRoutes.js

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const {
  sendToUser,
  sendBulk,               // ← NEW: send to selected multiple users
  broadcast,
  retryFailed,
  getAllNotifications,
  getMyNotifications,
  getStats,
  deleteNotification,
  triggerExpiryAlerts,    // ← NEW: manually trigger expiry alerts
} = require("../controllers/whatsappController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many WhatsApp send requests. Try again later." },
});

const broadcastLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many broadcast requests. Try again later." },
});

// ─── User Routes ──────────────────────────────────────────────────────────────
// GET /api/v1/whatsapp/me  →  my received WhatsApp notifications
router.get("/me", protect, getMyNotifications);

// ─── Admin Routes (specific paths BEFORE generic /:id) ────────────────────────
//
// GET    /api/v1/whatsapp/stats                    → sent/failed/pending counts + today
// GET    /api/v1/whatsapp                          → all notifications (paginated)
// POST   /api/v1/whatsapp/send                     → send to single user
// POST   /api/v1/whatsapp/send-bulk                → send to multiple selected users  ← NEW
// POST   /api/v1/whatsapp/broadcast                → send to ALL active users
// POST   /api/v1/whatsapp/trigger-expiry-alerts    → manually run expiry alert job    ← NEW
// POST   /api/v1/whatsapp/:id/retry                → retry a failed message
// DELETE /api/v1/whatsapp/:id                      → delete notification record

router.get("/stats", protect, adminOnly, getStats);
router.get("/", protect, adminOnly, getAllNotifications);
router.post("/send", protect, adminOnly, sendLimiter, sendToUser);
router.post("/send-bulk", protect, adminOnly, sendLimiter, sendBulk);
router.post("/broadcast", protect, adminOnly, broadcastLimiter, broadcast);
router.post("/trigger-expiry-alerts", protect, adminOnly, triggerExpiryAlerts);
router.post("/:id/retry", protect, adminOnly, sendLimiter, retryFailed);
router.delete("/:id", protect, adminOnly, deleteNotification);

module.exports = router;