const supabase = require("../config/supabaseClient");

const searchUserByPhone = async (req, res) => {
  try {
    const rawPhone = String(req.query.phone || "").trim();

    if (!rawPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required",
      });
    }

    const phone = rawPhone.replace(/\D/g, "").slice(-10);

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number",
      });
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, name, phone, email, role")
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      console.error("[SearchUser] Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to search user",
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[SearchUser] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

module.exports = {
  searchUserByPhone,
};