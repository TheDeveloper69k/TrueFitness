// routes/authRoutes.js

const express = require("express");
const router = express.Router();
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getMe,
  verifyRegisterOTP,
  sendForgotPasswordOTP,
  resetPassword,
} = require("../controllers/authController");

const { sendOTP } = require("../controllers/otpController");
const { protect } = require("../middlewares/authMiddleware");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts. Try again after 15 minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many registration attempts. Try again after 1 hour." },
});

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.phone || ipKeyGenerator(req), // ← fixed IPv6
  message: { success: false, message: "Too many OTP requests. Try again after 15 minutes." },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body?.phone || ipKeyGenerator(req), // ← fixed IPv6
  message: { success: false, message: "Too many verification attempts. Try again after 15 minutes." },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many token refresh attempts. Try again later." },
});

// Public Routes
router.post("/register", registerLimiter, registerUser);
router.post("/login", loginLimiter, loginUser);
router.post("/refresh", refreshLimiter, refreshToken);

// OTP Routes
router.post("/otp/send-register", otpSendLimiter, sendOTP);
router.post("/otp/verify-register", otpVerifyLimiter, verifyRegisterOTP);
router.post("/otp/forgot-password", otpSendLimiter, sendForgotPasswordOTP);
router.post("/otp/reset-password", otpVerifyLimiter, resetPassword);

// Protected Routes
router.get("/me", protect, getMe);
router.post("/logout", protect, logoutUser);

module.exports = router;