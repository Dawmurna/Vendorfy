// Every value a vendor sends is checked here. Never trust what the browser sends.
const CATEGORIES = [
  "Fashion", "Beauty", "Electronics", "Home & Kitchen", "Babies & Kids",
  "Health & Wellness", "Sports & Outdoors", "Groceries",
];

const MAX_PRICE = 50_000_000; // ₦50 million, stops typing mistakes like an extra zero

function toWholeNumber(value) {
  if (typeof value === "string") value = value.trim().replace(/,/g, "");
  if (value === "" || value === null || value === undefined) return NaN;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function cleanText(value, min, max) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text.length >= min && text.length <= max ? text : null;
}

const STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Delivery details. With required = false, empty fields are allowed (profile page).
function parseAddress(body, required) {
  const out = {};
  const fields = [
    ["name", 2, 60, "Full name must be 2 to 60 characters."],
    ["address", 5, 160, "Delivery address must be 5 to 160 characters."],
    ["city", 2, 60, "City must be 2 to 60 characters."],
  ];
  for (const [key, min, max, message] of fields) {
    const raw = body[key];
    if (!required && (raw === undefined || String(raw).trim() === "")) { out[key] = null; continue; }
    const text = cleanText(raw, min, max);
    if (!text) return { error: message };
    out[key] = text;
  }

  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!required && phoneRaw === "") out.phone = null;
  else {
    const digits = phoneRaw.replace(/[\s-]/g, "");
    if (!/^(\+?234|0)[789][01]\d{8}$/.test(digits)) {
      return { error: "Enter a valid Nigerian phone number, for example 0803 123 4567." };
    }
    out.phone = digits;
  }

  if (!required && (body.state === undefined || body.state === "")) out.state = null;
  else if (STATES.includes(body.state)) out.state = body.state;
  else return { error: "Please choose your state." };

  return { value: out };
}

function parseProduct(body) {
  const title = cleanText(body.title, 2, 80);
  if (!title) return { error: "Product name must be 2 to 80 characters." };

  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "";

  const price = toWholeNumber(body.price);
  if (!(price >= 1 && price <= MAX_PRICE)) {
    return { error: `Price must be a whole number between 1 and ${MAX_PRICE.toLocaleString("en-NG")}.` };
  }

  let oldPrice = null;
  if (body.oldPrice !== undefined && String(body.oldPrice).trim() !== "") {
    oldPrice = toWholeNumber(body.oldPrice);
    if (!(oldPrice > price && oldPrice <= MAX_PRICE)) {
      return { error: "Old price must be a whole number higher than the current price." };
    }
  }

  if (!CATEGORIES.includes(body.category)) return { error: "Please choose a valid category." };

  const stock = toWholeNumber(body.stock);
  if (!(stock >= 0 && stock <= 100000)) return { error: "Stock must be a whole number from 0 to 100,000." };

  const sizes = [...new Set(
    String(body.sizes || "").split(",").map((s) => s.trim()).filter(Boolean)
  )];
  if (sizes.length > 12 || sizes.some((s) => s.length > 8)) {
    return { error: "Sizes: up to 12, each up to 8 characters, separated by commas." };
  }

  return { value: { title, description, price, oldPrice, category: body.category, stock, sizes } };
}

// "12" -> 12. Anything else ("12abc", "1;DROP", "-3") -> null
function toId(text) {
  return /^\d{1,9}$/.test(String(text)) ? parseInt(text, 10) : null;
}

module.exports = { CATEGORIES, STATES, EMAIL_RE, cleanText, parseProduct, parseAddress, toId };
