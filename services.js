const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM services WHERE business_id=$1 ORDER BY name ASC`, [req.user.businessId]
  );
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { name, price, description } = req.body;
  if (!name) return res.status(400).json({ error: "Le nom du service est requis." });
  const { rows } = await pool.query(
    `INSERT INTO services (business_id, name, price, description) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.user.businessId, name, price || 0, description || null]
  );
  res.status(201).json(rows[0]);
});

router.put("/:id", async (req, res) => {
  const { name, price, description } = req.body;
  const { rows } = await pool.query(
    `UPDATE services SET name=$1, price=$2, description=$3 WHERE id=$4 AND business_id=$5 RETURNING *`,
    [name, price || 0, description || null, req.params.id, req.user.businessId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Service introuvable." });
  res.json(rows[0]);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  await pool.query(`DELETE FROM services WHERE id=$1 AND business_id=$2`, [req.params.id, req.user.businessId]);
  res.json({ ok: true });
});

module.exports = router;
