// controllers/paymentController.js

const Razorpay = require("razorpay");
const crypto = require("crypto");
const supabase = require("../config/supabaseClient");

// ─── Razorpay lazy getter ─────────────────────────────────────────────────────
// Instantiate inside requests so env vars are guaranteed loaded

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// CREATE ORDER  →  POST /api/v1/payments/create-order
// Called before showing Razorpay checkout on frontend
// ═════════════════════════════════════════════════════════════════════════════

const createOrder = async (req, res) => {
  try {
    const { plan_id, gym_id } = req.body;
    const user_id = req.user.id;

    if (!plan_id || !gym_id) {
      return res.status(400).json({ success: false, message: "plan_id and gym_id are required" });
    }

    // Fetch plan for amount
    const { data: plan, error: planError } = await supabase
      .from("membership_plans")
      .select("id, name, price, is_active")
      .eq("id", parseInt(plan_id))
      .maybeSingle();

    if (planError || !plan) {
      return res.status(404).json({ success: false, message: "Membership plan not found" });
    }

    if (!plan.is_active) {
      return res.status(400).json({ success: false, message: "This plan is currently inactive" });
    }

    // Verify gym exists
    const { data: gym, error: gymError } = await supabase
      .from("gyms")
      .select("id, name, is_active")
      .eq("id", parseInt(gym_id))
      .maybeSingle();

    if (gymError || !gym) {
      return res.status(404).json({ success: false, message: "Gym not found" });
    }

    if (!gym.is_active) {
      return res.status(400).json({ success: false, message: "This gym is currently inactive" });
    }

    // Amount in paise (Razorpay requires smallest currency unit)
    const amountInPaise = Math.round(parseFloat(plan.price) * 100);

    // Create Razorpay order
    const razorpayOrder = await getRazorpay().orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_user${user_id}_plan${plan_id}_${Date.now()}`,
      notes: {
        user_id: String(user_id),
        plan_id: String(plan_id),
        gym_id: String(gym_id),
        plan_name: plan.name,
        gym_name: gym.name,
      },
    });

    // Save pending payment record in DB
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert([{
        user_id,
        plan_id: parseInt(plan_id),
        gym_id: parseInt(gym_id),
        amount: plan.price,
        currency: "INR",
        payment_method: "razorpay",
        status: "pending",
        razorpay_order_id: razorpayOrder.id,
        updated_at: new Date().toISOString(),
      }])
      .select("id, amount, status, razorpay_order_id")
      .single();

    if (paymentError) {
      console.error("[CreateOrder] DB insert error:", paymentError);
      return res.status(500).json({ success: false, message: "Failed to create payment record" });
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        payment_id: payment.id,
        razorpay_order_id: razorpayOrder.id,
        amount: amountInPaise,
        currency: "INR",
        key_id: process.env.RAZORPAY_KEY_ID, // needed by frontend Razorpay SDK
        plan: { id: plan.id, name: plan.name, price: plan.price },
        gym: { id: gym.id, name: gym.name },
      },
    });
  } catch (err) {
    console.error("[CreateOrder] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// VERIFY PAYMENT  →  POST /api/v1/payments/verify
// Called after Razorpay checkout succeeds on frontend
// ═════════════════════════════════════════════════════════════════════════════

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required" });
    }

    // Verify signature — prevents payment tampering
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      // Mark payment as failed in DB
      await supabase
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("razorpay_order_id", razorpay_order_id);

      return res.status(400).json({ success: false, message: "Payment verification failed — invalid signature" });
    }

    // Fetch our pending payment record
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, user_id, plan_id, gym_id, amount, status")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (fetchError || !payment) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    if (payment.status === "success") {
      return res.status(409).json({ success: false, message: "Payment already verified" });
    }

    // Update payment to success
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: "success",
        transaction_id: razorpay_payment_id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (updateError) {
      console.error("[VerifyPayment] Update error:", updateError);
      return res.status(500).json({ success: false, message: "Failed to update payment status" });
    }

    // Auto-assign membership after successful payment
    const { data: plan } = await supabase
      .from("membership_plans")
      .select("duration_days")
      .eq("id", payment.plan_id)
      .maybeSingle();

    if (plan) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.duration_days);

      // Expire existing active memberships
      await supabase
        .from("user_memberships")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("user_id", payment.user_id)
        .eq("status", "active");

      // Create new membership
      await supabase
        .from("user_memberships")
        .insert([{
          user_id: payment.user_id,
          plan_id: payment.plan_id,
          gym_id: payment.gym_id,
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          status: "active",
          payment_id: razorpay_payment_id,
          amount_paid: payment.amount,
          updated_at: new Date().toISOString(),
        }]);
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified and membership activated",
      data: {
        payment_id: payment.id,
        transaction_id: razorpay_payment_id,
        amount: payment.amount,
        status: "success",
      },
    });
  } catch (err) {
    console.error("[VerifyPayment] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET MY PAYMENTS  →  GET /api/v1/payments/me
// ═════════════════════════════════════════════════════════════════════════════

const getMyPayments = async (req, res) => {
  try {
    const user_id = req.user.id;

    const { data, error } = await supabase
      .from("payments")
      .select(`
        id, amount, currency, status, payment_method, transaction_id,
        razorpay_order_id, paid_at, payment_date, updated_at,
        membership_plans ( id, name, duration_days ),
        gyms ( id, name, location )
      `)
      .eq("user_id", user_id)
      .order("payment_date", { ascending: false });

    if (error) {
      console.error("[GetMyPayments] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch payments" });
    }

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    console.error("[GetMyPayments] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET ALL PAYMENTS (admin)  →  GET /api/v1/payments
// ═════════════════════════════════════════════════════════════════════════════

const getAllPayments = async (req, res) => {
  try {
    const { status, gym_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from("payments")
      .select(`
        id, amount, currency, status, payment_method, transaction_id,
        razorpay_order_id, refund_id, refund_reason, paid_at, payment_date, updated_at,
        users ( id, name, phone, email ),
        membership_plans ( id, name ),
        gyms ( id, name )
      `, { count: "exact" })
      .order("payment_date", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq("status", status);
    if (gym_id) query = query.eq("gym_id", parseInt(gym_id));

    const { data, error, count } = await query;

    if (error) {
      console.error("[GetAllPayments] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch payments" });
    }

    return res.status(200).json({
      success: true,
      count,
      page: parseInt(page),
      total_pages: Math.ceil(count / parseInt(limit)),
      data,
    });
  } catch (err) {
    console.error("[GetAllPayments] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET SINGLE PAYMENT (admin)  →  GET /api/v1/payments/:id
// ═════════════════════════════════════════════════════════════════════════════

const getPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("payments")
      .select(`
        id, amount, currency, status, payment_method, transaction_id,
        razorpay_order_id, refund_id, refund_reason, paid_at, payment_date, updated_at,
        users ( id, name, phone, email ),
        membership_plans ( id, name, duration_days, price ),
        gyms ( id, name, location )
      `)
      .eq("id", parseInt(id))
      .maybeSingle();

    if (error) {
      console.error("[GetPayment] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch payment" });
    }

    if (!data) return res.status(404).json({ success: false, message: "Payment not found" });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("[GetPayment] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// REFUND PAYMENT (admin)  →  POST /api/v1/payments/:id/refund
// ═════════════════════════════════════════════════════════════════════════════

const refundPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { refund_reason } = req.body;

    // Fetch payment
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, status, transaction_id, amount, user_id")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (fetchError || !payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    if (payment.status !== "success") {
      return res.status(400).json({ success: false, message: "Only successful payments can be refunded" });
    }

    if (!payment.transaction_id) {
      return res.status(400).json({ success: false, message: "No transaction ID found for this payment" });
    }

    // Initiate refund via Razorpay
    const refund = await getRazorpay().payments.refund(payment.transaction_id, {
      amount: Math.round(parseFloat(payment.amount) * 100), // full refund in paise
      notes: { reason: refund_reason || "Refund requested by admin" },
    });

    // Update payment record
    await supabase
      .from("payments")
      .update({
        refund_id: refund.id,
        refund_reason: refund_reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    // Cancel user's active membership
    await supabase
      .from("user_memberships")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", payment.user_id)
      .eq("status", "active");

    return res.status(200).json({
      success: true,
      message: "Refund initiated successfully",
      data: {
        refund_id: refund.id,
        amount: payment.amount,
        status: refund.status,
      },
    });
  } catch (err) {
    console.error("[RefundPayment] Unexpected error:", err);
    // Handle Razorpay-specific errors
    if (err.error) {
      return res.status(400).json({ success: false, message: err.error.description || "Razorpay refund failed" });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// PAYMENT STATS (admin)  →  GET /api/v1/payments/stats
// ═════════════════════════════════════════════════════════════════════════════

const getPaymentStats = async (req, res) => {
  try {
    const statuses = ["success", "pending", "failed"];
    const counts = {};

    for (const status of statuses) {
      const { count } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      counts[status] = count || 0;
    }

    // Total revenue from successful payments
    const { data: revenueData } = await supabase
      .from("payments")
      .select("amount")
      .eq("status", "success");

    const totalRevenue = revenueData?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Today's revenue
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayData } = await supabase
      .from("payments")
      .select("amount")
      .eq("status", "success")
      .gte("paid_at", todayStart.toISOString());

    const todayRevenue = todayData?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    return res.status(200).json({
      success: true,
      data: {
        ...counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        total_revenue: totalRevenue.toFixed(2),
        today_revenue: todayRevenue.toFixed(2),
        currency: "INR",
      },
    });
  } catch (err) {
    console.error("[GetPaymentStats] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getMyPayments,
  getAllPayments,
  getPayment,
  refundPayment,
  getPaymentStats,
};