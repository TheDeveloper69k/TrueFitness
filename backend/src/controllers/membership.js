exports.getPlans = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("is_active", true);

    if (error) throw error;

    res.json({ plans: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};