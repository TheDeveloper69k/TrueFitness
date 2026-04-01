const express = require("express");
const router = express.Router();

const {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan
} = require("../controllers/membershipPlanController");

// GET all plans
router.get("/", getPlans);

// CREATE plan
router.post("/", createPlan);

// UPDATE plan
router.put("/:id", updatePlan);

// DELETE plan
router.delete("/:id", deletePlan);

module.exports = router;