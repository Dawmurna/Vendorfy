// Sample vendors and products, used by "npm run seed" and by SEED_DEMO=true.
// The vendors are fake and cannot be logged into. For testing and demo links only.
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { db } = require("./db");

const vendors = [
  ["Chic Collection", "Fashion"], ["Luxe Closet", "Fashion"],
  ["Timeless Hub", "Fashion"], ["Linen Lane", "Fashion"],
];

// [vendor, title, price, oldPrice, category, picture name, sizes]
// The picture name is the file in public/images/products/ without its ending (.jpg, .png, .webp or .svg).
// It also identifies the product, so changing a title or price here updates it on the next start.
const DRESS = "S,M,L,XL";
const products = [
  ["Chic Collection", "Tan Leather Tote", 45000, 55000, "Fashion", "handbag", ""],
  ["Timeless Hub", "Gold Wristwatch", 175000, null, "Fashion", "watch", ""],
  ["Timeless Hub", "Gold Chronograph Watch", 195000, null, "Fashion", "gold-chronograph", ""],
  ["Chic Collection", "Grey Structured Tote", 48000, null, "Fashion", "tote-grey", ""],
  ["Chic Collection", "Burgundy Structured Tote", 48000, null, "Fashion", "tote-burgundy", ""],
  ["Chic Collection", "Mocha Structured Tote", 48000, null, "Fashion", "tote-mocha", ""],
  ["Chic Collection", "Black Structured Tote", 48000, null, "Fashion", "tote-black", ""],
  ["Chic Collection", "Black Textured Handbag", 52000, null, "Fashion", "handbag-black", ""],
  ["Chic Collection", "Beige Teardrop Handbag", 46000, null, "Fashion", "handbag-beige", ""],
  ["Chic Collection", "Taupe Handbag with Silver Handle", 47000, null, "Fashion", "handbag-taupe", ""],
  ["Luxe Closet", "Black Evening Clutch", 28000, null, "Fashion", "clutch-black", ""],
  ["Timeless Hub", "Black Leather Laptop Bag", 65000, null, "Fashion", "briefcase-black", ""],
  ["Timeless Hub", "Tan Leather Briefcase", 68000, null, "Fashion", "briefcase-tan", ""],
  ["Linen Lane", "White Linen Shirt and Trouser Set", 48000, null, "Fashion", "linen-set-white", DRESS],
  ["Linen Lane", "Olive Linen Shirt", 24000, null, "Fashion", "linen-shirt-olive", DRESS],
  ["Linen Lane", "Sand Knot-Button Linen Set", 52000, null, "Fashion", "linen-set-sand-knot", DRESS],
  ["Linen Lane", "Navy Shirt and Sand Trouser Set", 46000, null, "Fashion", "linen-set-navy-sand", DRESS],
  ["Linen Lane", "Espresso Mandarin Collar Linen Shirt", 26000, null, "Fashion", "linen-mandarin-espresso", DRESS],
  ["Linen Lane", "Black Linen Henley Shirt", 22000, null, "Fashion", "linen-henley-black", DRESS],
  ["Linen Lane", "Apricot Linen Shirt", 24000, null, "Fashion", "linen-shirt-apricot", DRESS],
  ["Linen Lane", "Sand Shirt and Navy Trouser Set", 46000, null, "Fashion", "linen-set-sand-navy", DRESS],
  ["Linen Lane", "Cream Striped Popover Shirt", 23000, null, "Fashion", "linen-popover-stripe", DRESS],
  ["Linen Lane", "Navy Linen Shirt and Trouser Set", 45000, null, "Fashion", "linen-set-navy", DRESS],
  ["Linen Lane", "Ivory Linen Popover Shirt", 25000, null, "Fashion", "linen-popover-ivory", DRESS],
  ["Linen Lane", "Brown Linen Popover Shirt", 27000, null, "Fashion", "linen-popover-brown", DRESS],
  ["Linen Lane", "Ivory Henley Shirt", 20000, null, "Fashion", "linen-henley-ivory", DRESS],
  ["Linen Lane", "Dark Brown Linen Popover Shirt", 27000, null, "Fashion", "linen-popover-darkbrown", DRESS],
  ["Linen Lane", "Sand Striped Shirt and Trouser Set", 55000, null, "Fashion", "linen-set-stripe-sand", DRESS],
  ["Linen Lane", "Mocha Linen Henley Shirt", 23000, null, "Fashion", "linen-henley-mocha", DRESS],
  ["Linen Lane", "Green Striped Shirt and Trouser Set", 55000, null, "Fashion", "linen-set-stripe-green", DRESS],
  ["Linen Lane", "Rose Striped Shirt and Trouser Set", 55000, null, "Fashion", "linen-set-stripe-rose", DRESS],
];

const fs = require("fs");
const path = require("path");
const PIC_DIR = path.join(__dirname, "..", "public", "images", "products");
const ORDER = ["jpg", "jpeg", "png", "webp", "svg"];

// The best picture that exists for a name: a real photo beats the .svg placeholder.
function pictureFor(name) {
  const ext = ORDER.find((e) => fs.existsSync(path.join(PIC_DIR, name + "." + e))) || "svg";
  return "/images/products/" + name + "." + ext;
}

const SAMPLE_EMAIL = "seed-%@example.invalid";

// Adds missing sample products and updates the ones already there (by picture name).
// Stock is never reset. Sample products no longer in the list are removed.
const run = db.transaction(() => {
  const ids = {};
  for (const [name, category] of vendors) {
    const email = `seed-${name.toLowerCase().replace(/\W+/g, "-")}@example.invalid`;
    let user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (!user) {
      // Random password nobody knows, so these sample vendors cannot be logged into
      const hash = bcrypt.hashSync(crypto.randomBytes(24).toString("hex"), 10);
      const info = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'vendor')").run(email, hash);
      user = { id: info.lastInsertRowid };
      db.prepare("INSERT INTO vendors (user_id, store_name, category, status) VALUES (?, ?, ?, 'approved')")
        .run(user.id, name, category);
    }
    ids[name] = db.prepare("SELECT id FROM vendors WHERE user_id = ?").get(user.id).id;
  }

  // Every sample product that exists now, keyed by picture name
  const existing = {};
  const rows = db.prepare(`SELECT p.id, p.images FROM products p
      JOIN vendors v ON v.id = p.vendor_id JOIN users u ON u.id = v.user_id
      WHERE u.email LIKE ?`).all(SAMPLE_EMAIL);
  for (const r of rows) {
    let first = "";
    try { first = JSON.parse(r.images)[0] || ""; } catch (e) { /* ignore */ }
    const m = /^\/images\/products\/([a-z0-9-]+)\.[a-z]+$/.exec(first);
    if (m) existing[m[1]] = r.id;
  }

  const result = { added: 0, updated: 0, removed: 0 };
  const keep = new Set(products.map((x) => x[5]));

  // Insert oldest first so the newest ends up at the top of New Arrivals
  for (const [vendor, title, price, oldPrice, category, key, sizes] of [...products].reverse()) {
    const desc = `The ${title} from ${vendor} is made for everyday use. Quality materials, a clean finish and great value.`;
    const sizeList = JSON.stringify(sizes ? sizes.split(",") : []);
    const images = JSON.stringify([pictureFor(key)]);
    if (existing[key]) {
      db.prepare(`UPDATE products SET vendor_id=?, title=?, description=?, price=?, old_price=?, category=?, sizes=?, images=?
                  WHERE id=?`).run(ids[vendor], title, desc, price, oldPrice, category, sizeList, images, existing[key]);
      result.updated++;
    } else {
      db.prepare(`INSERT INTO products (vendor_id, title, description, price, old_price, category, stock, sizes, images)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(ids[vendor], title, desc, price, oldPrice, category, 20, sizeList, images);
      result.added++;
    }
  }

  // Sample products that were dropped from the list (past orders keep their own copy of the details)
  for (const [key, id] of Object.entries(existing)) {
    if (!keep.has(key)) {
      db.prepare("DELETE FROM products WHERE id = ?").run(id);
      result.removed++;
    }
  }

  // Sample vendors that are no longer in the list: remove them once they have no products or orders
  const old = db.prepare(`SELECT v.id AS vid, u.id AS uid, v.store_name FROM vendors v JOIN users u ON u.id = v.user_id
      WHERE u.email LIKE ?`).all(SAMPLE_EMAIL);
  const names = new Set(vendors.map((v) => v[0]));
  for (const o of old) {
    if (names.has(o.store_name)) continue;
    const busy = db.prepare("SELECT (SELECT COUNT(*) FROM products WHERE vendor_id=?) + (SELECT COUNT(*) FROM order_items WHERE vendor_id=?) AS n").get(o.vid, o.vid).n;
    if (!busy) db.prepare("DELETE FROM users WHERE id = ?").run(o.uid);
  }
  return result;
});

function addDemoData() {
  return { vendors: vendors.length, ...run() };
}

// Used by SEED_DEMO=true on every start. Quiet when nothing needed changing.
function syncDemoData() {
  const r = addDemoData();
  if (r.added || r.removed) {
    console.log(`[Vendorfy] SEED_DEMO is on: added ${r.added}, updated ${r.updated}, removed ${r.removed} sample products.`);
  }
  return r;
}

// Keeps sample products pointing at the best picture that exists in public/images/products.
// A real photo (jpg, png or webp) with the same name wins over the .svg placeholder, so you can
// replace a placeholder just by dropping a file with the same name into that folder.
// If a picture is missing, the product falls back to whatever matching file is left.
function repairDemoImages() {
  const dir = PIC_DIR;
  const rows = db.prepare("SELECT id, images FROM products WHERE images LIKE '%/images/products/%'").all();
  let fixed = 0;
  for (const row of rows) {
    let list;
    try { list = JSON.parse(row.images); } catch (e) { continue; }
    let changed = false;
    list = list.map((u) => {
      const m = /^\/images\/products\/([a-z0-9-]+)\.(svg|jpe?g|png|webp)$/.exec(u);
      if (!m) return u;
      const best = ORDER.find((ext) => fs.existsSync(path.join(dir, m[1] + "." + ext)));
      if (best && best !== m[2]) {
        changed = true;
        return "/images/products/" + m[1] + "." + best;
      }
      return u;
    });
    if (changed) {
      db.prepare("UPDATE products SET images = ? WHERE id = ?").run(JSON.stringify(list), row.id);
      fixed++;
    }
  }
  if (fixed) console.log(`[Vendorfy] Updated pictures on ${fixed} sample products.`);
}

module.exports = { addDemoData, syncDemoData, repairDemoImages };
