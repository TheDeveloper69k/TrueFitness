const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
    changePassword,
    updateProfile,
    uploadProfilePhoto,
    deleteAccount,
} = require("../controllers/settingsController");
const { protect } = require("../middlewares/authMiddleware");

// Multer — store file in memory so we can pass buffer to Supabase Storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB hard limit
});

// All settings routes require a logged-in user
router.post("/change-password", protect, changePassword);
router.put("/profile", protect, updateProfile);
router.post("/profile-photo", protect, upload.single("photo"), uploadProfilePhoto);
router.delete("/account", protect, deleteAccount);

module.exports = router;