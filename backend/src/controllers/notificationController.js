// controllers/notificationController.js

const supabase = require("../config/supabaseClient");

// ═════════════════════════════════════════════════════════════════════════════
// USER — GET MY NOTIFICATIONS
// Returns all notifications targeted at this user (broadcast + personal)
// with read status merged in
// ═════════════════════════════════════════════════════════════════════════════

const getMyNotifications = async (req, res) => {
  try {
    const user_id = req.user.id;
    const role = req.user.role;
    const { page = 1, limit = 20, unread_only } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch notifications meant for this user:
    // 1. Broadcast to all   (target_type = 'all')
    // 2. Role-targeted      (target_role = user's role)
    // 3. Personal           (target_type = 'user' AND user_id = this user)
    let query = supabase
      .from("notifications")
      .select(`
        id, title, message, type, action_url, created_at, scheduled_at, gym_id,
        target_type, target_role,
        notification_reads ( id, read_at )
      `, { count: "exact" })
      .eq("is_active", true)
      .or(`target_type.eq.all,and(target_type.eq.user,user_id.eq.${user_id})`)
      .lte("created_at", new Date().toISOString()) // don't show future scheduled
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GetMyNotifications] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }

    // Merge read status — notification_reads returns array, check if any match this user
    const notifications = data.map((n) => {
      const readRecord = n.notification_reads?.find((r) => r !== null);
      return {
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        action_url: n.action_url,
        created_at: n.created_at,
        scheduled_at: n.scheduled_at,
        gym_id: n.gym_id,
        is_read: !!readRecord,
        read_at: readRecord?.read_at || null,
      };
    });

    const filtered = unread_only === "true" ? notifications.filter((n) => !n.is_read) : notifications;
    const unread_count = notifications.filter((n) => !n.is_read).length;

    return res.status(200).json({
      success: true,
      count: filtered.length,
      unread_count,
      page: parseInt(page),
      total_pages: Math.ceil(count / parseInt(limit)),
      data: filtered,
    });
  } catch (err) {
    console.error("[GetMyNotifications] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// USER — MARK NOTIFICATION AS READ
// ═════════════════════════════════════════════════════════════════════════════

const markAsRead = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    // Verify notification exists and is accessible to this user
    const { data: notif, error: notifError } = await supabase
      .from("notifications")
      .select("id, target_type, user_id")
      .eq("id", parseInt(id))
      .eq("is_active", true)
      .maybeSingle();

    if (notifError || !notif) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    // Only allow marking if notification targets this user
    const isTargeted =
      notif.target_type === "all" ||
      (notif.target_type === "user" && notif.user_id === user_id);

    if (!isTargeted) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Upsert read record (unique constraint handles duplicates)
    const { error } = await supabase
      .from("notification_reads")
      .upsert(
        [{ notification_id: parseInt(id), user_id, read_at: new Date().toISOString() }],
        { onConflict: "notification_id,user_id" }
      );

    if (error) {
      console.error("[MarkAsRead] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to mark as read" });
    }

    return res.status(200).json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error("[MarkAsRead] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// USER — MARK ALL AS READ
// ═════════════════════════════════════════════════════════════════════════════

const markAllAsRead = async (req, res) => {
  try {
    const user_id = req.user.id;

    // Get all unread notifications for this user
    const { data: notifs, error: fetchError } = await supabase
      .from("notifications")
      .select("id")
      .eq("is_active", true)
      .or(`target_type.eq.all,and(target_type.eq.user,user_id.eq.${user_id})`);

    if (fetchError) {
      console.error("[MarkAllAsRead] Fetch error:", fetchError);
      return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }

    if (!notifs || notifs.length === 0) {
      return res.status(200).json({ success: true, message: "No notifications to mark" });
    }

    // Get already-read notification IDs
    const { data: alreadyRead } = await supabase
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", user_id);

    const readIds = new Set((alreadyRead || []).map((r) => r.notification_id));

    const unreadRecords = notifs
      .filter((n) => !readIds.has(n.id))
      .map((n) => ({
        notification_id: n.id,
        user_id,
        read_at: new Date().toISOString(),
      }));

    if (unreadRecords.length === 0) {
      return res.status(200).json({ success: true, message: "All notifications already read" });
    }

    const { error } = await supabase
      .from("notification_reads")
      .upsert(unreadRecords, { onConflict: "notification_id,user_id" });

    if (error) {
      console.error("[MarkAllAsRead] Upsert error:", error);
      return res.status(500).json({ success: false, message: "Failed to mark all as read" });
    }

    return res.status(200).json({
      success: true,
      message: `${unreadRecords.length} notification(s) marked as read`,
    });
  } catch (err) {
    console.error("[MarkAllAsRead] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// USER — GET UNREAD COUNT
// ═════════════════════════════════════════════════════════════════════════════

const getUnreadCount = async (req, res) => {
  try {
    const user_id = req.user.id;

    const { data: notifs } = await supabase
      .from("notifications")
      .select("id")
      .eq("is_active", true)
      .or(`target_type.eq.all,and(target_type.eq.user,user_id.eq.${user_id})`);

    const { data: readRecords } = await supabase
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", user_id);

    const readIds = new Set((readRecords || []).map((r) => r.notification_id));
    const unread_count = (notifs || []).filter((n) => !readIds.has(n.id)).length;

    return res.status(200).json({ success: true, unread_count });
  } catch (err) {
    console.error("[GetUnreadCount] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — CREATE NOTIFICATION
// ═════════════════════════════════════════════════════════════════════════════

const createNotification = async (req, res) => {
  try {
    let {
      title, message, type = "info", target_type, user_id,
      gym_id, target_role, action_url, scheduled_at,
    } = req.body;

    title = title?.trim();
    message = message?.trim();

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "title and message are required" });
    }

    const validTypes = ["info", "success", "warning", "error"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `type must be one of: ${validTypes.join(", ")}` });
    }

    const validTargetTypes = ["all", "user"];
    if (!target_type || !validTargetTypes.includes(target_type)) {
      return res.status(400).json({ success: false, message: `target_type must be one of: ${validTargetTypes.join(", ")}` });
    }

    if (target_type === "user" && !user_id) {
      return res.status(400).json({ success: false, message: "user_id is required when target_type is 'user'" });
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert([{
        title,
        message,
        type,
        target_type,
        user_id: target_type === "user" ? parseInt(user_id) : null,
        gym_id: gym_id ? parseInt(gym_id) : null,
        target_role: target_role || null,
        action_url: action_url || null,
        scheduled_at: scheduled_at || null,
        is_active: true,
        created_by: req.user.id,
        updated_at: new Date().toISOString(),
      }])
      .select("*")
      .single();

    if (error) {
      console.error("[CreateNotification] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to create notification" });
    }

    return res.status(201).json({ success: true, message: "Notification created successfully", data });
  } catch (err) {
    console.error("[CreateNotification] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — GET ALL NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════════

const getAllNotifications = async (req, res) => {
  try {
    const { target_type, type, gym_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from("notifications")
      .select(`
        id, title, message, type, target_type, target_role, action_url,
        scheduled_at, is_active, created_at, updated_at,
        users!notifications_user_id_fkey ( id, name, phone ),
        gyms ( id, name )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (target_type) query = query.eq("target_type", target_type);
    if (type) query = query.eq("type", type);
    if (gym_id) query = query.eq("gym_id", parseInt(gym_id));

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
// ADMIN — UPDATE NOTIFICATION
// ═════════════════════════════════════════════════════════════════════════════

const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ["title", "message", "type", "action_url", "scheduled_at", "is_active", "target_role"];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("notifications")
      .update(updates)
      .eq("id", parseInt(id))
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[UpdateNotification] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to update notification" });
    }

    if (!data) return res.status(404).json({ success: false, message: "Notification not found" });

    return res.status(200).json({ success: true, message: "Notification updated", data });
  } catch (err) {
    console.error("[UpdateNotification] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — DELETE NOTIFICATION
// ═════════════════════════════════════════════════════════════════════════════

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", parseInt(id))
      .select("id, title")
      .maybeSingle();

    if (error) {
      console.error("[DeleteNotification] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete notification" });
    }

    if (!data) return res.status(404).json({ success: false, message: "Notification not found" });

    return res.status(200).json({ success: true, message: `Notification "${data.title}" deleted` });
  } catch (err) {
    console.error("[DeleteNotification] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — GET NOTIFICATION READ STATS
// ═════════════════════════════════════════════════════════════════════════════

const getNotificationStats = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: notif } = await supabase
      .from("notifications")
      .select("id, title, target_type")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (!notif) return res.status(404).json({ success: false, message: "Notification not found" });

    const { count: readCount } = await supabase
      .from("notification_reads")
      .select("id", { count: "exact", head: true })
      .eq("notification_id", parseInt(id));

    return res.status(200).json({
      success: true,
      data: {
        notification_id: notif.id,
        title: notif.title,
        target_type: notif.target_type,
        read_count: readCount || 0,
      },
    });
  } catch (err) {
    console.error("[GetNotificationStats] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification,
  getAllNotifications,
  updateNotification,
  deleteNotification,
  getNotificationStats,
};