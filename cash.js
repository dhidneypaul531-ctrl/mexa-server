const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/cash/current — la session de caisse actuellement ouverte (s'il y en a une)
router.get("/current", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT cs.*, u.full_name AS cashier_name FROM cash_sessions cs
     JOIN users u ON u.id = cs.user_id
     WHERE cs.business_id=$1 AND cs.closed_at IS NULL
     ORDER BY cs.opened_at DESC LIMIT 1`,
    [req.user.businessId]
  );
  res.json(rows[0] || null);
});

// POST /api/cash/open — { openingAmount }
router.post("/open", async (req, res) => {
  const b = req.user.businessId;
  const already = await pool.query(
    `SELECT id FROM cash_sessions WHERE business_id=$1 AND closed_at IS NULL`, [b]
  );
  if (already.rows.length) {
    return res.status(409).json({ error: "Une caisse est déjà ouverte. Elle doit être fermée avant d'en ouvrir une autre." });
  }

  const { rows } = await pool.query(
    `INSERT INTO cash_sessions (business_id, user_id, opening_amount) VALUES ($1,$2,$3) RETURNING *`,
    [b, req.user.userId, req.body.openingAmount || 0]
  );
  res.status(201).json(rows[0]);
});

// POST /api/cash/close — { realAmount }
router.post("/close", async (req, res) => {
  const b = req.user.businessId;
  const current = await pool.query(
    `SELECT * FROM cash_sessions WHERE business_id=$1 AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`, [b]
  );
  const session = current.rows[0];
  if (!session) return res.status(404).json({ error: "Aucune caisse n'est actuellement ouverte." });

  // Calcule le total encaissé en espèces pendant cette session
  const cashTotals = await pool.query(
    `SELECT COALESCE(SUM(amount_received),0) AS total_cash
     FROM sales WHERE cash_session_id=$1 AND payment_method='Espèces'`,
    [session.id]
  );
  const expensesTotals = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total_expenses FROM expenses
     WHERE business_id=$1 AND date >= $2::date`,
    [b, session.opened_at]
  );

  const theoretical = Number(session.opening_amount) + Number(cashTotals.rows[0].total_cash) - Number(expensesTotals.rows[0].total_expenses);
  const real = Number(req.body.realAmount || 0);
  const variance = real - theoretical;

  const { rows } = await pool.query(
    `UPDATE cash_sessions SET closing_amount=$1, theoretical_amount=$2, variance=$3, closed_at=now()
     WHERE id=$4 RETURNING *`,
    [real, theoretical, variance, session.id]
  );

  await pool.query(
    `INSERT INTO audit_log (business_id, user_id, action, description) VALUES ($1,$2,$3,$4)`,
    [b, req.user.userId, "Fermeture de caisse", `Théorique ${theoretical} / Réel ${real} / Écart ${variance}`]
  );

  res.json(rows[0]);
});

module.exports = router;
