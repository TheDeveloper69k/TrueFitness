// controllers/whatsappController.js
// COMPLETE FILE — replace your existing whatsappController.js entirely

const supabase = require("../config/supabaseClient");

// ─── Twilio helper ────────────────────────────────────────────────────────────

const getTwilioClient = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials are not configured");
  }
  return require("twilio")(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
};

const formatPhone = (phone) => {
  const cleaned = String(phone || "").replace(/\D/g, "");
  if (!cleaned) return null;
  return cleaned.length === 10 ? `+91${cleaned}` : `+${cleaned}`;
};

const sendWhatsApp = async (phone, message) => {
  const formatted = formatPhone(phone);
  if (!formatted) throw new Error("Invalid phone number");

  const client = getTwilioClient();
  const result = await client.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${formatted}`,
    body: message,
  });
  return result.sid;
};

// ─── Date helpers (IST-safe) ──────────────────────────────────────────────────

const getISTDateOnly = (date = new Date()) => {
  const ist = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, "0");
  const d = String(ist.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDaysToDateOnly = (dateOnly, days) => {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);

  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

const formatDateForUser = (dateOnly) => {
  if (!dateOnly) return "";
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN");
};

// ═════════════════════════════════════════════════════════════════════════════
// SEND TO SINGLE USER  →  POST /api/v1/whatsapp/send
// ═════════════════════════════════════════════════════════════════════════════

const sendToUser = async (req, res) => {
  try {
    let { user_id, title, message, scheduled_at } = req.body;

    title = title?.trim();
    message = message?.trim();

    if (!user_id || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "user_id, title, and message are required",
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, phone, is_active")
      .eq("id", parseInt(user_id))
      .maybeSingle();

    if (userError || !user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.is_active === false) {
      return res
        .status(400)
        .json({ success: false, message: "User account is inactive" });
    }
    if (!user.phone) {
      return res
        .status(400)
        .json({ success: false, message: "User has no phone number" });
    }

    if (scheduled_at && new Date(scheduled_at) > new Date()) {
      const { data, error } = await supabase
        .from("whatsapp_notifications")
        .insert([
          {
            user_id: parseInt(user_id),
            title,
            message,
            target_type: "user",
            status: "pending",
            scheduled_at,
            created_by: req.user.id,
            updated_at: new Date().toISOString(),
          },
        ])
        .select("*")
        .single();

      if (error) {
        console.error("[SendToUser] Schedule insert error:", error);
        return res
          .status(500)
          .json({ success: false, message: "Failed to schedule message" });
      }

      return res.status(201).json({
        success: true,
        message: `Message scheduled for ${scheduled_at}`,
        data,
      });
    }

    let provider_message_id = null;
    let status = "sent";
    let error_message = null;
    let sent_at = null;

   try {
  console.log("[SendToUser] Raw phone from DB:", user.phone);
  console.log("[SendToUser] Formatted phone:", formatPhone(user.phone));
  console.log("[SendToUser] TWILIO_WHATSAPP_NUMBER:", process.env.TWILIO_WHATSAPP_NUMBER);

  provider_message_id = await sendWhatsApp(
    user.phone,
    `*${title}*\n\n${message}`
  );

  sent_at = new Date().toISOString();
  console.log("[SendToUser] WhatsApp sent. SID:", provider_message_id);
} catch (smsErr) {
  console.error("[SendToUser] Twilio full error:", smsErr);
  console.error("[SendToUser] Twilio error message:", smsErr.message);
  status = "failed";
  error_message = smsErr.message;
}

    const { data, error } = await supabase
      .from("whatsapp_notifications")
      .insert([
        {
          user_id: parseInt(user_id),
          title,
          message,
          target_type: "user",
          status,
          provider_message_id,
          sent_at,
          error_message,
          created_by: req.user.id,
          updated_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();

    if (error) {
      console.error("[SendToUser] DB insert error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to save notification record" });
    }

   if (status === "failed") {
  return res.status(500).json({
    success: false,
    message: error_message || "Message failed to send via WhatsApp",
    data,
  });
}

    return res.status(201).json({
      success: true,
      message: `WhatsApp message sent to ${user.name}`,
      data,
    });
  } catch (err) {
    console.error("[SendToUser] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// SEND TO MULTIPLE SELECTED USERS  →  POST /api/v1/whatsapp/send-bulk
// ═════════════════════════════════════════════════════════════════════════════

const sendBulk = async (req, res) => {
  try {
    let { user_ids, title, message, scheduled_at } = req.body;

    title = title?.trim();
    message = message?.trim();

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "user_ids array is required and must not be empty",
      });
    }
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "title and message are required",
      });
    }

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, phone")
      .in("id", user_ids.map((id) => parseInt(id)))
      .eq("is_active", true)
      .not("phone", "is", null);

    if (usersError) {
      console.error("[SendBulk] Fetch error:", usersError);
      return res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active users with phone numbers found for given IDs",
      });
    }

    if (scheduled_at && new Date(scheduled_at) > new Date()) {
      const pendingRecords = users.map((user) => ({
        user_id: user.id,
        title,
        message,
        target_type: "bulk",
        status: "pending",
        scheduled_at,
        created_by: req.user.id,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("whatsapp_notifications")
        .insert(pendingRecords);

      if (error) {
        console.error("[SendBulk] Schedule insert error:", error);
        return res
          .status(500)
          .json({ success: false, message: "Failed to schedule bulk messages" });
      }

      return res.status(201).json({
        success: true,
        message: `${users.length} messages scheduled for ${scheduled_at}`,
        data: { scheduled_count: users.length },
      });
    }

    const results = { sent: 0, failed: 0, errors: [] };
    const records = [];

    for (const user of users) {
      let provider_message_id = null;
      let status = "sent";
      let error_message = null;
      let sent_at = null;

      try {
        provider_message_id = await sendWhatsApp(
          user.phone,
          `*${title}*\n\n${message}`
        );
        sent_at = new Date().toISOString();
        results.sent++;
      } catch (smsErr) {
        status = "failed";
        error_message = smsErr.message;
        results.failed++;
        results.errors.push({
          user_id: user.id,
          name: user.name,
          error: smsErr.message,
        });
      }

      records.push({
        user_id: user.id,
        title,
        message,
        target_type: "bulk",
        status,
        provider_message_id,
        sent_at,
        error_message,
        created_by: req.user.id,
        updated_at: new Date().toISOString(),
      });
    }

    const { error: insertError } = await supabase
      .from("whatsapp_notifications")
      .insert(records);

    if (insertError) console.error("[SendBulk] DB insert error:", insertError);

    return res.status(200).json({
      success: true,
      message: `Bulk send complete — ${results.sent} sent, ${results.failed} failed`,
      data: {
        total: users.length,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
    });
  } catch (err) {
    console.error("[SendBulk] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// BROADCAST TO ALL USERS  →  POST /api/v1/whatsapp/broadcast
// ═════════════════════════════════════════════════════════════════════════════

const broadcast = async (req, res) => {
  try {
    let { title, message, scheduled_at } = req.body;

    title = title?.trim();
    message = message?.trim();

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "title and message are required",
      });
    }

    if (scheduled_at && new Date(scheduled_at) > new Date()) {
      const { data, error } = await supabase
        .from("whatsapp_notifications")
        .insert([
          {
            user_id: null,
            title,
            message,
            target_type: "all",
            status: "pending",
            scheduled_at,
            created_by: req.user.id,
            updated_at: new Date().toISOString(),
          },
        ])
        .select("*")
        .single();

      if (error) {
        console.error("[Broadcast] Schedule insert error:", error);
        return res
          .status(500)
          .json({ success: false, message: "Failed to schedule broadcast" });
      }

      return res.status(201).json({
        success: true,
        message: `Broadcast scheduled for ${scheduled_at}`,
        data,
      });
    }

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, phone")
      .eq("is_active", true)
      .not("phone", "is", null);

    if (usersError) {
      console.error("[Broadcast] Fetch users error:", usersError);
      return res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active users with phone numbers found",
      });
    }

    const results = { sent: 0, failed: 0, errors: [] };
    const records = [];

    for (const user of users) {
      let provider_message_id = null;
      let status = "sent";
      let error_message = null;
      let sent_at = null;

      try {
        provider_message_id = await sendWhatsApp(
          user.phone,
          `*${title}*\n\n${message}`
        );
        sent_at = new Date().toISOString();
        results.sent++;
      } catch (smsErr) {
        status = "failed";
        error_message = smsErr.message;
        results.failed++;
        results.errors.push({
          user_id: user.id,
          name: user.name,
          error: smsErr.message,
        });
      }

      records.push({
        user_id: user.id,
        title,
        message,
        target_type: "all",
        status,
        provider_message_id,
        sent_at,
        error_message,
        created_by: req.user.id,
        updated_at: new Date().toISOString(),
      });
    }

    const { error: insertError } = await supabase
      .from("whatsapp_notifications")
      .insert(records);

    if (insertError) console.error("[Broadcast] Bulk insert error:", insertError);

    return res.status(200).json({
      success: true,
      message: `Broadcast complete — ${results.sent} sent, ${results.failed} failed`,
      data: {
        total: users.length,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
    });
  } catch (err) {
    console.error("[Broadcast] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// RETRY FAILED MESSAGE  →  POST /api/v1/whatsapp/:id/retry
// ═════════════════════════════════════════════════════════════════════════════

const retryFailed = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: notif, error: fetchError } = await supabase
      .from("whatsapp_notifications")
      .select("id, user_id, title, message, status")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (fetchError || !notif) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    if (notif.status !== "failed") {
      return res.status(400).json({
        success: false,
        message: "Only failed messages can be retried",
      });
    }

    const { data: user } = await supabase
      .from("users")
      .select("phone, name")
      .eq("id", notif.user_id)
      .maybeSingle();

    if (!user?.phone) {
      return res.status(400).json({ success: false, message: "User phone not found" });
    }

    let provider_message_id = null;
    let status = "sent";
    let error_message = null;
    let sent_at = null;

    try {
      provider_message_id = await sendWhatsApp(
        user.phone,
        `*${notif.title}*\n\n${notif.message}`
      );
      sent_at = new Date().toISOString();
    } catch (smsErr) {
      status = "failed";
      error_message = smsErr.message;
    }

    const { data, error } = await supabase
      .from("whatsapp_notifications")
      .update({
        status,
        provider_message_id,
        sent_at,
        error_message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parseInt(id))
      .select("*")
      .single();

    if (error) {
      console.error("[RetryFailed] Update error:", error);
      return res.status(500).json({ success: false, message: "Failed to update notification" });
    }
    if (status === "failed") {
      return res.status(500).json({
        success: false,
        message: "Retry failed",
        error: error_message,
        data,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message resent successfully",
      data,
    });
  } catch (err) {
    console.error("[RetryFailed] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET ALL NOTIFICATIONS (admin)  →  GET /api/v1/whatsapp
// ═════════════════════════════════════════════════════════════════════════════

const getAllNotifications = async (req, res) => {
  try {
    const { status, target_type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from("whatsapp_notifications")
      .select(
        `
        id, title, message, status, target_type, provider_message_id,
        sent_at, scheduled_at, error_message, created_at, updated_at,
        users!whatsapp_notifications_user_id_fkey ( id, name, phone )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq("status", status);
    if (target_type) query = query.eq("target_type", target_type);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GetAllNotifications] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }

    return res.status(200).json({
      success: true,
      count,
      page: parseInt(page),
      total_pages: Math.ceil(count / parseInt(limit)),
      data,
    });
  } catch (err) {
    console.error("[GetAllNotifications] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET MY WHATSAPP NOTIFICATIONS (user)  →  GET /api/v1/whatsapp/me
// ═════════════════════════════════════════════════════════════════════════════

const getMyNotifications = async (req, res) => {
  try {
    const user_id = req.user.id;

    const { data, error } = await supabase
      .from("whatsapp_notifications")
      .select("id, title, message, status, sent_at, scheduled_at, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GetMyNotifications] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    console.error("[GetMyNotifications] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET STATS (admin)  →  GET /api/v1/whatsapp/stats
// ═════════════════════════════════════════════════════════════════════════════

const getStats = async (req, res) => {
  try {
    const statuses = ["sent", "failed", "pending"];
    const counts = {};

    for (const status of statuses) {
      const { count } = await supabase
        .from("whatsapp_notifications")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      counts[status] = count || 0;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from("whatsapp_notifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", todayStart.toISOString());

    return res.status(200).json({
      success: true,
      data: {
        ...counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        sent_today: todayCount || 0,
      },
    });
  } catch (err) {
    console.error("[GetStats] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// DELETE NOTIFICATION RECORD (admin)  →  DELETE /api/v1/whatsapp/:id
// ═════════════════════════════════════════════════════════════════════════════

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("whatsapp_notifications")
      .delete()
      .eq("id", parseInt(id))
      .select("id, title")
      .maybeSingle();

    if (error) {
      console.error("[DeleteNotification] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete notification" });
    }
    if (!data) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({
      success: true,
      message: `Notification "${data.title}" deleted`,
    });
  } catch (err) {
    console.error("[DeleteNotification] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// MEMBERSHIP EXPIRY ALERT — called by cron job
// 3-day and 1-day alerts with duplicate protection
// ═════════════════════════════════════════════════════════════════════════════

const sendMembershipExpiryAlerts = async (daysBeforeExpiry = 3) => {
  try {
    if (![1, 3].includes(daysBeforeExpiry)) {
      return { success: false, error: "daysBeforeExpiry must be 1 or 3" };
    }

    const todayIST = getISTDateOnly();
    const targetDate = addDaysToDateOnly(todayIST, daysBeforeExpiry);

    console.log(
      `[ExpiryAlert] Today(IST): ${todayIST} | Checking memberships expiring on ${targetDate} (${daysBeforeExpiry}d alert)`
    );

    const { data: memberships, error: fetchError } = await supabase
      .from("user_memberships")
      .select(`
        id, user_id, full_name, phone, monthly_plan, end_date, status,
        users ( id, name, phone )
      `)
      .eq("status", "active")
      .eq("end_date", targetDate);

    if (fetchError) {
      console.error(`[ExpiryAlert] Fetch error (${daysBeforeExpiry}d):`, fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!memberships || memberships.length === 0) {
      console.log(
        `[ExpiryAlert] No active memberships expiring in ${daysBeforeExpiry} day(s)`
      );
      return { success: true, sent: 0, failed: 0 };
    }

    const title =
      daysBeforeExpiry === 1
        ? "⚠️ Membership Expires Tomorrow!"
        : "🔔 Membership Expiring in 3 Days";

    const results = { sent: 0, failed: 0, skipped: 0, errors: [] };
    const records = [];

    for (const membership of memberships) {
      const phone = membership.users?.phone || membership.phone;
      const name = membership.users?.name || membership.full_name || "Member";
      const userId = membership.user_id;
      const plan = membership.monthly_plan || "your plan";
      const expiryDate = membership.end_date;

      if (!phone) {
        console.warn(
          `[ExpiryAlert] No phone for membership ID ${membership.id} (${name}) — skipping`
        );
        results.skipped++;
        continue;
      }

      // duplicate protection:
      // if same user already got same expiry title today for same expiry date, skip
      const { data: existingNotif, error: existingError } = await supabase
        .from("whatsapp_notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("target_type", "expiry_alert")
        .eq("title", title)
        .eq("status", "sent")
        .gte("created_at", `${todayIST}T00:00:00`)
        .lt("created_at", `${todayIST}T23:59:59`)
        .ilike("message", `%${expiryDate}%`)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.error(
          `[ExpiryAlert] Duplicate check error for membership ${membership.id}:`,
          existingError
        );
      }

      if (existingNotif) {
        console.log(
          `[ExpiryAlert] Already sent ${daysBeforeExpiry}d alert today to ${name} — skipping`
        );
        results.skipped++;
        continue;
      }

      const prettyExpiry = formatDateForUser(expiryDate);

      const message =
        daysBeforeExpiry === 1
          ? `Hi *${name}*,\n\nYour *${plan}* membership expires *tomorrow* (${prettyExpiry}).\n\nRenew now to keep your gym access uninterrupted! 💪\n\nContact us or visit the gym to renew.`
          : `Hi *${name}*,\n\nYour *${plan}* membership will expire in *3 days* on *${prettyExpiry}*.\n\nDon't wait — renew early and keep up the great work! 💪\n\nContact us or visit the gym to renew.`;

      let provider_message_id = null;
      let status = "sent";
      let error_message = null;
      let sent_at = null;

      try {
        provider_message_id = await sendWhatsApp(phone, message);
        sent_at = new Date().toISOString();
        results.sent++;
      } catch (smsErr) {
        console.error(`[ExpiryAlert] Twilio error for ${name}:`, smsErr.message);
        status = "failed";
        error_message = smsErr.message;
        results.failed++;
        results.errors.push({ user_id: userId, name, error: smsErr.message });
      }

      records.push({
        user_id: userId,
        title,
        message,
        target_type: "expiry_alert",
        status,
        provider_message_id,
        sent_at,
        error_message,
        created_by: null,
        updated_at: new Date().toISOString(),
      });
    }

    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from("whatsapp_notifications")
        .insert(records);

      if (insertError) {
        console.error("[ExpiryAlert] DB insert error:", insertError);
      }
    }

    console.log(
      `[ExpiryAlert] ${daysBeforeExpiry}d complete — sent: ${results.sent}, failed: ${results.failed}, skipped: ${results.skipped}`
    );

    return {
      success: true,
      sent: results.sent,
      failed: results.failed,
      skipped: results.skipped,
      errors: results.errors,
    };
  } catch (err) {
    console.error("[ExpiryAlert] Unexpected error:", err);
    return { success: false, error: err.message };
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — MANUALLY TRIGGER EXPIRY ALERTS  →  POST /api/v1/whatsapp/trigger-expiry-alerts
// ═════════════════════════════════════════════════════════════════════════════

const triggerExpiryAlerts = async (req, res) => {
  try {
    const days = parseInt(req.body.days);

    if (![1, 3].includes(days)) {
      return res.status(400).json({
        success: false,
        message: "days must be 1 or 3",
      });
    }

    const result = await sendMembershipExpiryAlerts(days);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send expiry alerts",
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Expiry alerts triggered for memberships expiring in ${days} day(s)`,
      data: {
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors?.length > 0 ? result.errors : undefined,
      },
    });
  } catch (err) {
    console.error("[TriggerExpiryAlerts] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
  sendToUser,
  sendBulk,
  broadcast,
  retryFailed,
  getAllNotifications,
  getMyNotifications,
  getStats,
  deleteNotification,
  sendMembershipExpiryAlerts,
  triggerExpiryAlerts,
};