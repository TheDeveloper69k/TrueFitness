// ── TRUE FITNESS — DIET ROUTES ──

const express = require("express");
const router = express.Router();

const dietController = require("../controllers/dietController");

// ➕ ADD FULL DAY DIET PLAN
router.post("/", dietController.addDietPlan);

// 📥 GET ALL DIET PLANS
router.get("/", dietController.getAllDietPlans);

// 📥 GET USER DIET PLANS
router.get("/:userId", dietController.getUserDietPlans);

// ✏️ UPDATE DIET PLAN
router.put("/:id", dietController.updateDietPlan);

// ❌ DELETE DIET PLAN
router.delete("/:id", dietController.deleteDietPlan);

module.exports = router;