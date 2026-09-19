const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/sales?date=2026-09-19 — liste des ventes (filtrable par date)
router.get("/", async (req, res) => {
  const { date, from, to } = req.query;
  let query = `SELECT * FROM sales WHERE business_id = $1`;
  const params = [req.user.businessId];

  if (date) { params.push(date); query += ` AND date = $${params.length}`; }
  if (from) { params.push(from); query += ` AND date >= $${params.length}`; }
  if (to) { params.push(to); query += ` AND date <= $${params.length}`; }

  query += ` ORDER BY created_at DESC`;
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// POST /api/sales — enregistre une vente réelle (PAS une proforma)
// body: { items:[{productId, qty, unitPrice}], clientId, discount, paymentMethod, amountReceived, note, cashSessionId }
router.post("/", async (req, res) => {
  const b = req.user.businessId;
  const { items, clientId, discount = 0, paymentMethod = "Espèces", amountReceived, note, cashSessionId } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: "Le panier est vide." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Vérifie et verrouille le stock de chaque produit (empêche la survente
    //    si deux caissiers vendent le dernier article EN MÊME TEMPS)
    let total = 0;
    for (const item of items) {
      if (!item.productId) { total += item.qty * item.unitPrice; continue; } // ligne "service"
      const { rows } = await client.query(
        `SELECT qty, name FROM products WHERE id=$1 AND business_id=$2 FOR UPDATE`,
        [item.productId, b]
      );
      const prod = rows[0];
      if (!prod) throw { status: 404, message: "Un produit du panier est introuvable." };
      if (Number(prod.qty) < Number(item.qty)) {
        throw { status: 409, message: `Stock insuffisant pour "${prod.name}" (reste ${prod.qty}).` };
      }
      total += item.qty * item.unitPrice;
    }

    const finalTotal = total - Number(discount || 0);
    const received = amountReceived != null ? Number(amountReceived) : finalTotal;

    // 2) Si le client ne paie pas tout, il faut un client identifié (crédit)
    if (received < finalTotal && !clientId) {
      throw { status: 400, message: "Un client est requis pour enregistrer un solde dû." };
    }

    // 3) Crée la vente
    const now = new Date();
    const saleRes = await client.query(
      `INSERT INTO sales (business_id, cash_session_id, user_id, client_id, total, discount, payment_method, amount_received, note, date, time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_DATE, $10) RETURNING *`,
      [b, cashSessionId || null, req.user.userId, clientId || null, finalTotal, discount, paymentMethod, received, note || null,
       now.toTimeString().slice(0,5)]
    );
    const sale = saleRes.rows[0];

    // 4) Ajoute les lignes de la vente ET diminue le stock
    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, service_id, qty, unit_price) VALUES ($1,$2,$3,$4,$5)`,
        [sale.id, item.productId || null, item.serviceId || null, item.qty, item.unitPrice]
      );
      if (item.productId) {
        await client.query(
          `UPDATE products SET qty = qty - $1 WHERE id=$2 AND business_id=$3`,
          [item.qty, item.productId, b]
        );
      }
    }

    // 5) Si crédit partiel, met à jour le solde dû du client
    if (received < finalTotal && clientId) {
      await client.query(
        `UPDATE clients SET balance_due = balance_due + $1 WHERE id=$2 AND business_id=$3`,
        [finalTotal - received, clientId, b]
      );
    }

    await client.query(
      `INSERT INTO audit_log (business_id, user_id, action, description) VALUES ($1,$2,$3,$4)`,
      [b, req.user.userId, "Vente", `Vente #${sale.id} — ${finalTotal} (${paymentMethod})`]
    );

    await client.query("COMMIT");
    res.status(201).json(sale);
  } catch (err) {
    await client.query("ROLLBACK");
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Erreur lors de l'enregistrement de la vente." });
  } finally {
    client.release();
  }
});

module.exports = router;
