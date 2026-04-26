// cron/birthdayWishJob.js
const cron = require("node-cron");
const supabase = require("../config/supabaseClient");

const formatPhone = (phone) => {
  const cleaned = String(phone || "").replace(/\D/g, "");
  if (!cleaned) return null;
  return cleaned.length === 10 ? `+91${cleaned}` : `+${cleaned}`;
};

const sendBirthdayWishes = async () => {
  try {
    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const today = new Date(now);
    const month = today.getMonth() + 1;
    const day = today.getDate();

    console.log(`[BirthdayJob] Checking birthdays for ${day}/${month}`);

    // Get active memberships with birthday today
    const { data: memberships, error } = await supabase
      .from("user_memberships")
      .select(`
        id, user_id, full_name, phone, date_of_birth,
        users ( id, name, phone )
      `)
      .eq("status", "active")
      .not("date_of_birth", "is", null);

    if (error) {
      console.error("[BirthdayJob] Fetch error:", error);
      return { success: false, error: error.message };
    }

    // Filter birthdays today
    const todayBirthdays = memberships.filter((m) => {
      const dob = new Date(m.date_of_birth);
      return dob.getMonth() + 1 === month && dob.getDate() === day;
    });

    if (todayBirthdays.length === 0) {
      console.log("[BirthdayJob] No birthdays today");
      return { success: true, sent: 0 };
    }

    console.log(`[BirthdayJob] Found ${todayBirthdays.length} birthday(s) today`);

    const client = require("twilio")(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    let sent = 0, failed = 0;

    // Deduplicate by user_id
    const seen = new Set();

    for (const m of todayBirthdays) {
      const userId = m.user_id;
      if (seen.has(userId)) continue;
      seen.add(userId);

      const phone = m.users?.phone || m.phone;
      const name = m.users?.name || m.full_name || "Member";

      if (!phone) continue;

      const formatted = formatPhone(phone);
      if (!formatted) continue;

      try {
        const result = await client.messages.create({
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${formatted}`,
          contentSid: process.env.TWILIO_TEMPLATE_BIRTHDAY,
          contentVariables: JSON.stringify({ "1": name }),
        });

        console.log(`[BirthdayJob] ✅ Sent to ${name} — SID: ${result.sid}`);
        sent++;
      } catch (err) {
        console.error(`[BirthdayJob] ❌ Failed for ${name}:`, err.message);
        failed++;
      }
    }

    console.log(`[BirthdayJob] Done — sent: ${sent}, failed: ${failed}`);
    return { success: true, sent, failed };
  } catch (err) {
    console.error("[BirthdayJob] Unexpected error:", err);
    return { success: false, error: err.message };
  }
};

// Runs daily at 10:00 AM IST
cron.schedule(
  "0 10 * * *",
  async () => {
    console.log(`\n[BirthdayJob] ── Birthday Wishes ── ${new Date().toISOString()}`);
    await sendBirthdayWishes();
  },
  { timezone: "Asia/Kolkata" }
);

console.log("[BirthdayJob] Birthday wish job registered — runs daily at 10:00 AM IST");
module.exports = { sendBirthdayWishes };