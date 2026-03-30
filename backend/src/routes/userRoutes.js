const express = require("express");
const router = express.Router();

const { searchUserByPhone } = require("../controllers/userController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

router.get("/search", protect, adminOnly, searchUserByPhone);

module.exports = router;