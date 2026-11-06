// Fills the database with the sample vendors and products from your design, so the shop is not empty.
// Run it once with:  npm run seed
// For testing only. Do not run this on your live site.
require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { db } = require("./server/db");

if (db.prepare("SELECT COUNT(*) AS n FROM products").get().n > 0 && !process.argv.includes("--force")) {
  console.log("The database already has products. Run with --force to add the samples anyway.");
  process.exit(0);
}

const vendors = [
  ["NovaWear", "Fashion"], ["Luxury Homes", "Home & Kitchen"], ["Modish Hub", "Fashion"],
  ["Chic Collection", "Fashion"], ["Luxe Closet", "Fashion"], ["Remix", "Fashion"],
  ["Timeless Hub", "Fashion"],
];

// [vendor, title, price, oldPrice, category, image file in public/images/products/, sizes]
const DRESS = "S,M,L,XL";
const products = [
  ["NovaWear", "Leaf Print Fit Summer Dress", 25000, 29000, "Fashion", "leaf-dress.jpg", DRESS],
  ["Luxury Homes", "Table Lamp", 23000, 28000, "Home & Kitchen", "table-lamp.jpg", ""],
  ["NovaWear", "Black Flower Dress", 30000, 33000, "Fashion", "black-dress.jpg", DRESS],
  ["Modish Hub", "Puff Sleeve Dress", 26000, 29000, "Fashion", "puff-dress.jpg", DRESS],
  ["Chic Collection", "Leather Handbag", 45000, 55000, "Fashion", "handbag.jpg", ""],
  ["Remix", "White Sneakers", 45000, null, "Fashion", "sneakers.jpg", "40,41,42,43"],
  ["Timeless Hub", "Gold Wristwatch", 175000, null, "Fashion", "watch.jpg", ""],
  ["Luxury Homes", "Microwave Oven", 175000, null, "Home & Kitchen", "microwave.jpg", ""],
  ["Chic Collection", "Leather Handbag", 45000, null, "Fashion", "handbag-green.jpg", ""],
  ["NovaWear", "Satin Evening Dress", 42000, null, "Fashion", "satin-dress.jpg", DRESS],
  ["NovaWear", "Floral Maxi Dress", 46000, null, "Fashion", "floral-maxi.jpg", DRESS],
  ["Luxe Closet", "Boho Floral Dress", 29000, null, "Fashion", "boho-dress.jpg", DRESS],
  ["Modish Hub", "Baggy Lady Jeans", 30000, null, "Fashion", "jeans.jpg", DRESS],
  ["Remix", "Wireless Headphones", 85000, null, "Electronics", "headphones.jpg", ""],
  ["Luxe Closet", "Satin Evening Dress", 42000, null, "Fashion", "satin-dress-2.jpg", DRESS],
];

const seed = db.transaction(() => {
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

seed();
console.log(`Added ${vendors.length} sample vendors and ${products.length} sample products.`);
