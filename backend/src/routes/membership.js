const express = require("express");
const router = express.Router();

const { buyMembership, getMembership } = require("../controllers/membershipController");
const auth = require("../middleware/auth");

// BUY PLAN
router.post("/buy", auth, buyMembership);

// GET USER MEMBERSHIP
router.get("/me", auth, getMembership);
router.get("/", getPlans);        // get all plans
router.post("/", createPlan);     // admin add
router.put("/:id", updatePlan);   // admin edit
router.delete("/:id", deletePlan);

module.exports = router;