const supabase = require("../config/supabaseClient");

// ─── Get All Receipts (with filters) ─────────────────────────
// GET /api/v1/receipts?search=&from=&to=&page=&limit=
const getReceipts = async (req, res) => {
    try {
        let { search, from, to, page = 1, limit = 20 } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 20;
        const offset = (page - 1) * limit;

        // Base query — join payments → users → membership_plans
        let query = supabase
            .from("payments")
            .select(`
        id,
        amount,
        currency,
        status,
        payment_method,
        transaction_id,
        payment_date,
        paid_at,
        user:users!payments_user_id_fkey ( id, name, phone, email ),
        plan:membership_plans!payments_plan_id_fkey ( id, name, duration_days, price )
      `, { count: "exact" })
            .eq("status", "success")
            .order("payment_date", { ascending: false })
            .range(offset, offset + limit - 1);

        // Date filters
        if (from) query = query.gte("payment_date", new Date(from).toISOString());
        if (to) {
            const toEnd = new Date(to);
            toEnd.setHours(23, 59, 59, 999);
            query = query.lte("payment_date", toEnd.toISOString());
        }

        const { data, error, count } = await query;

        if (error) {
            console.error("[GetReceipts] Error:", error);
            return res.status(500).json({ success: false, message: "Failed to fetch receipts" });
        }

        // Client-side search filter (Supabase free tier doesn't support cross-table ilike easily)
        let filtered = data || [];
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(r =>
                r.user?.name?.toLowerCase().includes(q) ||
                r.user?.phone?.includes(q) ||
                String(r.id).includes(q)
            );
        }

        return res.status(200).json({
            success: true,
            data: filtered,
            pagination: {
                total: count,
                page,
                limit,
                pages: Math.ceil(count / limit),
            },
        });
    } catch (err) {
        console.error("[GetReceipts] Unexpected:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── Get Single Receipt ───────────────────────────────────────
// GET /api/v1/receipts/:id
const getReceiptById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from("payments")
            .select(`
        id,
        amount,
        currency,
        status,
        payment_method,
        transaction_id,
        razorpay_order_id,
        payment_date,
        paid_at,
        user:users!payments_user_id_fkey ( id, name, phone, email, whatsapp_number ),
        plan:membership_plans!payments_plan_id_fkey ( id, name, duration_days, price, features )
      `)
            .eq("id", id)
            .eq("status", "success")
            .maybeSingle();

        if (error) {
            console.error("[GetReceiptById] Error:", error);
            return res.status(500).json({ success: false, message: "Failed to fetch receipt" });
        }

        if (!data) {
            return res.status(404).json({ success: false, message: "Receipt not found" });
        }

        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error("[GetReceiptById] Unexpected:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── Get Receipts Summary Stats ───────────────────────────────
// GET /api/v1/receipts/stats
const getReceiptStats = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("payments")
            .select("amount, payment_date")
            .eq("status", "success");

        if (error) {
            return res.status(500).json({ success: false, message: "Failed to fetch stats" });
        }

        const total = data.length;
        const revenue = data.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        // This month
        const now = new Date();
        const thisMonth = data.filter(p => {
            const d = new Date(p.payment_date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const monthRevenue = thisMonth.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        return res.status(200).json({
            success: true,
            data: {
                total_receipts: total,
                total_revenue: revenue,
                month_receipts: thisMonth.length,
                month_revenue: monthRevenue,
            },
        });
    } catch (err) {
        console.error("[GetReceiptStats] Unexpected:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = { getReceipts, getReceiptById, getReceiptStats };