// src/middlewares/otpMiddleware.js

const VALID_TYPES = ["register", "forgot_password"];

const isValidPhone = (phone) => /^\+?[0-9]{10,15}$/.test(phone);
const isValidOTP = (otp) => /^\d{6}$/.test(otp);

// ─── Validate Send / Resend ───────────────────────────────────────────────────

const validateOTPRequest = (req, res, next) => {
    const { phone, type } = req.body;

    if (!phone || typeof phone !== "string") {
        return res.status(400).json({
            success: false,
            message: "phone is required and must be a string.",
        });
    }

    if (!isValidPhone(phone.trim())) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number format. Use 10-digit number or E.164 format (+91XXXXXXXXXX).",
        });
    }

    if (!type || !VALID_TYPES.includes(type)) {
        return res.status(400).json({
            success: false,
            message: `type is required and must be one of: ${VALID_TYPES.join(", ")}.`,
        });
    }

    // Sanitise
    req.body.phone = phone.trim();
    req.body.type = type.trim();

    next();
};

// ─── Validate Verify ──────────────────────────────────────────────────────────

const validateOTPVerify = (req, res, next) => {
    const { phone, otp, type } = req.body;

    if (!phone || typeof phone !== "string") {
        return res.status(400).json({
            success: false,
            message: "phone is required and must be a string.",
        });
    }

    if (!isValidPhone(phone.trim())) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number format. Use 10-digit number or E.164 format (+91XXXXXXXXXX).",
        });
    }

    if (!otp || !isValidOTP(String(otp).trim())) {
        return res.status(400).json({
            success: false,
            message: "otp must be a 6-digit number.",
        });
    }

    if (!type || !VALID_TYPES.includes(type)) {
        return res.status(400).json({
            success: false,
            message: `type is required and must be one of: ${VALID_TYPES.join(", ")}.`,
        });
    }

    // Sanitise
    req.body.phone = phone.trim();
    req.body.otp = String(otp).trim();
    req.body.type = type.trim();

    next();
};

module.exports = { validateOTPRequest, validateOTPVerify };