const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/clients — liste tous les clients de l'entreprise
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM clients WHERE business_id=$1 ORDER BY name ASC`,
    [req.user.businessId]
  );
  res.json(rows);
});

// GET /api/clients/:id/history — historique des achats de ce client
router.get("/:id/history", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM sales WHERE business_id=$1 AND client_id=$2 ORDER BY created_at DESC`,
    [req.user.businessId, req.params.id]
  );
  res.json(rows);
});

// POST /api/clients — crée un client
router.post("/", async (req, res) => {
  const { name, phone } = req.body;
  if (!name) return res.status(400).json({ error: "Le nom du client est requis." });

  const { rows } = await pool.query(
    `INSERT INTO clients (business_id, name, phone) VALUES ($1,$2,$3) RETURNING *`,
    [req.user.businessId, name, phone || null]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/clients/:id — modifie un client
router.put("/:id", async (req, res) => {
  const { name, phone } = req.body;
  const { rows } = await pool.query(
    `UPDATE clients SET name=$1, phone=$2 WHERE id=$3 AND business_id=$4 RETURNING *`,
    [name, phone || null, req.params.id, req.user.businessId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Client introuvable." });
  res.json(rows[0]);
});

// POST /api/clients/:id/payment — enregistre un paiement qui réduit le solde dû
router.post("/:id/payment", async (req, res) => {
  const amount = Number(req.body.amount || 0);
  if (amount <= 0) return res.status(400).json({ error: "Montant invalide." });

  const { rows } = await pool.query(
    `UPDATE clients SET balance_due = GREATEST(balance_due - $1, 0)
     WHERE id=$2 AND business_id=$3 RETURNING *`,
    [amount, req.params.id, req.user.businessId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Client introuvable." });

  await pool.query(
    `INSERT INTO audit_log (business_id, user_id, action, description) VALUES ($1,$2,$3,$4)`,
    [req.user.businessId, req.user.userId, "Paiement de crédit", `${rows[0].name} — ${amount}`]
  );

  res.json(rows[0]);
});

// DELETE /api/clients/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  await pool.query(`DELETE FROM clients WHERE id=$1 AND business_id=$2`, [req.params.id, req.user.businessId]);
  res.json({ ok: true });
});

module.exports = router;
