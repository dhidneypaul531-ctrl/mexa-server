-- ==========================================================
-- Mexa — Schéma de base de données (PostgreSQL)
-- Chaque table a une colonne business_id : cela permet à
-- PLUSIEURS commerces d'utiliser le même serveur sans jamais
-- voir les données les uns des autres.
-- ==========================================================

CREATE TABLE IF NOT EXISTS businesses (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  slogan        TEXT,
  phone         TEXT,
  patente       TEXT,
  address       TEXT,
  currency      TEXT DEFAULT 'HTG',
  logo_url      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  address       TEXT,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'caissier', -- 'admin' ou 'caissier'
  shift_start   TEXT,
  shift_end     TEXT,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, username)
);

CREATE TABLE IF NOT EXISTS categories (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  address       TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  category_id   INTEGER REFERENCES categories(id),
  supplier_id   INTEGER REFERENCES suppliers(id),
  buy_price     NUMERIC(12,2) NOT NULL DEFAULT 0,
  sell_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  qty           NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_stock     NUMERIC(12,3) NOT NULL DEFAULT 10,
  expiry_date   DATE,
  fractional    BOOLEAN DEFAULT false, -- ex: vente au 1/4 lb
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS services (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  description   TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  balance_due   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(12,2),
  theoretical_amount NUMERIC(12,2),
  variance      NUMERIC(12,2),
  opened_at     TIMESTAMPTZ DEFAULT now(),
  closed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sales (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  cash_session_id INTEGER REFERENCES cash_sessions(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  client_id     INTEGER REFERENCES clients(id),
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Espèces',
  amount_received NUMERIC(12,2) NOT NULL DEFAULT 0, -- ce que le client a réellement payé
  note          TEXT,
  is_proforma   BOOLEAN DEFAULT false,
  proforma_code TEXT,
  date          DATE DEFAULT CURRENT_DATE,
  time          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id            SERIAL PRIMARY KEY,
  sale_id       INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id),
  service_id    INTEGER REFERENCES services(id),
  qty           NUMERIC(12,3) NOT NULL,
  unit_price    NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_ins (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id   INTEGER REFERENCES suppliers(id),
  invoice_no    TEXT,
  date          DATE DEFAULT CURRENT_DATE,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_in_items (
  id            SERIAL PRIMARY KEY,
  stock_in_id   INTEGER NOT NULL REFERENCES stock_ins(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id),
  qty           NUMERIC(12,3) NOT NULL,
  unit_cost     NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_outs (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id),
  qty           NUMERIC(12,3) NOT NULL,
  reason        TEXT NOT NULL, -- perte, endommagé, expiré, retour fournisseur, autre
  note          TEXT,
  created_by    INTEGER REFERENCES users(id),
  date          DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  note          TEXT,
  date          DATE DEFAULT CURRENT_DATE,
  created_by    INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id),
  action        TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  business_id   INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  end_date      DATE
);

-- Index utiles pour la rapidité des requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_business_date ON sales(business_id, date);
CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_log(business_id);
