const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/stock-ins — liste avec le détail des produits reçus
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT si.*, s.name AS supplier_name,
       (SELECT json_agg(json_build_object('productId', sii.product_id, 'qty', sii.qty, 'unitCost', sii.unit_cost))
        FROM stock_in_items sii WHERE sii.stock_in_id = si.id) AS items
     FROM stock_ins si LEFT JOIN suppliers s ON s.id = si.supplier_id
     WHERE si.business_id=$1 ORDER BY si.date DESC, si.id DESC`,
    [req.user.businessId]
  );
  res.json(rows);
});

// POST /api/stock-ins — { supplierId, invoiceNo, date, items:[{productId, qty, unitCost}] }
// Augmente automatiquement le stock des produits reçus.
router.post("/", async (req, res) => {
  const b = req.user.businessId;
  const { supplierId, invoiceNo, date, items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: "Aucun produit reçu n'a été indiqué." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inRes = await client.query(
      `INSERT INTO stock_ins (business_id, supplier_id, invoice_no, date, created_by)
       VALUES ($1,$2,$3, COALESCE($4, CURRENT_DATE), $5) RETURNING *`,
      [b, supplierId || null, invoiceNo || null, date || null, req.user.userId]
    );
    const stockIn = inRes.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO stock_in_items (stock_in_id, product_id, qty, unit_cost) VALUES ($1,$2,$3,$4)`,
        [stockIn.id, item.productId, item.qty, item.unitCost]
      );
      await client.query(
        `UPDATE products SET qty = qty + $1, buy_price = $2 WHERE id=$3 AND business_id=$4`,
        [item.qty, item.unitCost, item.productId, b]
      );
    }

    await client.query(
      `INSERT INTO audit_log (business_id, user_id, action, description) VALUES ($1,$2,$3,$4)`,
      [b, req.user.userId, "Entrée de stock", `Facture ${invoiceNo || "—"} — ${items.length} produit(s)`]
    );

    await client.query("COMMIT");
    res.status(201).json(stockIn);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'entrée de stock." });
  } finally {
    client.release();
  }
});

module.exports = router;
