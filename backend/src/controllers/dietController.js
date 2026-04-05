// ── TRUE FITNESS — DIET CONTROLLER ──

const supabase = require("../config/supabaseClient");

// ➕ ADD FULL DAY DIET PLAN
const addDietPlan = async (req, res) => {
  try {
    const { user_id, day, slots } = req.body;

    if (!user_id || !day || !slots || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "user_id, day, and slots array are required",
      });
    }

    for (const slot of slots) {
      if (!slot.time || !slot.label || !slot.food_name) {
        return res.status(400).json({
          ok: false,
          message: "Each slot must have time, label, and food_name",
        });
      }
    }

    const { data, error } = await supabase
      .from("diet_plans")
      .insert([{ user_id, day, slots }])
      .select();

    if (error) {
      console.error("Add Diet Plan Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, message: "Diet plan added successfully", data });

  } catch (err) {
    console.error("Server Error (addDietPlan):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// 📥 GET ALL DIET PLANS
const getAllDietPlans = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("diet_plans")
      .select("*, users(name, phone)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch All Diet Plans Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });

  } catch (err) {
    console.error("Server Error (getAllDietPlans):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// 📥 GET USER DIET PLANS
const getUserDietPlans = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from("diet_plans")
      .select("*, users(name, phone)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch User Diet Plans Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });

  } catch (err) {
    console.error("Server Error (getUserDietPlans):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// ✏️ UPDATE DIET PLAN
const updateDietPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { day, slots } = req.body;

    if (!day && !slots) {
      return res.status(400).json({
        ok: false,
        message: "Provide at least day or slots to update",
      });
    }

    if (slots) {
      for (const slot of slots) {
        if (!slot.time || !slot.label || !slot.food_name) {
          return res.status(400).json({
            ok: false,
            message: "Each slot must have time, label, and food_name",
          });
        }
      }
    }

    const updates = {};
    if (day) updates.day = day;
    if (slots) updates.slots = slots;

    const { data, error } = await supabase
      .from("diet_plans")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Update Diet Plan Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, message: "Diet plan updated successfully", data });

  } catch (err) {
    console.error("Server Error (updateDietPlan):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// ❌ DELETE DIET PLAN
const deleteDietPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("diet_plans")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete Diet Plan Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, message: "Diet plan deleted successfully" });

  } catch (err) {
    console.error("Server Error (deleteDietPlan):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

module.exports = {
  addDietPlan,
  getAllDietPlans,
  getUserDietPlans,
  updateDietPlan,
  deleteDietPlan,
};