// The database. It is one file (data/vendorfy.db), created automatically on first start.
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "vendorfy.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Customers have no password (they log in with an emailed code), so password_hash can be empty.
const usersTable = (name) => `
  CREATE TABLE ${name} (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role          TEXT NOT NULL CHECK (role IN ('vendor', 'admin', 'customer')),
    name          TEXT,
    phone         TEXT,
    address       TEXT,
    city          TEXT,
    state         TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )`;

/* ---------- Upgrade an older database (made before customer accounts existed) ---------- */
const oldUsers = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
if (oldUsers && !oldUsers.sql.includes("'customer'")) {
  db.pragma("foreign_keys = OFF");
  db.transaction(() => {
    db.exec(usersTable("users_new"));
    db.exec(`INSERT INTO users_new (id, email, password_hash, role, created_at)
             SELECT id, email, password_hash, role, created_at FROM users`);
    db.exec("DROP TABLE users");
    db.exec("ALTER TABLE users_new RENAME TO users");
  })();
  db.pragma("foreign_keys = ON");
  console.log("Database upgraded for customer accounts.");
}

db.exec(`
  ${usersTable("IF NOT EXISTS users")};

  CREATE TABLE IF NOT EXISTS vendors (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL,
    category   TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id   INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price       INTEGER NOT NULL CHECK (price > 0),   -- whole naira
    old_price   INTEGER CHECK (old_price IS NULL OR old_price > 0),
    category    TEXT NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sizes       TEXT NOT NULL DEFAULT '[]',           -- JSON list, e.g. ["S","M","L"]
    images      TEXT NOT NULL DEFAULT '[]',           -- JSON list of image paths
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- One-time codes emailed to customers. Only a scrambled (hashed) copy is stored.
  CREATE TABLE IF NOT EXISTS login_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL,
    code_hash  TEXT NOT NULL,
    name       TEXT,                                   -- name typed on the sign-up form
    attempts   INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,                       -- milliseconds
    created_at INTEGER NOT NULL
  );

  -- A logged-in customer's saved cart and wishlist
  CREATE TABLE IF NOT EXISTS cart_items (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size       TEXT NOT NULL DEFAULT '',
    qty        INTEGER NOT NULL CHECK (qty > 0),
    PRIMARY KEY (user_id, product_id, size)
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total          INTEGER NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'pay_on_delivery',
    ship_name      TEXT NOT NULL,
    ship_phone     TEXT NOT NULL,
    ship_address   TEXT NOT NULL,
    ship_city      TEXT NOT NULL,
    ship_state     TEXT NOT NULL,
    note           TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- What was bought. Title and price are copied here, so an order never changes if the vendor edits the product later.
  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    vendor_id  INTEGER NOT NULL REFERENCES vendors(id),
    title      TEXT NOT NULL,
    image      TEXT,
    size       TEXT NOT NULL DEFAULT '',
    price      INTEGER NOT NULL,
    qty        INTEGER NOT NULL CHECK (qty > 0),
    status     TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'shipped', 'delivered', 'cancelled'))
  );

  CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_codes_email ON login_codes(email);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_items_vendor ON order_items(vendor_id);
`);

// Create your admin account the first time, from the .env file
function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;
  const exists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (exists) return;
  if (password.length < 10) {
    console.warn("ADMIN_PASSWORD must be at least 10 characters. Admin account was NOT created.");
    return;
  }
  db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')")
    .run(email, bcrypt.hashSync(password, 12));
  console.log(`Admin account created for ${email}`);
}

module.exports = { db, ensureAdmin };
