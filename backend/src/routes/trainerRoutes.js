const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const {
  getAllTrainers,
  getTrainer,
  createTrainer,
  updateTrainer,
  toggleTrainerStatus,
  deleteTrainer,
  getTrainerStats,
  assignTrainerToMember,
  getMemberTrainer,
  removeTrainerFromMember,
  getTrainerMembers,
} = require("../controllers/trainerController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: "Too many requests. Try again later." },
});

router.get("/admin/stats/summary", protect, adminOnly, getTrainerStats);
router.get("/member/:memberId", protect, adminOnly, getMemberTrainer);
router.delete("/member/:memberId/remove", protect, adminOnly, writeLimiter, removeTrainerFromMember);
router.post("/assign-member", protect, adminOnly, writeLimiter, assignTrainerToMember);
router.get("/:trainerId/members", protect, adminOnly, getTrainerMembers);

router.get("/", getAllTrainers);
router.get("/:id", getTrainer);

router.post("/", protect, adminOnly, writeLimiter, createTrainer);
router.put("/:id", protect, adminOnly, writeLimiter, updateTrainer);
router.patch("/:id/toggle-status", protect, adminOnly, writeLimiter, toggleTrainerStatus);
router.delete("/:id", protect, adminOnly, writeLimiter, deleteTrainer);

module.exports = router;