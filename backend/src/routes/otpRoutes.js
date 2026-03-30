// src/routes/otpRoutes.js
const express = require("express");
const router = express.Router();
const { sendOTP, verifyOTP, resendOTP } = require("../controllers/otpController");
const { validateOTPRequest, validateOTPVerify } = require("../middlewares/otpMiddleware");

// POST /api/v1/otp/send
router.post("/send", validateOTPRequest, sendOTP);

// POST /api/v1/otp/verify
router.post("/verify", validateOTPVerify, verifyOTP);

// POST /api/v1/otp/resend
router.post("/resend", validateOTPRequest, resendOTP);

module.exports = router;