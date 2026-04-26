const { adminOnly } = require("../middlewares/authMiddleware");
const express = require("express");
const router = express.Router();
const {
  syncUsersToDevice,
  pullAttendanceLogs,
  checkMembership,
} = require("../controllers/biometricController");



// ─── GET /api/biometric/status ────────────────────────────────────────────────
router.get("/status/:userId", adminOnly, async (req, res) => {
  try {
    const result = await checkMembership(req.params.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/biometric/sync ─────────────────────────────────────────────────
router.post("/sync", adminOnly, async (req, res) => {
  try {
    await syncUsersToDevice();
    res.json({ success: true, message: "Device synced successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/biometric/pull-logs ───────────────────────────────────────────
router.post("/pull-logs", adminOnly, async (req, res) => {
  try {
    const logs = await pullAttendanceLogs();
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/biometric/logs ──────────────────────────────────────────────────
router.get("/logs", adminOnly, async (req, res) => {
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const { from, to, userId } = req.query;

    let query = supabase
      .from("biometric_logs")
      .select("*, users(name, email)")
      .order("punch_time", { ascending: false })
      .limit(200);

    if (from)   query = query.gte("punch_time", from);
    if (to)     query = query.lte("punch_time", to);
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, logs: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;