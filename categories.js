const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM categories WHERE business_id=$1 ORDER BY name ASC`, [req.user.businessId]
  );
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Le nom de la catégorie est requis." });
  const { rows } = await pool.query(
    `INSERT INTO categories (business_id, name) VALUES ($1,$2) RETURNING *`,
    [req.user.businessId, name]
  );
  res.status(201).json(rows[0]);
});

router.delete("/:id", async (req, res) => {
  await pool.query(`DELETE FROM categories WHERE id=$1 AND business_id=$2`, [req.params.id, req.user.businessId]);
  res.json({ ok: true });
});

module.exports = router;
