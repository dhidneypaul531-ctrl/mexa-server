const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth); // toutes les routes ci-dessous exigent d'être connecté

// GET /api/products — liste tous les produits de l'entreprise connectée
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM products WHERE business_id = $1 ORDER BY name ASC`,
    [req.user.businessId]
  );
  res.json(rows);
});

// POST /api/products — crée un produit
router.post("/", async (req, res) => {
  const b = req.user.businessId;
  const { code, name, categoryId, supplierId, buyPrice, sellPrice, qty, minStock, expiryDate, fractional, description } = req.body;

  if (!code || !name) return res.status(400).json({ error: "Code et nom du produit requis." });

  // Empêche deux produits avec le même code dans la même entreprise
  const exists = await pool.query(`SELECT id FROM products WHERE business_id=$1 AND code=$2`, [b, code]);
  if (exists.rows.length) return res.status(409).json({ error: `Le code "${code}" existe déjà.` });

  const { rows } = await pool.query(
    `INSERT INTO products (business_id, code, name, category_id, supplier_id, buy_price, sell_price, qty, min_stock, expiry_date, fractional, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [b, code, name, categoryId || null, supplierId || null, buyPrice || 0, sellPrice || 0, qty || 0, minStock ?? 10, expiryDate || null, !!fractional, description || null]
  );

  await pool.query(
    `INSERT INTO audit_log (business_id, user_id, action, description) VALUES ($1,$2,$3,$4)`,
    [b, req.user.userId, "Création produit", `${name} (${code})`]
  );

  res.status(201).json(rows[0]);
});

// PUT /api/products/:id — modifie un produit
router.put("/:id", async (req, res) => {
  const b = req.user.businessId;
  const { name, categoryId, supplierId, buyPrice, sellPrice, qty, minStock, expiryDate, fractional, description } = req.body;

  const { rows } = await pool.query(
    `UPDATE products SET name=$1, category_id=$2, supplier_id=$3, buy_price=$4, sell_price=$5,
       qty=$6, min_stock=$7, expiry_date=$8, fractional=$9, description=$10
     WHERE id=$11 AND business_id=$12 RETURNING *`,
    [name, categoryId || null, supplierId || null, buyPrice || 0, sellPrice || 0, qty || 0, minStock ?? 10, expiryDate || null, !!fractional, description || null, req.params.id, b]
  );
  if (!rows[0]) return res.status(404).json({ error: "Produit introuvable." });
  res.json(rows[0]);
});

// DELETE /api/products/:id — supprime un produit (admin seulement)
router.delete("/:id", requireAdmin, async (req, res) => {
  await pool.query(`DELETE FROM products WHERE id=$1 AND business_id=$2`, [req.params.id, req.user.businessId]);
  res.json({ ok: true });
});

module.exports = router;
