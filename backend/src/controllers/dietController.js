// ── TRUE FITNESS — DIET CONTROLLER ──

const supabase = require("../config/supabaseClient");

// ➕ ADD DIET
const addDiet = async (req, res) => {
  try {
    const { user_id, meal_type, food_name, calories, day } = req.body;

    if (!user_id || !meal_type || !food_name) {
      return res.status(400).json({
        ok: false,
        message: "user_id, meal_type, and food_name are required",
      });
    }

    const { data, error } = await supabase
      .from("diet_plans")
      .insert([
        { user_id, meal_type, food_name, calories, day },
      ])
      .select();

    if (error) {
      console.error("Add Diet Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({
      ok: true,
      message: "Diet added successfully",
      data,
    });

  } catch (err) {
    console.error("Server Error (addDiet):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// 📥 GET USER DIET
const getUserDiet = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from("diet_plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch Diet Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });

  } catch (err) {
    console.error("Server Error (getUserDiet):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// ❌ DELETE DIET
const deleteDiet = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("diet_plans")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete Diet Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({
      ok: true,
      message: "Diet deleted successfully",
    });

  } catch (err) {
    console.error("Server Error (deleteDiet):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};
// 📥 GET ALL DIETS (NEW)
const getAllDiet = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("diet_plans")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch All Diet Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });

  } catch (err) {
    console.error("Server Error (getAllDiet):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

module.exports = {
  addDiet,
  getUserDiet,
  deleteDiet,
  getAllDiet, // ✅ ADD THIS LINE
};