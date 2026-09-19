const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login
// Reçoit { username, password } et renvoie un token si c'est correct.
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis." });
  }

  const { rows } = await pool.query(
    `SELECT * FROM users WHERE LOWER(username) = LOWER($1) AND active = true`,
    [username.trim()]
  );
  const user = rows[0];

  if (!user) {
    return res.status(401).json({ error: `Aucun utilisateur nommé "${username}" n'existe.` });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Mot de passe incorrect." });
  }

  const token = jwt.sign(
    { userId: user.id, businessId: user.business_id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  await pool.query(
    `INSERT INTO audit_log (business_id, user_id, action, description) VALUES ($1,$2,$3,$4)`,
    [user.business_id, user.id, "Connexion", `${user.full_name || user.username} s'est connecté(e)`]
  );

  res.json({
    token,
    user: { id: user.id, fullName: user.full_name, username: user.username, role: user.role },
  });
});

// POST /api/auth/forgot-password
// Étape 1 : { username } -> dit si c'est un admin ou pas, et s'il y a d'autres admins.
router.post("/forgot-password", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Nom d'utilisateur requis." });

  const { rows } = await pool.query(
    `SELECT * FROM users WHERE LOWER(username) = LOWER($1)`,
    [username.trim()]
  );
  const user = rows[0];
  if (!user) {
    return res.status(404).json({ error: `Aucun utilisateur nommé "${username}" n'existe.` });
  }

  if (user.role !== "admin") {
    const others = await pool.query(
      `SELECT full_name, username FROM users WHERE business_id=$1 AND role='admin' AND id<>$2 AND active=true`,
      [user.business_id, user.id]
    );
    if (others.rows.length) {
      return res.json({
        needsAdmin: true,
        message: `Demandez à un administrateur (${others.rows.map(a => a.full_name || a.username).join(", ")}) de réinitialiser votre mot de passe depuis "Utilisateurs".`,
      });
    }
  }

  // C'est un admin (ou le dernier admin restant) : on autorise la suite avec un code.
  res.json({ needsAdmin: false, userId: user.id });
});

// POST /api/auth/reset-password
// Étape 2 : { userId, recoveryCode } -> génère un mot de passe temporaire
// UNIQUEMENT pour ce compte, sans toucher au reste des données.
router.post("/reset-password", async (req, res) => {
  const { userId, recoveryCode } = req.body;
  if (!userId || !recoveryCode) {
    return res.status(400).json({ error: "Informations manquantes." });
  }
  if (recoveryCode !== process.env.RESET_CODE) {
    return res.status(401).json({ error: "Code de récupération incorrect." });
  }

  const tempPass = "temp" + Math.floor(1000 + Math.random() * 9000);
  const hash = await bcrypt.hash(tempPass, 10);

  const { rows } = await pool.query(
    `UPDATE users SET password_hash=$1 WHERE id=$2 RETURNING business_id, full_name, username`,
    [hash, userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Utilisateur introuvable." });

  await pool.query(
    `INSERT INTO audit_log (business_id, user_id, action, description) VALUES ($1,$2,$3,$4)`,
    [rows[0].business_id, userId, "Récupération de mot de passe", "Mot de passe temporaire généré"]
  );

  res.json({ tempPassword: tempPass, username: rows[0].username });
});

// GET /api/auth/me — pratique pour vérifier qu'un token est toujours valide
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
