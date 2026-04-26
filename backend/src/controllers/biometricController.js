const ZKLib = require("node-zklib");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ZK_IP   = process.env.ZK_DEVICE_IP;
const ZK_PORT = parseInt(process.env.ZK_DEVICE_PORT) || 4370;

// ─── Check if a member is allowed access ─────────────────────────────────────
async function checkMembership(zkUserId) {
  // 1. Find user by their fingerprint machine ID
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, is_active")
    .eq("zk_user_id", zkUserId)
    .single();

  if (userError || !user) {
    return { allowed: false, reason: "User not found in system", user: null };
  }

  if (!user.is_active) {
    return { allowed: false, reason: "Account is inactive", user };
  }

  // 2. Check their membership status
  const today = new Date().toISOString().split("T")[0];

  const { data: membership, error: memError } = await supabase
    .from("user_memberships")
    .select("id, status, end_date, monthly_plan")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gte("end_date", today)
    .order("end_date", { ascending: false })
    .limit(1)
    .single();

  if (memError || !membership) {
    return { allowed: false, reason: "No active membership or membership expired", user };
  }

  return { allowed: true, reason: null, user, membership };
}

// ─── Log the punch attempt to Supabase ───────────────────────────────────────
async function logPunch({ userId, punchType, accessGranted, denyReason }) {
  const { error } = await supabase.from("biometric_logs").insert({
    user_id:        userId || null,
    punched_at:     new Date().toISOString(),
    punch_type:     punchType || 0,
    access_granted: accessGranted,
    deny_reason:    denyReason || null,
  });

  if (error) console.error("Failed to log punch:", error.message);
}

// ─── Pull attendance logs from ZKTeco device ─────────────────────────────────
async function pullAttendanceLogs() {
  const zk = new ZKLib(ZK_IP, ZK_PORT, 5000, 0);

  try {
    await zk.createSocket();
    const { data: logs } = await zk.getAttendances();
    await zk.disconnect();

    const results = [];

    for (const log of logs) {
      const zkUserId  = parseInt(log.deviceUserId);
      const punchType = log.type || 0;

      const { allowed, reason, user } = await checkMembership(zkUserId);

      await logPunch({
        userId:        user?.id || null,
        punchType,
        accessGranted: allowed,
        denyReason:    reason,
      });

      results.push({
        zkUserId,
        userName:      user?.name || "Unknown",
        accessGranted: allowed,
        denyReason:    reason,
        punchedAt:     log.attendTime,
      });
    }

    return results;
  } catch (err) {
    await zk.disconnect().catch(() => {});
    throw err;
  }
}

// ─── Sync active members to ZKTeco device ────────────────────────────────────
async function syncUsersToDevice() {
 const zk = new ZKLib(ZK_IP, ZK_PORT, 5000, 0);

  try {
    await zk.createSocket();

    // Get all users who have a zk_user_id assigned
    const { data: users, error } = await supabase
      .from("users")
      .select("id, name, zk_user_id, is_active")
      .not("zk_user_id", "is", null);

    if (error) throw error;

    for (const user of users) {
      // Check if they have an active membership
      const today = new Date().toISOString().split("T")[0];
      const { data: membership } = await supabase
        .from("user_memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("end_date", today)
        .limit(1)
        .single();

      const privilege = membership && user.is_active ? 0 : 3; // 0 = normal, 3 = disabled

      await zk.setUser(
        user.zk_user_id,
        user.zk_user_id.toString(),
        user.name,
        "",        // password (blank)
        privilege,
        0
      );
    }

    await zk.disconnect();
    console.log(`Synced ${users.length} users to device`);
  } catch (err) {
  console.error("❌ Sync error:", err);  // add this
  await zk.disconnect().catch(() => {});
  throw err;
}
}

module.exports = { checkMembership, pullAttendanceLogs, syncUsersToDevice };
