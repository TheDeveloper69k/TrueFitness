const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient'); // adjust path if needed

// GET all gym plans (admin view — with user info)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('gym_plans')
      .select('*, users(name, phone)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET gym plans for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('gym_plans')
      .select('*, users(name, phone)')
      .eq('user_id', req.params.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create a new gym plan
router.post('/', async (req, res) => {
  try {
    const { user_id, week_label, days } = req.body;

    if (!user_id) return res.status(400).json({ success: false, message: 'user_id is required' });
    if (!days || typeof days !== 'object') return res.status(400).json({ success: false, message: 'days is required' });

    const { data, error } = await supabase
      .from('gym_plans')
      .insert([{ user_id, week_label: week_label || null, days }])
      .select('*, users(name, phone)');

    if (error) throw error;
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update a gym plan
router.put('/:id', async (req, res) => {
  try {
    const { week_label, days } = req.body;

    const updates = {};
    if (week_label !== undefined) updates.week_label = week_label;
    if (days !== undefined) updates.days = days;

    const { data, error } = await supabase
      .from('gym_plans')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, users(name, phone)');

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE a gym plan
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('gym_plans')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Gym plan deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;