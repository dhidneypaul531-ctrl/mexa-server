const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/reports/summary?from=2026-09-01&to=2026-09-30
router.get("/summary", async (req, res) => {
  const b = req.user.businessId;
  const from = req.query.from || new Date().toISOString().slice(0, 8) + "01";
  const to = req.query.to || new Date().toISOString().slice(0, 10);

  const sales = await pool.query(
    `SELECT COALESCE(SUM(total),0) AS total_sold, COALESCE(SUM(amount_received),0) AS total_collected
     FROM sales WHERE business_id=$1 AND date BETWEEN $2 AND $3 AND is_proforma=false`,
    [b, from, to]
  );

  const expenses = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total_expenses FROM expenses WHERE business_id=$1 AND date BETWEEN $2 AND $3`,
    [b, from, to]
  );

  const cost = await pool.query(
    `SELECT COALESCE(SUM(si.qty * p.buy_price),0) AS total_cost
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     WHERE s.business_id=$1 AND s.date BETWEEN $2 AND $3 AND s.is_proforma=false`,
    [b, from, to]
  );

  const creditDue = await pool.query(
    `SELECT COALESCE(SUM(balance_due),0) AS total_due FROM clients WHERE business_id=$1`, [b]
  );

  const byPaymentMethod = await pool.query(
    `SELECT payment_method, COALESCE(SUM(amount_received),0) AS total
     FROM sales WHERE business_id=$1 AND date BETWEEN $2 AND $3 AND is_proforma=false
     GROUP BY payment_method`,
    [b, from, to]
  );

  const topProducts = await pool.query(
    `SELECT p.name, SUM(si.qty) AS qty_sold, SUM(si.qty * si.unit_price) AS revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     WHERE s.business_id=$1 AND s.date BETWEEN $2 AND $3 AND s.is_proforma=false
     GROUP BY p.name ORDER BY qty_sold DESC LIMIT 10`,
    [b, from, to]
  );

  const totalSold = Number(sales.rows[0].total_sold);
  const totalCollected = Number(sales.rows[0].total_collected);
  const totalExpenses = Number(expenses.rows[0].total_expenses);
  const totalCost = Number(cost.rows[0].total_cost);

  res.json({
    period: { from, to },
    totalSold,
    totalCollected,
    totalExpenses,
    totalCost,
    profit: totalCollected - totalCost - totalExpenses,
    creditDue: Number(creditDue.rows[0].total_due),
    byPaymentMethod: byPaymentMethod.rows,
    topProducts: topProducts.rows,
  });
});

module.exports = router;
