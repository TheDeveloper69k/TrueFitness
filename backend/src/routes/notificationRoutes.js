// routes/notificationRoutes.js

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification,
  getAllNotifications,
  updateNotification,
  deleteNotification,
  getNotificationStats,
} = require("../controllers/notificationController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: "Too many requests. Try again later." },
});

// ─── User Routes ──────────────────────────────────────────────────────────────
// GET   /api/v1/notifications/me              → my notifications (?unread_only=true&page=1)
// GET   /api/v1/notifications/me/unread-count → unread badge count
// PATCH /api/v1/notifications/me/read-all     → mark all as read
// PATCH /api/v1/notifications/:id/read        → mark one as read

router.get("/me", protect, getMyNotifications);
router.get("/me/unread-count", protect, getUnreadCount);
router.patch("/me/read-all", protect, markAllAsRead);
router.patch("/:id/read", protect, markAsRead);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
// GET    /api/v1/notifications                → all notifications (?target_type=all&type=info&page=1)
// POST   /api/v1/notifications                → create notification
// PUT    /api/v1/notifications/:id            → update notification
// DELETE /api/v1/notifications/:id            → delete notification
// GET    /api/v1/notifications/:id/stats      → read count stats

router.get("/", protect, adminOnly, getAllNotifications);
router.post("/", protect, adminOnly, createLimiter, createNotification);
router.put("/:id", protect, adminOnly, updateNotification);
router.delete("/:id", protect, adminOnly, deleteNotification);
router.get("/:id/stats", protect, adminOnly, getNotificationStats);

module.exports = router;