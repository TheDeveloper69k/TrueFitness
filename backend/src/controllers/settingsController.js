const supabase = require("../config/supabaseClient");
const bcrypt = require("bcryptjs");

// ─── Helpers ──────────────────────────────────────────────────
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
    return (
        password.length >= 6 &&
        /[a-zA-Z]/.test(password) &&
        /[0-9]/.test(password)
    );
};

// ─── Change Password ──────────────────────────────────────────
// POST /api/settings/change-password
// Body: { currentPassword, newPassword }
const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        let { currentPassword, newPassword } = req.body;

        currentPassword = (currentPassword || "").trim();
        newPassword = (newPassword || "").trim();

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required",
            });
        }

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({
                success: false,
                message:
                    "New password must be at least 6 characters and contain letters and numbers",
            });
        }

        // Fetch hashed password from DB
        const { data: user, error } = await supabase
            .from("users")
            .select("password")
            .eq("id", userId)
            .maybeSingle();

        if (error || !user) {
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res
                .status(401)
                .json({ success: false, message: "Current password is incorrect" });
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: "New password must be different from the current password",
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        const { error: updateError } = await supabase
            .from("users")
            .update({ password: hashedPassword })
            .eq("id", userId);

        if (updateError) {
            console.error("[ChangePassword] Update error:", updateError);
            return res
                .status(500)
                .json({ success: false, message: "Failed to update password" });
        }

        return res
            .status(200)
            .json({ success: true, message: "Password changed successfully" });
    } catch (err) {
        console.error("[ChangePassword] Unexpected error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};

// ─── Update Profile ───────────────────────────────────────────
// PUT /api/settings/profile
// Body: { name, email, phone }  — all optional, send only what changed
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        let { name, email, phone } = req.body;

        const updates = {};

        if (name !== undefined) {
            name = name.trim();
            if (!name) {
                return res
                    .status(400)
                    .json({ success: false, message: "Name cannot be empty" });
            }
            updates.name = name;
        }

        if (email !== undefined) {
            email = normalizeEmail(email);
            if (!isValidEmail(email)) {
                return res
                    .status(400)
                    .json({ success: false, message: "Invalid email format" });
            }

            // Check email not taken by another user
            if (email) {
                const { data: existing } = await supabase
                    .from("users")
                    .select("id")
                    .eq("email", email)
                    .neq("id", userId)
                    .maybeSingle();

                if (existing) {
                    return res
                        .status(409)
                        .json({ success: false, message: "Email already in use" });
                }
            }

            updates.email = email;
        }

        if (phone !== undefined) {
            phone = String(phone).replace(/\s+/g, "").trim();
            if (!isValidPhone(phone)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number (10–15 digits only)",
                });
            }

            // Check phone not taken by another user
            const { data: existingPhone } = await supabase
                .from("users")
                .select("id")
                .eq("phone", phone)
                .neq("id", userId)
                .maybeSingle();

            if (existingPhone) {
                return res
                    .status(409)
                    .json({ success: false, message: "Phone number already in use" });
            }

            updates.phone = phone;
        }

        if (Object.keys(updates).length === 0) {
            return res
                .status(400)
                .json({ success: false, message: "No fields provided to update" });
        }

        const { data: updatedUser, error } = await supabase
            .from("users")
            .update(updates)
            .eq("id", userId)
            .select("id, name, email, phone, role")
            .single();

        if (error) {
            console.error("[UpdateProfile] Error:", error);
            return res
                .status(500)
                .json({ success: false, message: "Failed to update profile" });
        }

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: updatedUser,
        });
    } catch (err) {
        console.error("[UpdateProfile] Unexpected error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};

// ─── Upload Profile Photo ─────────────────────────────────────
// POST /api/settings/profile-photo
// multipart/form-data: field name = "photo"
// Requires multer middleware on the route (see settingsRoutes.js)
const uploadProfilePhoto = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!req.file) {
            return res
                .status(400)
                .json({ success: false, message: "No photo uploaded" });
        }

        const file = req.file;
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: "Only JPEG, PNG, or WebP images are allowed",
            });
        }

        const maxSize = 2 * 1024 * 1024; // 2 MB
        if (file.size > maxSize) {
            return res
                .status(400)
                .json({ success: false, message: "Image must be under 2MB" });
        }

        const ext = file.mimetype.split("/")[1];
        const filePath = `avatars/${userId}.${ext}`;

        // Upload to Supabase Storage bucket called "profile-photos"
        const { error: uploadError } = await supabase.storage
            .from("profile-photos")
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true, // overwrite if exists
            });

        if (uploadError) {
            console.error("[UploadPhoto] Storage error:", uploadError);
            return res
                .status(500)
                .json({ success: false, message: "Failed to upload photo" });
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from("profile-photos")
            .getPublicUrl(filePath);

        const photoUrl = urlData.publicUrl;

        // Save URL to users table
        const { error: updateError } = await supabase
            .from("users")
            .update({ photo_url: photoUrl })
            .eq("id", userId);

        if (updateError) {
            console.error("[UploadPhoto] DB update error:", updateError);
            return res
                .status(500)
                .json({ success: false, message: "Failed to save photo URL" });
        }

        return res.status(200).json({
            success: true,
            message: "Profile photo updated successfully",
            data: { photo_url: photoUrl },
        });
    } catch (err) {
        console.error("[UploadPhoto] Unexpected error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};

// ─── Delete Account ───────────────────────────────────────────
// DELETE /api/settings/account
// Body: { password }  — require password confirmation for safety
const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        let { password } = req.body;
        password = (password || "").trim();

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Please confirm your password to delete your account",
            });
        }

        // Fetch user with password
        const { data: user, error } = await supabase
            .from("users")
            .select("password, role")
            .eq("id", userId)
            .maybeSingle();

        if (error || !user) {
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
        }

        // Prevent admins from self-deleting via this route
        if (user.role === "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin accounts cannot be deleted from settings",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res
                .status(401)
                .json({ success: false, message: "Incorrect password" });
        }

        // Soft delete: mark account as inactive instead of hard delete
        // This preserves membership/payment history
        const { error: deleteError } = await supabase
            .from("users")
            .update({
                is_active: false,
                refresh_token: null,
                deleted_at: new Date().toISOString(),
            })
            .eq("id", userId);

        if (deleteError) {
            console.error("[DeleteAccount] Error:", deleteError);
            return res
                .status(500)
                .json({ success: false, message: "Failed to delete account" });
        }

        return res.status(200).json({
            success: true,
            message: "Account deleted successfully",
        });
    } catch (err) {
        console.error("[DeleteAccount] Unexpected error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
    changePassword,
    updateProfile,
    uploadProfilePhoto,
    deleteAccount,
};