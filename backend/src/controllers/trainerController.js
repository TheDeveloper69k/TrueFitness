const supabase = require("../config/supabaseClient");

const isValidId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

// GET ALL TRAINERS
const getAllTrainers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from("trainers")
      .select("*", { count: "exact" })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.active === "true") query = query.eq("is_active", true);
    if (req.query.active === "false") query = query.eq("is_active", false);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GetAllTrainers] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch trainers" });
    }

    return res.status(200).json({
      success: true,
      page,
      count: count || 0,
      total_pages: Math.ceil((count || 0) / limit),
      data: data || [],
    });
  } catch (err) {
    console.error("[GetAllTrainers] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET SINGLE TRAINER
const getTrainer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid trainer id" });
    }

    const { data, error } = await supabase
      .from("trainers")
      .select("*")
      .eq("id", Number(id))
      .maybeSingle();

    if (error) {
      console.error("[GetTrainer] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch trainer" });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "Trainer not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("[GetTrainer] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// CREATE TRAINER
const createTrainer = async (req, res) => {
  try {
    let { name, specialization, experience, phone } = req.body;

    name = String(name || "").trim();
    specialization = specialization ? String(specialization).trim() : null;
    phone = phone ? String(phone).trim() : null;

    if (!name) {
      return res.status(400).json({ success: false, message: "Trainer name is required" });
    }

    if (experience === undefined || experience === null || experience === "") {
      experience = 0;
    } else {
      experience = Number(experience);
      if (!Number.isInteger(experience) || experience < 0) {
        return res.status(400).json({
          success: false,
          message: "Experience must be a non-negative integer",
        });
      }
    }

    if (phone) {
      const { data: existingPhone, error: phoneError } = await supabase
        .from("trainers")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (phoneError) {
        console.error("[CreateTrainer] Phone validation error:", phoneError);
        return res.status(500).json({
          success: false,
          message: "Failed to validate trainer phone",
        });
      }

      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message: "Trainer with this phone already exists",
        });
      }
    }

    const payload = {
      name,
      specialization,
      experience,
      phone,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("trainers")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      console.error("[CreateTrainer] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to create trainer" });
    }

    return res.status(201).json({
      success: true,
      message: "Trainer created successfully",
      data,
    });
  } catch (err) {
    console.error("[CreateTrainer] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// UPDATE TRAINER
const updateTrainer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid trainer id" });
    }

    const updates = {};

    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Trainer name cannot be empty",
        });
      }
      updates.name = name;
    }

    if (req.body.specialization !== undefined) {
      updates.specialization = req.body.specialization
        ? String(req.body.specialization).trim()
        : null;
    }

    if (req.body.phone !== undefined) {
      updates.phone = req.body.phone ? String(req.body.phone).trim() : null;

      if (updates.phone) {
        const { data: existingPhone, error: phoneError } = await supabase
          .from("trainers")
          .select("id")
          .eq("phone", updates.phone)
          .neq("id", Number(id))
          .maybeSingle();

        if (phoneError) {
          console.error("[UpdateTrainer] Phone validation error:", phoneError);
          return res.status(500).json({
            success: false,
            message: "Failed to validate trainer phone",
          });
        }

        if (existingPhone) {
          return res.status(409).json({
            success: false,
            message: "Another trainer already uses this phone",
          });
        }
      }
    }

    if (req.body.experience !== undefined) {
      const exp = Number(req.body.experience);
      if (!Number.isInteger(exp) || exp < 0) {
        return res.status(400).json({
          success: false,
          message: "Experience must be a non-negative integer",
        });
      }
      updates.experience = exp;
    }

    if (req.body.is_active !== undefined) {
      updates.is_active = Boolean(req.body.is_active);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided" });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("trainers")
      .update(updates)
      .eq("id", Number(id))
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[UpdateTrainer] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to update trainer" });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "Trainer not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Trainer updated successfully",
      data,
    });
  } catch (err) {
    console.error("[UpdateTrainer] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// TOGGLE TRAINER STATUS
const toggleTrainerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid trainer id" });
    }

    const { data: trainer, error: fetchError } = await supabase
      .from("trainers")
      .select("*")
      .eq("id", Number(id))
      .maybeSingle();

    if (fetchError) {
      console.error("[ToggleTrainerStatus] Fetch error:", fetchError);
      return res.status(500).json({ success: false, message: "Failed to fetch trainer" });
    }

    if (!trainer) {
      return res.status(404).json({ success: false, message: "Trainer not found" });
    }

    const { data, error } = await supabase
      .from("trainers")
      .update({
        is_active: !trainer.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      console.error("[ToggleTrainerStatus] Update error:", error);
      return res.status(500).json({ success: false, message: "Failed to toggle trainer status" });
    }

    return res.status(200).json({
      success: true,
      message: `Trainer ${data.is_active ? "activated" : "deactivated"} successfully`,
      data,
    });
  } catch (err) {
    console.error("[ToggleTrainerStatus] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// DELETE TRAINER
const deleteTrainer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid trainer id" });
    }

    const { data: trainer, error: fetchError } = await supabase
      .from("trainers")
      .select("id")
      .eq("id", Number(id))
      .maybeSingle();

    if (fetchError) {
      console.error("[DeleteTrainer] Fetch error:", fetchError);
      return res.status(500).json({ success: false, message: "Failed to fetch trainer" });
    }

    if (!trainer) {
      return res.status(404).json({ success: false, message: "Trainer not found" });
    }

    const { error } = await supabase.from("trainers").delete().eq("id", Number(id));

    if (error) {
      console.error("[DeleteTrainer] Delete error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete trainer" });
    }

    return res.status(200).json({
      success: true,
      message: "Trainer deleted successfully",
    });
  } catch (err) {
    console.error("[DeleteTrainer] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ASSIGN TRAINER TO MEMBER
const assignTrainerToMember = async (req, res) => {
  try {
    let { member_id, trainer_id } = req.body;

    if (!isValidId(member_id) || !isValidId(trainer_id)) {
      return res.status(400).json({
        success: false,
        message: "Valid member_id and trainer_id are required",
      });
    }

    member_id = Number(member_id);
    trainer_id = Number(trainer_id);

    const { data: member, error: memberError } = await supabase
      .from("users")
      .select("id, name, phone, role")
      .eq("id", member_id)
      .maybeSingle();

    if (memberError) {
      console.error("[AssignTrainerToMember] Member fetch error:", memberError);
      return res.status(500).json({ success: false, message: "Failed to validate member" });
    }

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("*")
      .eq("id", trainer_id)
      .eq("is_active", true)
      .maybeSingle();

    if (trainerError) {
      console.error("[AssignTrainerToMember] Trainer fetch error:", trainerError);
      return res.status(500).json({ success: false, message: "Failed to validate trainer" });
    }

    if (!trainer) {
      return res.status(404).json({ success: false, message: "Active trainer not found" });
    }

    const { data: existingAssignment, error: existingError } = await supabase
      .from("member_trainers")
      .select("*")
      .eq("member_id", member_id)
      .maybeSingle();

    if (existingError) {
      console.error("[AssignTrainerToMember] Existing assignment error:", existingError);
      return res.status(500).json({
        success: false,
        message: "Failed to check existing trainer assignment",
      });
    }

    if (existingAssignment) {
      if (Number(existingAssignment.trainer_id) === trainer_id) {
        return res.status(200).json({
          success: true,
          message: "Member is already assigned to this trainer",
          data: existingAssignment,
        });
      }

      const { error: updateOldError } = await supabase
        .from("member_trainers")
        .update({
          trainer_id,
          assigned_at: new Date().toISOString(),
          is_active: true,
        })
        .eq("member_id", member_id);

      if (updateOldError) {
        console.error("[AssignTrainerToMember] Reassign error:", updateOldError);
        return res.status(500).json({ success: false, message: "Failed to reassign trainer" });
      }

      const { data: updatedAssignment, error: fetchUpdatedError } = await supabase
        .from("member_trainers")
        .select("*")
        .eq("member_id", member_id)
        .maybeSingle();

      if (fetchUpdatedError) {
        console.error("[AssignTrainerToMember] Fetch updated assignment error:", fetchUpdatedError);
      }

      return res.status(200).json({
        success: true,
        message: "Trainer reassigned successfully",
        data: updatedAssignment,
      });
    }

    const payload = {
      member_id,
      trainer_id,
      assigned_at: new Date().toISOString(),
      is_active: true,
    };

    const { data, error } = await supabase
      .from("member_trainers")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      console.error("[AssignTrainerToMember] Insert error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to assign trainer to member",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Trainer assigned successfully",
      data,
    });
  } catch (err) {
    console.error("[AssignTrainerToMember] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET MEMBER'S TRAINER
const getMemberTrainer = async (req, res) => {
  try {
    const { memberId } = req.params;

    if (!isValidId(memberId)) {
      return res.status(400).json({ success: false, message: "Invalid member id" });
    }

    const { data, error } = await supabase
      .from("member_trainers")
      .select(`
        id,
        member_id,
        trainer_id,
        assigned_at,
        is_active,
        trainers (
          id,
          name,
          specialization,
          experience,
          phone,
          is_active
        )
      `)
      .eq("member_id", Number(memberId))
      .maybeSingle();

    if (error) {
      console.error("[GetMemberTrainer] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch member trainer" });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "No trainer assigned to this member" });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("[GetMemberTrainer] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// REMOVE TRAINER FROM MEMBER
const removeTrainerFromMember = async (req, res) => {
  try {
    const { memberId } = req.params;

    if (!isValidId(memberId)) {
      return res.status(400).json({ success: false, message: "Invalid member id" });
    }

    const { data: assignment, error: fetchError } = await supabase
      .from("member_trainers")
      .select("*")
      .eq("member_id", Number(memberId))
      .maybeSingle();

    if (fetchError) {
      console.error("[RemoveTrainerFromMember] Fetch error:", fetchError);
      return res.status(500).json({ success: false, message: "Failed to fetch assignment" });
    }

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "No trainer assignment found for this member",
      });
    }

    const { error } = await supabase
      .from("member_trainers")
      .delete()
      .eq("member_id", Number(memberId));

    if (error) {
      console.error("[RemoveTrainerFromMember] Delete error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to remove trainer from member",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Trainer removed from member successfully",
    });
  } catch (err) {
    console.error("[RemoveTrainerFromMember] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET ALL MEMBERS OF A TRAINER
const getTrainerMembers = async (req, res) => {
  try {
    const { trainerId } = req.params;

    if (!isValidId(trainerId)) {
      return res.status(400).json({ success: false, message: "Invalid trainer id" });
    }

    const { data, error } = await supabase
      .from("member_trainers")
      .select(`
        id,
        member_id,
        trainer_id,
        assigned_at,
        is_active,
        users!member_trainers_member_id_fkey (
          id,
          name,
          email,
          phone,
          role
        )
      `)
      .eq("trainer_id", Number(trainerId))
      .order("assigned_at", { ascending: false });

    if (error) {
      console.error("[GetTrainerMembers] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch trainer members" });
    }

    return res.status(200).json({
      success: true,
      count: data?.length || 0,
      data: data || [],
    });
  } catch (err) {
    console.error("[GetTrainerMembers] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET TRAINER STATS
const getTrainerStats = async (req, res) => {
  try {
    const { count: total, error: totalError } = await supabase
      .from("trainers")
      .select("id", { count: "exact", head: true });

    if (totalError) {
      console.error("[GetTrainerStats] Total error:", totalError);
      return res.status(500).json({ success: false, message: "Failed to fetch stats" });
    }

    const { count: active, error: activeError } = await supabase
      .from("trainers")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    if (activeError) {
      console.error("[GetTrainerStats] Active error:", activeError);
      return res.status(500).json({ success: false, message: "Failed to fetch stats" });
    }

    const { count: assignedMembers, error: assignError } = await supabase
      .from("member_trainers")
      .select("id", { count: "exact", head: true });

    if (assignError) {
      console.error("[GetTrainerStats] Assignment error:", assignError);
      return res.status(500).json({ success: false, message: "Failed to fetch stats" });
    }

    return res.status(200).json({
      success: true,
      data: {
        total: total || 0,
        active: active || 0,
        inactive: (total || 0) - (active || 0),
        assigned_members: assignedMembers || 0,
      },
    });
  } catch (err) {
    console.error("[GetTrainerStats] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getAllTrainers,
  getTrainer,
  createTrainer,
  updateTrainer,
  toggleTrainerStatus,
  deleteTrainer,
  getTrainerStats,
  assignTrainerToMember,
  getMemberTrainer,
  removeTrainerFromMember,
  getTrainerMembers,
};