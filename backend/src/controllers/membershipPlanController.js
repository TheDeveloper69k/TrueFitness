const supabase = require("../config/supabaseClient");

// GET ALL PLANS
exports.getPlans = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("membership_plans")
      .select("*")
      
    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CREATE PLAN
exports.createPlan = async (req, res) => {
  try {
   const { name, price, duration_days, features } = req.body;

    const { data, error } = await supabase
      .from("membership_plans")
      .insert([
        {
          name,
          price,
          duration_days,
          features,
          is_active: true
        }
      ])
      .select();

    if (error) throw error;

    res.json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE PLAN
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, duration_days, is_active } = req.body;

    const { data, error } = await supabase
      .from("membership_plans")
      .update({
        name,
        price,
        duration_days,
        is_active
      })
      .eq("id", id)
      .select();

    if (error) throw error;

    res.json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE PLAN
exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("membership_plans")
      .delete()
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true, message: "Plan deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};