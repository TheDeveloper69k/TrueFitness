const supabase = require("../config/supabaseClient");

// ─── Helpers ─────────────────────────────────────────────────────────────────
const slugify = (text) =>
  text.toString().toLowerCase().trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");

// ─── GET all gyms ────────────────────────────────────────────────────────────
const getAllGyms = async (req, res) => {
  try {
    const { active } = req.query;

    let query = supabase
      .from("gyms")
      .select("id, name, location, description, image_url, slug, phone, email, opening_hours, is_active, created_at")
      .order("created_at", { ascending: false });

    if (active === "true") query = query.eq("is_active", true);

    const { data, error } = await query;

    if (error) {
      console.error("[GetAllGyms] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch gyms" });
    }

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    console.error("[GetAllGyms] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── GET single gym ──────────────────────────────────────────────────────────
const getGym = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const isId = /^\d+$/.test(idOrSlug);

    const { data, error } = await supabase
      .from("gyms")
      .select("id, name, location, description, image_url, slug, phone, email, opening_hours, is_active, created_at, updated_at")
      [isId ? "eq" : "eq"](isId ? "id" : "slug", isId ? parseInt(idOrSlug) : idOrSlug)
      .maybeSingle();

    if (error) {
      console.error("[GetGym] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch gym" });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("[GetGym] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── CREATE gym ──────────────────────────────────────────────────────────────
const createGym = async (req, res) => {
  try {
    let { name, location, description, image_url, phone, email, opening_hours } = req.body;

    name = name?.trim();
    location = location?.trim();

    if (!name || !location) {
      return res.status(400).json({ success: false, message: "Name and location are required" });
    }

    let slug = slugify(name);

    const { data: existing } = await supabase
      .from("gyms")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) slug = `${slug}-${Date.now()}`;

    if (opening_hours && typeof opening_hours === "string") {
      try {
        opening_hours = JSON.parse(opening_hours);
      } catch {
        return res.status(400).json({ success: false, message: "opening_hours must be valid JSON" });
      }
    }

    const { data, error } = await supabase
      .from("gyms")
      .insert([{ name, location, description, image_url, phone, email, opening_hours, slug }])
      .select("id, name, location, description, image_url, slug, phone, email, opening_hours, is_active, created_at")
      .single();

    if (error) {
      console.error("[CreateGym] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to create gym" });
    }

    return res.status(201).json({ success: true, message: "Gym created successfully", data });
  } catch (err) {
    console.error("[CreateGym] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── UPDATE gym ──────────────────────────────────────────────────────────────
const updateGym = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ["name", "location", "description", "image_url", "phone", "email", "opening_hours", "is_active"];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided to update" });
    }

    if (updates.name) {
      let slug = slugify(updates.name);
      const { data: existing } = await supabase
        .from("gyms")
        .select("id")
        .eq("slug", slug)
        .neq("id", parseInt(id))
        .maybeSingle();

      if (existing) slug = `${slug}-${Date.now()}`;
      updates.slug = slug;
    }

    if (updates.opening_hours && typeof updates.opening_hours === "string") {
      try {
        updates.opening_hours = JSON.parse(updates.opening_hours);
      } catch {
        return res.status(400).json({ success: false, message: "opening_hours must be valid JSON" });
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("gyms")
      .update(updates)
      .eq("id", parseInt(id))
      .select("id, name, location, description, image_url, slug, phone, email, opening_hours, is_active, updated_at")
      .maybeSingle();

    if (error) {
      console.error("[UpdateGym] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to update gym" });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    return res.status(200).json({ success: true, message: "Gym updated successfully", data });
  } catch (err) {
    console.error("[UpdateGym] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── TOGGLE gym status ───────────────────────────────────────────────────────
const toggleGymStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: gym, error: fetchError } = await supabase
      .from("gyms")
      .select("id, is_active")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (fetchError || !gym) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    const { data, error } = await supabase
      .from("gyms")
      .update({ is_active: !gym.is_active, updated_at: new Date().toISOString() })
      .eq("id", parseInt(id))
      .select("id, name, is_active")
      .single();

    if (error) {
      console.error("[ToggleGymStatus] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to update gym status" });
    }

    return res.status(200).json({
      success: true,
      message: `Gym ${data.is_active ? "activated" : "deactivated"} successfully`,
      data,
    });
  } catch (err) {
    console.error("[ToggleGymStatus] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── DELETE gym ──────────────────────────────────────────────────────────────
const deleteGym = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("gyms")
      .delete()
      .eq("id", parseInt(id))
      .select("id, name")
      .maybeSingle();

    if (error) {
      console.error("[DeleteGym] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete gym" });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    return res.status(200).json({
      success: true,
      message: `Gym "${data.name}" deleted successfully`,
    });
  } catch (err) {
    console.error("[DeleteGym] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── GET gym stats ───────────────────────────────────────────────────────────
const getGymStats = async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = parseInt(id);

    const { data: gym, error: gymError } = await supabase
      .from("gyms")
      .select("id, name")
      .eq("id", gymId)
      .maybeSingle();

    if (gymError || !gym) {
      return res.status(404).json({
        success: false,
        message: "Gym not found",
      });
    }

    const { count: totalMembers, error: totalError } = await supabase
      .from("user_memberships")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId);

    if (totalError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch total members",
        error: totalError.message,
      });
    }

    const { count: activeMembers, error: activeError } = await supabase
      .from("user_memberships")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .eq("status", "active");

    if (activeError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch active members",
        error: activeError.message,
      });
    }

    const { count: expiredMembers, error: expiredError } = await supabase
      .from("user_memberships")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .eq("status", "expired");

    if (expiredError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch expired members",
        error: expiredError.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        gym_id: gym.id,
        gym_name: gym.name,
        total_members: totalMembers || 0,
        active_members: activeMembers || 0,
        expired_members: expiredMembers || 0,
      },
    });
  } catch (err) {
    console.error("[GetGymStats] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAllGyms,
  getGym,
  createGym,
  updateGym,
  toggleGymStatus,
  deleteGym,
  getGymStats,
};