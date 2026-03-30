// routes/gymRoutes.js

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const {
  getAllGyms,
  getGym,
  createGym,
  updateGym,
  toggleGymStatus,
  deleteGym,
  getGymStats,
} = require("../controllers/gymController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

const gymWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: "Too many requests. Try again later." },
});

// ─── Specific Routes FIRST ────────────────────────────────────────────────────
// IMPORTANT: put this before "/:idOrSlug"
router.get("/:id/stats", protect, adminOnly, getGymStats);

// ─── Public Routes ────────────────────────────────────────────────────────────
// GET /api/v1/gyms            → list all gyms (optional ?active=true)
// GET /api/v1/gyms/:idOrSlug  → get single gym by ID or slug
router.get("/", getAllGyms);
router.get("/:idOrSlug", getGym);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
// POST   /api/v1/gyms                   → create gym
// PUT    /api/v1/gyms/:id               → update gym
// PATCH  /api/v1/gyms/:id/toggle-status → activate / deactivate
// DELETE /api/v1/gyms/:id               → delete gym
router.post("/", protect, adminOnly, gymWriteLimiter, createGym);
router.put("/:id", protect, adminOnly, gymWriteLimiter, updateGym);
router.patch("/:id/toggle-status", protect, adminOnly, toggleGymStatus);
router.delete("/:id", protect, adminOnly, deleteGym);

module.exports = router;