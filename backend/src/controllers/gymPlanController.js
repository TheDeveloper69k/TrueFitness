// ── TRUE FITNESS — GYM PLAN CONTROLLER ──

const supabase = require("../config/supabaseClient");

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ➕ ADD GYM PLAN
// Body: { user_id, week_label, days: { Monday: [...exercises], Tuesday: [...] } }
const addGymPlan = async (req, res) => {
  try {
    const { user_id, week_label, days } = req.body;

    if (!user_id || !days || typeof days !== "object") {
      return res.status(400).json({
        ok: false,
        message: "user_id and days object are required",
      });
    }

    // Validate each day's exercises
    for (const day of Object.keys(days)) {
      if (!DAYS.includes(day)) {
        return res.status(400).json({
          ok: false,
          message: `Invalid day: ${day}. Must be one of ${DAYS.join(", ")}`,
        });
      }

      const exercises = days[day];
      if (!Array.isArray(exercises)) {
        return res.status(400).json({
          ok: false,
          message: `Exercises for ${day} must be an array`,
        });
      }

      for (const ex of exercises) {
        if (!ex.name) {
          return res.status(400).json({
            ok: false,
            message: `Each exercise in ${day} must have a name`,
          });
        }
      }
    }

    const { data, error } = await supabase
      .from("gym_plans")
      .insert([{ user_id, week_label: week_label || null, days }])
      .select();

    if (error) {
      console.error("Add Gym Plan Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, message: "Gym plan added successfully", data });

  } catch (err) {
    console.error("Server Error (addGymPlan):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// 📥 GET ALL GYM PLANS
const getAllGymPlans = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("gym_plans")
      .select("*, users(name, phone)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch All Gym Plans Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });

  } catch (err) {
    console.error("Server Error (getAllGymPlans):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// 📥 GET USER GYM PLANS
const getUserGymPlans = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from("gym_plans")
      .select("*, users(name, phone)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch User Gym Plans Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });

  } catch (err) {
    console.error("Server Error (getUserGymPlans):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// ✏️ UPDATE GYM PLAN
const updateGymPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { week_label, days } = req.body;

    if (!week_label && !days) {
      return res.status(400).json({
        ok: false,
        message: "Provide at least week_label or days to update",
      });
    }

    const updates = {};
    if (week_label) updates.week_label = week_label;
    if (days) updates.days = days;

    const { data, error } = await supabase
      .from("gym_plans")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Update Gym Plan Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, message: "Gym plan updated successfully", data });

  } catch (err) {
    console.error("Server Error (updateGymPlan):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// ❌ DELETE GYM PLAN
const deleteGymPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("gym_plans")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete Gym Plan Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, message: "Gym plan deleted successfully" });

  } catch (err) {
    console.error("Server Error (deleteGymPlan):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

module.exports = {
  addGymPlan,
  getAllGymPlans,
  getUserGymPlans,
  updateGymPlan,
  deleteGymPlan,
};