// src/controllers/otpController.js
const twilio = require("twilio");
const supabase = require("../config/supabaseClient");

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateOTP = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

const getExpiresAt = () =>
    new Date(Date.now() + 10 * 60 * 1000).toISOString();

// Normalise to E.164 — assumes +91 (India) if no country code
const normalisePhone = (phone = "") => {
    const cleaned = String(phone).trim().replace(/\s+/g, "");
    if (!cleaned) return "";
    return cleaned.startsWith("+") ? cleaned : `+91${cleaned}`;
};

// For DB storage keep plain 10-digit phone when possible
const normalisePhoneForDb = (phone = "") => {
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
        return digits.slice(2);
    }
    return digits;
};

// ─── Send OTP ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/otp/send
 * Body: { phone, type }   type ∈ ['register', 'forgot_password']
 *
 * Also supports:
 * POST /api/v1/auth/otp/send-register
 * Body: { phone, name, password }
 * In that case type defaults to "register".
 */
const sendOTP = async (req, res) => {
    try {
        let { phone, type } = req.body;

        phone = normalisePhoneForDb(phone);

        // Default type for frontend register route
        if (!type) {
            type = "register";
        }

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required.",
            });
        }

        if (!["register", "forgot_password"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP type.",
            });
        }

        // ── Check if phone exists in users table ─────────────────────────────
        const { data: existingUser, error: userCheckError } = await supabase
            .from("users")
            .select("id")
            .eq("phone", phone)
            .maybeSingle();

        if (userCheckError) {
            console.error("[OTP] User check error:", userCheckError);
            return res.status(500).json({
                success: false,
                message: "Failed to process request.",
            });
        }

        if (type === "register" && existingUser) {
            return res.status(409).json({
                success: false,
                message: "Phone number is already registered.",
            });
        }

        if (type === "forgot_password" && !existingUser) {
            return res.status(404).json({
                success: false,
                message: "No account found with this phone number.",
            });
        }

        // ── Rate limit: max 3 active OTPs per phone+type ─────────────────────
        const { count, error: countError } = await supabase
            .from("otps")
            .select("id", { count: "exact", head: true })
            .eq("phone", phone)
            .eq("type", type)
            .eq("is_used", false)
            .gt("expires_at", new Date().toISOString());

        if (countError) {
            console.error("[OTP] Count error:", countError);
            return res.status(500).json({
                success: false,
                message: "Failed to process OTP request.",
            });
        }

        if ((count || 0) >= 3) {
            return res.status(429).json({
                success: false,
                message: "Too many OTP requests. Please wait a few minutes.",
            });
        }

        // ── Invalidate all previous unused OTPs for this phone+type ──────────
        const { error: invalidateError } = await supabase
            .from("otps")
            .update({ is_used: true })
            .eq("phone", phone)
            .eq("type", type)
            .eq("is_used", false);

        if (invalidateError) {
            console.error("[OTP] Invalidate error:", invalidateError);
            return res.status(500).json({
                success: false,
                message: "Failed to generate OTP. Please try again.",
            });
        }

        // ── Generate & store new OTP ──────────────────────────────────────────
        const otp = generateOTP();
        const expires_at = getExpiresAt();

        const { error: insertError } = await supabase
            .from("otps")
            .insert({
                phone,
                otp,
                type,
                is_used: false,
                expires_at,
            });

        if (insertError) {
            console.error("[OTP] Insert error:", insertError);
            return res.status(500).json({
                success: false,
                message: "Failed to generate OTP. Please try again.",
            });
        }

        // ── Send via Twilio SMS ───────────────────────────────────────────────
        try {
            await client.messages.create({
                body: `Your TrueFitness OTP is: ${otp}. Valid for 10 minutes. Do not share it with anyone.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: normalisePhone(phone),
            });
        } catch (twilioErr) {
            console.error("[Twilio] Send error:", twilioErr.message);

            // Invalidate stored OTP so it can't be misused
            await supabase
                .from("otps")
                .update({ is_used: true })
                .eq("phone", phone)
                .eq("otp", otp)
                .eq("type", type);

            return res.status(502).json({
                success: false,
                message: "Failed to send OTP. Please try again.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully.",
        });
    } catch (err) {
        console.error("[sendOTP] Unexpected error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/otp/verify
 * Body: { phone, otp, type }
 */
const verifyOTP = async (req, res) => {
    try {
        let { phone, otp, type } = req.body;

        phone = normalisePhoneForDb(phone);

        if (!type) {
            type = "register";
        }

        const { data: record, error } = await supabase
            .from("otps")
            .select("*")
            .eq("phone", phone)
            .eq("type", type)
            .eq("is_used", false)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !record) {
            return res.status(400).json({
                success: false,
                message: "OTP not found or has expired.",
            });
        }

        if (record.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP. Please check and try again.",
            });
        }

        await supabase
            .from("otps")
            .update({ is_used: true })
            .eq("id", record.id);

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully.",
        });
    } catch (err) {
        console.error("[verifyOTP] Unexpected error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/otp/resend
 * Body: { phone, type }
 * Delegates to sendOTP — it invalidates old OTPs before sending a new one.
 */
const resendOTP = (req, res) => sendOTP(req, res);

module.exports = { sendOTP, verifyOTP, resendOTP };