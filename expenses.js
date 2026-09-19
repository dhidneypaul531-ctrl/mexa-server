const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/expenses?from=&to=
router.get("/", async (req, res) => {
  const { from, to } = req.query;
  let query = `SELECT * FROM expenses WHERE business_id=$1`;
  const params = [req.user.businessId];
  if (from) { params.push(from); query += ` AND date >= $${params.length}`; }
  if (to) { params.push(to); query += ` AND date <= $${params.length}`; }
  query += ` ORDER BY date DESC, id DESC`;
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { category, amount, note, date } = req.body;
  if (!category || !amount) return res.status(400).json({ error: "Catégorie et montant requis." });

  const { rows } = await pool.query(
    `INSERT INTO expenses (business_id, category, amount, note, date, created_by)
     VALUES ($1,$2,$3,$4, COALESCE($5, CURRENT_DATE), $6) RETURNING *`,
    [req.user.businessId, category, amount, note || null, date || null, req.user.userId]
  );

  await pool.query(
    `INSERT INTO audit_log (business_id, user_id, action, description) VALUES ($1,$2,$3,$4)`,
    [req.user.businessId, req.user.userId, "Dépense", `${category} — ${amount}`]
  );

  res.status(201).json(rows[0]);
});

router.delete("/:id", async (req, res) => {
  await pool.query(`DELETE FROM expenses WHERE id=$1 AND business_id=$2`, [req.params.id, req.user.businessId]);
  res.json({ ok: true });
});

module.exports = router;
