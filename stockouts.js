const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT so.*, p.name AS product_name FROM stock_outs so
     JOIN products p ON p.id = so.product_id
     WHERE so.business_id=$1 ORDER BY so.date DESC, so.id DESC`,
    [req.user.businessId]
  );
  res.json(rows);
});

// POST /api/stock-outs — { productId, qty, reason, note }
// Diminue le stock (perte, produit endommagé, expiré, retour fournisseur, autre).
router.post("/", async (req, res) => {
  const b = req.user.businessId;
  const { productId, qty, reason, note } = req.body;
  if (!productId || !qty || !reason) {
    return res.status(400).json({ error: "Produit, quantité et raison requis." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prod = await client.query(
      `SELECT qty, name FROM products WHERE id=$1 AND business_id=$2 FOR UPDATE`, [productId, b]
    );
    if (!prod.rows[0]) throw { status: 404, message: "Produit introuvable." };
    if (Number(prod.rows[0].qty) < Number(qty)) {
      throw { status: 409, message: `Stock insuffisant pour "${prod.rows[0].name}".` };
    }

    const outRes = await client.query(
      `INSERT INTO stock_outs (business_id, product_id, qty, reason, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [b, productId, qty, reason, note || null, req.user.userId]
    );

    await client.query(`UPDATE products SET qty = qty - $1 WHERE id=$2 AND business_id=$3`, [qty, productId, b]);

    await client.query(
      `INSERT INTO audit_log (business_id, user_id, action, description) VALUES ($1,$2,$3,$4)`,
      [b, req.user.userId, "Sortie de stock", `${prod.rows[0].name} — ${qty} (${reason})`]
    );

    await client.query("COMMIT");
    res.status(201).json(outRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(err.status || 500).json({ error: err.message || "Erreur lors de l'enregistrement de la sortie." });
  } finally {
    client.release();
  }
});

module.exports = router;
