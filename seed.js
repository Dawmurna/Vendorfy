// Fills the database with sample vendors and products so the shop is not empty.
// Run it once with:  npm run seed
// For testing only. Do not run this on your live site.
require("dotenv").config();
const { db } = require("./server/db");
const { addDemoData } = require("./server/demo");

if (db.prepare("SELECT COUNT(*) AS n FROM products").get().n > 0 && !process.argv.includes("--force")) {
  console.log("The database already has products. Run with --force to add the samples anyway.");
  process.exit(0);
}
const r = addDemoData();
console.log(`Sample shop ready: ${r.added} products added, ${r.updated} updated, ${r.removed} removed.`);
