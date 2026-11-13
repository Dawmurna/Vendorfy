require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const { isTrue } = require("./server/env");
const { ensureAdmin } = require("./server/db");
const { loadUser } = require("./server/auth");

ensureAdmin();

const app = express();
app.disable("x-powered-by");
// Lets rate limiting see the real visitor when hosted behind a proxy.
// Behind Render alone use 1. With Vercel in front of Render, set TRUST_PROXY=2.
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));

// A few basic security headers on every response
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  next();
});

/* ---------- Website files (served first, no login check needed) ---------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads"), { maxAge: "7d" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());
app.use(loadUser);

/* ---------- API ---------- */
app.use("/api/auth", require("./server/routes/auth"));
app.use("/api/customer", require("./server/routes/customerAuth"));
app.use("/api/me", require("./server/routes/me"));
app.use("/api", require("./server/routes/shop").router);
app.use("/api/vendor", require("./server/routes/vendor"));
app.use("/api/admin", require("./server/routes/admin"));
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// Last-resort error handler: never show internals to visitors
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

// For test and demo links on hosts that forget their files: keep the sample shop filled in.
if (isTrue(process.env.SEED_DEMO)) require("./server/demo").syncDemoData();
require("./server/demo").repairDemoImages();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vendorfy is running at http://localhost:${PORT}`));
