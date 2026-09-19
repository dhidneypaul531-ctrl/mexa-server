const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, (SELECT COUNT(*) FROM stock_ins si WHERE si.supplier_id = s.id) AS stock_in_count
     FROM suppliers s WHERE s.business_id=$1 ORDER BY s.name ASC`,
    [req.user.businessId]
  );
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { name, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: "Le nom du fournisseur est requis." });
  const { rows } = await pool.query(
    `INSERT INTO suppliers (business_id, name, phone, address) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.user.businessId, name, phone || null, address || null]
  );
  res.status(201).json(rows[0]);
});

router.put("/:id", async (req, res) => {
  const { name, phone, address } = req.body;
  const { rows } = await pool.query(
    `UPDATE suppliers SET name=$1, phone=$2, address=$3 WHERE id=$4 AND business_id=$5 RETURNING *`,
    [name, phone || null, address || null, req.params.id, req.user.businessId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Fournisseur introuvable." });
  res.json(rows[0]);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  await pool.query(`DELETE FROM suppliers WHERE id=$1 AND business_id=$2`, [req.params.id, req.user.businessId]);
  res.json({ ok: true });
});

module.exports = router;
