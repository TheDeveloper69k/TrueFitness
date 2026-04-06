// ── TRUE FITNESS — WORKOUT CONTROLLER ──

const supabase = require("../config/supabaseClient");

// ➕ ADD WORKOUT ENTRY
const addWorkout = async (req, res) => {
  try {
    const { user_id, day, exercise_name, muscle_group, sets, duration } = req.body;

    if (!user_id || !day || !exercise_name) {
      return res.status(400).json({
        ok: false,
        message: "user_id, day, and exercise_name are required",
      });
    }

    const { data, error } = await supabase
      .from("workout_plans")
      .insert([{ user_id, day, exercise_name, muscle_group, sets, duration }])
      .select();

    if (error) {
      console.error("Add Workout Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, message: "Workout added successfully", data });
  } catch (err) {
    console.error("Server Error (addWorkout):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// 📥 GET USER WORKOUT
const getUserWorkout = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch Workout Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });
  } catch (err) {
    console.error("Server Error (getUserWorkout):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// 📥 GET ALL WORKOUTS (admin)
const getAllWorkouts = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("workout_plans")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch All Workouts Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });
  } catch (err) {
    console.error("Server Error (getAllWorkouts):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// ❌ DELETE WORKOUT ENTRY
const deleteWorkout = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("workout_plans")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete Workout Error:", error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, message: "Workout deleted successfully" });
  } catch (err) {
    console.error("Server Error (deleteWorkout):", err.message);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

module.exports = {
  addWorkout,
  getUserWorkout,
  deleteWorkout,
  getAllWorkouts,
};