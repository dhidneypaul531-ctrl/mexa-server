// Ce script lit db/schema.sql et l'exécute sur la base de données
// indiquée par DATABASE_URL. À lancer UNE FOIS (ou après un changement
// de schéma) avec : npm run migrate
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  console.log("Exécution du schéma sur la base de données...");
  await pool.query(sql);
  console.log("Terminé : toutes les tables sont créées (ou déjà existantes).");
  await pool.end();
}

main().catch((err) => {
  console.error("Erreur pendant la migration :", err);
  process.exit(1);
});
