// Lance ce script UNE FOIS après la migration, pour créer votre première
// entreprise et votre premier compte administrateur.
// Utilisation : node db/seed-first-business.js "Nom du Bar" admin motdepasse123
require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./pool");

async function main() {
  const [,, businessName, username, password] = process.argv;
  if (!businessName || !username || !password) {
    console.log('Utilisation : node db/seed-first-business.js "Nom du Bar" admin motdepasse123');
    process.exit(1);
  }

  const biz = await pool.query(
    `INSERT INTO businesses (name) VALUES ($1) RETURNING id`, [businessName]
  );
  const businessId = biz.rows[0].id;

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (business_id, full_name, username, password_hash, role)
     VALUES ($1,$2,$3,$4,'admin')`,
    [businessId, "Administrateur", username, hash]
  );

  console.log(`Entreprise "${businessName}" créée (id ${businessId}).`);
  console.log(`Compte admin créé : ${username} / ${password}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
