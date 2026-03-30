const express = require("express");
const router = express.Router();
const { getReceipts, getReceiptById, getReceiptStats } = require("../controllers/receiptController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

// All receipts routes — admin only
router.get("/stats", protect, adminOnly, getReceiptStats);
router.get("/", protect, adminOnly, getReceipts);
router.get("/:id", protect, adminOnly, getReceiptById);

module.exports = router;