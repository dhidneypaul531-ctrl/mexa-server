require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const saleRoutes = require("./routes/sales");
const cashRoutes = require("./routes/cash");
const clientRoutes = require("./routes/clients");
const supplierRoutes = require("./routes/suppliers");
const expenseRoutes = require("./routes/expenses");
const categoryRoutes = require("./routes/categories");
const serviceRoutes = require("./routes/services");
const userRoutes = require("./routes/users");
const reportRoutes = require("./routes/reports");
const stockInRoutes = require("./routes/stockins");
const stockOutRoutes = require("./routes/stockouts");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// Vérification rapide que le serveur est en vie (utile pour Render)
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/cash", cashRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/stock-ins", stockInRoutes);
app.use("/api/stock-outs", stockOutRoutes);

// Gestion des erreurs qui ne sont pas déjà attrapées dans une route
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Mexa — serveur démarré sur le port ${PORT}`);
});
