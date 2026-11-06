// Products, vendors and prices now come from the server (see the /api routes).
// This file only keeps the things that are the same for everyone.

// The names must match the categories the server accepts (server/validate.js)
const categories = [
  { name: "All", icon: "grid" },
  { name: "Fashion", icon: "bag" },
  { name: "Beauty", icon: "bag" },
  { name: "Electronics", icon: "bag" },
  { name: "Home & Kitchen", icon: "bag" },
  { name: "Babies & Kids", icon: "bag" },
  { name: "Health & Wellness", icon: "bag" },
  { name: "Sports & Outdoors", icon: "bag" },
  { name: "Groceries", icon: "bag" },
  { name: "More", icon: "dots" },
];

const slideData = [
  { tag: "SUMMER SALE", title: "Up to 50% Off<br />On Everything", sub: "New styles. Top brands. Best prices." },
  { tag: "NEW IN", title: "Fresh Arrivals<br />Every Week", sub: "Be the first to shop the latest styles." },
  { tag: "FREE DELIVERY", title: "Free Delivery<br />Across Lagos", sub: "On all orders above ₦50,000." },
  { tag: "TOP VENDORS", title: "Shop From Trusted<br />Verified Vendors", sub: "Quality you can count on." },
];

// For the delivery address form (the server checks against the same list)
const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];
