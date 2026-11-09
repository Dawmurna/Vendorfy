// Sample vendors and products, used by "npm run seed" and by SEED_DEMO=true.
// The vendors are fake and cannot be logged into. For testing and demo links only.
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { db } = require("./db");

const vendors = [
  ["NovaWear", "Fashion"], ["Luxury Homes", "Home & Kitchen"], ["Modish Hub", "Fashion"],
  ["Chic Collection", "Fashion"], ["Luxe Closet", "Fashion"], ["Remix", "Fashion"],
  ["Timeless Hub", "Fashion"],
];

// [vendor, title, price, oldPrice, category, image file in public/images/products/, sizes]
const DRESS = "S,M,L,XL";
const products = [
  ["NovaWear", "Leaf Print Fit Summer Dress", 25000, 29000, "Fashion", "leaf-dress.svg", DRESS],
  ["Luxury Homes", "Table Lamp", 23000, 28000, "Home & Kitchen", "table-lamp.svg", ""],
  ["NovaWear", "Black Flower Dress", 30000, 33000, "Fashion", "black-dress.svg", DRESS],
  ["Modish Hub", "Puff Sleeve Dress", 26000, 29000, "Fashion", "puff-dress.svg", DRESS],
  ["Chic Collection", "Leather Handbag", 45000, 55000, "Fashion", "handbag.svg", ""],
  ["Remix", "White Sneakers", 45000, null, "Fashion", "sneakers.svg", "40,41,42,43"],
  ["Timeless Hub", "Gold Wristwatch", 175000, null, "Fashion", "watch.svg", ""],
  ["Luxury Homes", "Microwave Oven", 175000, null, "Home & Kitchen", "microwave.svg", ""],
  ["Chic Collection", "Leather Handbag", 45000, null, "Fashion", "handbag-green.svg", ""],
  ["NovaWear", "Satin Evening Dress", 42000, null, "Fashion", "satin-dress.svg", DRESS],
  ["NovaWear", "Floral Maxi Dress", 46000, null, "Fashion", "floral-maxi.svg", DRESS],
  ["Luxe Closet", "Boho Floral Dress", 29000, null, "Fashion", "boho-dress.svg", DRESS],
  ["Modish Hub", "Baggy Lady Jeans", 30000, null, "Fashion", "jeans.svg", DRESS],
  ["Remix", "Wireless Headphones", 85000, null, "Electronics", "headphones.svg", ""],
  ["Luxe Closet", "Satin Evening Dress", 42000, null, "Fashion", "satin-dress-2.svg", DRESS],
];

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

  // Insert oldest first so the newest ends up at the top of New Arrivals
  for (const [vendor, title, price, oldPrice, category, img, sizes] of [...products].reverse()) {
    db.prepare(`INSERT INTO products (vendor_id, title, description, price, old_price, category, stock, sizes, images)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ids[vendor], title,
      `The ${title} from ${vendor} is made for everyday use. Quality materials, a clean finish and great value.`,
      price, oldPrice, category, 20,
      JSON.stringify(sizes ? sizes.split(",") : []),
      JSON.stringify(["/images/products/" + img]));
  }
});


function addDemoData() {
  run();
  return { vendors: vendors.length, products: products.length };
}

// Fills the shop only when it has no products at all, so restarts never create doubles.
function addDemoDataIfEmpty() {
  if (db.prepare("SELECT COUNT(*) AS n FROM products").get().n > 0) return false;
  const r = addDemoData();
  console.log(`[Vendorfy] SEED_DEMO is on: added ${r.vendors} sample vendors and ${r.products} sample products.`);
  return true;
}

// Keeps sample products pointing at the best picture that exists in public/images/products.
// A real photo (jpg, png or webp) with the same name wins over the .svg placeholder, so you can
// replace a placeholder just by dropping a file with the same name into that folder.
// If a picture is missing, the product falls back to whatever matching file is left.
function repairDemoImages() {
  const fs = require("fs");
  const path = require("path");
  const dir = path.join(__dirname, "..", "public", "images", "products");
  const ORDER = ["jpg", "jpeg", "png", "webp", "svg"];
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

module.exports = { addDemoData, addDemoDataIfEmpty, repairDemoImages };
