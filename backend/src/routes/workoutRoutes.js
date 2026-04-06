// ── TRUE FITNESS — WORKOUT ROUTES ──

const express = require("express");
const router = express.Router();

const workoutController = require("../controllers/workoutController");

// ➕ ADD / UPDATE WORKOUT (upsert by user_id + day)
router.post("/", workoutController.addWorkout);

// 📥 GET ALL WORKOUTS (admin view)
router.get("/", workoutController.getAllWorkouts);

// 📥 GET USER WORKOUT by userId
router.get("/:userId", workoutController.getUserWorkout);

// ❌ DELETE single workout entry by id
router.delete("/:id", workoutController.deleteWorkout);

module.exports = router;