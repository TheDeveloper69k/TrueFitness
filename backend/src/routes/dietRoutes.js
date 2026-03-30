// ── TRUE FITNESS — DIET ROUTES ──

const express = require("express");
const router = express.Router();

const dietController = require("../controllers/dietController");

// ➕ ADD DIET
router.post("/", dietController.addDiet);
// 📥 GET ALL DIETS
router.get("/", dietController.getAllDiet);
// 📥 GET USER DIET
router.get("/:userId", dietController.getUserDiet);

// ❌ DELETE DIET
router.delete("/:id", dietController.deleteDiet);

module.exports = router;