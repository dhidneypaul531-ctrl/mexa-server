const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/users — liste (sans jamais renvoyer le mot de passe)
router.get("/", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, full_name, phone, address, username, role, shift_start, shift_end, active
     FROM users WHERE business_id=$1 ORDER BY full_name ASC`,
    [req.user.businessId]
  );
  res.json(rows);
});

// POST /api/users — crée un utilisateur
router.post("/", requireAdmin, async (req, res) => {
  const { fullName, phone, address, username, password, role, shiftStart, shiftEnd } = req.body;
  if (!fullName || !username || !password) {
    return res.status(400).json({ error: "Nom complet, nom d'utilisateur et mot de passe requis." });
  }

  const exists = await pool.query(
    `SELECT id FROM users WHERE business_id=$1 AND LOWER(username)=LOWER($2)`,
    [req.user.businessId, username]
  );
  if (exists.rows.length) return res.status(409).json({ error: `Le nom d'utilisateur "${username}" existe déjà.` });

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (business_id, full_name, phone, address, username, password_hash, role, shift_start, shift_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, full_name, phone, address, username, role, shift_start, shift_end, active`,
    [req.user.businessId, fullName, phone || null, address || null, username, hash, role || "caissier", shiftStart || null, shiftEnd || null]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/users/:id — modifie (mot de passe optionnel : vide = ne pas changer)
router.put("/:id", requireAdmin, async (req, res) => {
  const { fullName, phone, address, role, shiftStart, shiftEnd, active, password } = req.body;

  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE users SET password_hash=$1 WHERE id=$2 AND business_id=$3`,
      [hash, req.params.id, req.user.businessId]
    );
  }

  const { rows } = await pool.query(
    `UPDATE users SET full_name=$1, phone=$2, address=$3, role=$4, shift_start=$5, shift_end=$6, active=$7
     WHERE id=$8 AND business_id=$9
     RETURNING id, full_name, phone, address, username, role, shift_start, shift_end, active`,
    [fullName, phone || null, address || null, role, shiftStart || null, shiftEnd || null, active !== false, req.params.id, req.user.businessId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Utilisateur introuvable." });
  res.json(rows[0]);
});

// DELETE /api/users/:id — refuse de supprimer s'il ne reste qu'un seul utilisateur
router.delete("/:id", requireAdmin, async (req, res) => {
  const count = await pool.query(`SELECT COUNT(*) FROM users WHERE business_id=$1`, [req.user.businessId]);
  if (Number(count.rows[0].count) <= 1) {
    return res.status(400).json({ error: "Impossible de supprimer le dernier utilisateur restant." });
  }
  await pool.query(`DELETE FROM users WHERE id=$1 AND business_id=$2`, [req.params.id, req.user.businessId]);
  res.json({ ok: true });
});

module.exports = router;
