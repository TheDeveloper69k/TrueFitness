const supabase = require("../config/supabaseClient");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ─── Helpers ──────────────────────────────────────────────────
const normalizePhone = (phone) => {
  if (!phone) return "";
  return String(phone).replace(/\s+/g, "").trim();
};

const normalizeEmail = (email) => {
  if (!email) return null;
  return String(email).trim().toLowerCase();
};

const isValidEmail = (email) => {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPhone = (phone) => /^[0-9]{10,15}$/.test(phone);

const isStrongPassword = (password) => {
  return password.length >= 6 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
};

const generateAccessToken = (user) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(
    { id: user.id, role: user.role, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const generateRefreshToken = (user) => {
  if (!process.env.JWT_REFRESH_SECRET) throw new Error("JWT_REFRESH_SECRET is not configured");
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "30d" }
  );
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const OTP_EXPIRY_MINUTES = 10;

// ─── Register ─────────────────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    let { name, email, password, phone, plan_id } = req.body;

    name = (name || "").trim();
    email = normalizeEmail(email);
    password = (password || "").trim();
    phone = normalizePhone(phone);

    if (!name || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, and password are required",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters and contain letters and numbers",
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number (10–15 digits only)",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const { data: existingPhone, error: phoneCheckError } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (phoneCheckError) {
      console.error("[Register] Phone check error:", phoneCheckError);
      return res.status(500).json({ success: false, message: "Failed to validate phone number" });
    }

    if (existingPhone) {
      return res.status(409).json({ success: false, message: "Phone number already registered" });
    }

    if (email) {
      const { data: existingEmail, error: emailCheckError } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (emailCheckError) {
        console.error("[Register] Email check error:", emailCheckError);
        return res.status(500).json({ success: false, message: "Failed to validate email" });
      }

      if (existingEmail) {
        return res.status(409).json({ success: false, message: "Email already registered" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const { data: user, error: insertError } = await supabase
      .from("users")
      .insert([
        {
          name,
          email,
          password: hashedPassword,
          role: "user",
          phone
        }
      ])
      .select("id, name, email, role, phone, created_at")
      .single();

    if (insertError) {
      console.error("[Register] Insert error:", insertError);
      return res.status(500).json({ success: false, message: "Failed to register user" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await supabase
      .from("users")
      .update({ refresh_token: refreshToken })
      .eq("id", user.id);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      accessToken,
      refreshToken,
      data: user,
    });
  } catch (err) {
    console.error("[Register] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Login ────────────────────────────────────────────────────
const loginUser = async (req, res) => {
  try {
    let { phone, password } = req.body;

    phone = normalizePhone(phone);
    password = (password || "").trim();

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "Phone and password are required" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, password, role, phone, created_at, is_active")
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      console.error("[Login] Fetch error:", error);
      return res.status(500).json({ success: false, message: "Failed to process login" });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid phone or password" });
    }

    if (user.is_active === false) {
      return res.status(403).json({ success: false, message: "Account is deactivated. Contact support." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid phone or password" });
    }

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      created_at: user.created_at,
    };

    const accessToken = generateAccessToken(userData);
    const refreshToken = generateRefreshToken(userData);

    await supabase
      .from("users")
      .update({ refresh_token: refreshToken, last_login: new Date().toISOString() })
      .eq("id", user.id);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
      data: userData,
    });
  } catch (err) {
    console.error("[Login] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Refresh Token ────────────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Refresh token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, role, phone, refresh_token, is_active")
      .eq("id", decoded.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (user.refresh_token !== token) {
      return res.status(401).json({ success: false, message: "Refresh token mismatch" });
    }

    if (user.is_active === false) {
      return res.status(403).json({ success: false, message: "Account deactivated" });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    await supabase
      .from("users")
      .update({ refresh_token: newRefreshToken })
      .eq("id", user.id);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("[RefreshToken] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Logout ───────────────────────────────────────────────────
const logoutUser = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (userId) {
      await supabase
        .from("users")
        .update({ refresh_token: null })
        .eq("id", userId);
    }

    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("[Logout] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Get Me ───────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, role, phone, created_at, last_login, plan_id")
      .eq("id", req.user.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error("[GetMe] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── OTP: Send Register ───────────────────────────────────────
const sendRegisterOTP = async (req, res) => {
  try {
    let { phone } = req.body;
    phone = normalizePhone(phone);

    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: "Valid phone number is required" });
    }

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ success: false, message: "Phone number already registered" });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await supabase.from("otps").upsert(
      { phone, otp, type: "register", expires_at: expiresAt, verified: false },
      { onConflict: "phone,type" }
    );

    // TODO: replace with your SMS provider (e.g. Twilio, MSG91)
    console.log(`[OTP] Register OTP for ${phone}: ${otp}`);

    return res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("[SendRegisterOTP] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── OTP: Verify Register ─────────────────────────────────────
const verifyRegisterOTP = async (req, res) => {
  try {
    let { phone, otp, name, password } = req.body;

    // ✅ Match otpController's phone normalisation
    const digits = String(phone || "").replace(/\D/g, "");
    phone = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: "Phone and OTP are required" });
    }

    // ✅ Query using is_used (not verified) — matches how otpController saves
    const { data: record, error } = await supabase
      .from("otps")
      .select("*")
      .eq("phone", phone)
      .eq("type", "register")
      .eq("is_used", false)                              // ✅ was: verified=false
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !record) {
      return res.status(400).json({ success: false, message: "OTP not found. Please request a new one." });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // ✅ Mark as is_used (not verified)
    await supabase
      .from("otps")
      .update({ is_used: true })                        // ✅ was: verified=true
      .eq("id", record.id);

    // ── Now register the user ──────────────────────────────────
    name = (name || "").trim();
    password = (password || "").trim();

    if (!name || !password) {
      return res.status(400).json({ success: false, message: "Name and password are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const { data: user, error: insertError } = await supabase
      .from("users")
      .insert([{ name, phone, password: hashedPassword, role: "user" }])
      .select("id, name, role, phone, created_at")
      .single();

    if (insertError) {
      console.error("[VerifyRegisterOTP] Insert error:", insertError);
      return res.status(500).json({ success: false, message: "Failed to create account." });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await supabase.from("users").update({ refresh_token: refreshToken }).eq("id", user.id);

    return res.status(200).json({
      success: true,
      message: "Account created successfully",
      accessToken,
      data: user,
    });

  } catch (err) {
    console.error("[VerifyRegisterOTP] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── OTP: Forgot Password ─────────────────────────────────────
const sendForgotPasswordOTP = async (req, res) => {
  try {
    let { phone } = req.body;
    phone = normalizePhone(phone);

    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: "Valid phone number is required" });
    }

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    // Don't reveal whether the phone exists — always respond the same way
    if (user) {
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

      await supabase.from("otps").upsert(
        { phone, otp, type: "forgot_password", expires_at: expiresAt, verified: false },
        { onConflict: "phone,type" }
      );

      // TODO: replace with your SMS provider (e.g. Twilio, MSG91)
      console.log(`[OTP] Forgot password OTP for ${phone}: ${otp}`);
    }

    return res.status(200).json({
      success: true,
      message: "If that number is registered, an OTP has been sent.",
    });
  } catch (err) {
    console.error("[SendForgotPasswordOTP] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── OTP: Reset Password ──────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    let { phone, otp, newPassword } = req.body;
    phone = normalizePhone(phone);
    newPassword = (newPassword || "").trim();

    if (!phone || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Phone, OTP, and new password are required",
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters and contain letters and numbers",
      });
    }

    const { data: record } = await supabase
      .from("otps")
      .select("*")
      .eq("phone", phone)
      .eq("type", "forgot_password")
      .maybeSingle();

    if (!record) {
      return res.status(400).json({ success: false, message: "OTP not found. Please request a new one." });
    }

    if (record.verified) {
      return res.status(400).json({ success: false, message: "OTP already used" });
    }

    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("phone", phone);

    await supabase
      .from("otps")
      .update({ verified: true })
      .eq("phone", phone)
      .eq("type", "forgot_password");

    return res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("[ResetPassword] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getMe,
  sendRegisterOTP,
  verifyRegisterOTP,
  sendForgotPasswordOTP,
  resetPassword,
};