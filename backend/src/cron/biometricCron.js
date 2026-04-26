const cron = require("node-cron");
const { pullAttendanceLogs, syncUsersToDevice } = require("../controllers/biometricController");

// Pull attendance logs every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  console.log("⏱ [CRON] Pulling attendance logs from device...");
  try {
    const logs = await pullAttendanceLogs();
    if (logs.length > 0) {
      console.log(`✅ [CRON] Processed ${logs.length} attendance records`);
    }
  } catch (err) {
    console.error("❌ [CRON] Failed to pull logs:", err.message);
  }
});

// Sync device users every day at midnight
// Automatically disables expired memberships on the fingerprint machine
cron.schedule("0 0 * * *", async () => {
  console.log("🔄 [CRON] Daily device sync starting...");
  try {
    await syncUsersToDevice();
    console.log("✅ [CRON] Daily sync complete");
  } catch (err) {
    console.error("❌ [CRON] Sync failed:", err.message);
  }
});

console.log("⏱ Biometric cron jobs registered");