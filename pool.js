// Connexion partagée à PostgreSQL. Tous les fichiers routes/*.js
// importent ce fichier au lieu de créer chacun leur propre connexion.
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

module.exports = pool;
