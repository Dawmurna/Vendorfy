// Sends the login code by email.
// With no SMTP settings in .env (your own computer), the code is printed in the terminal instead.
const nodemailer = require("nodemailer");

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

// Stop a risky setup before it can start
if (process.env.NODE_ENV === "production") {
  if (!transport) {
    console.error("SMTP_HOST is not set. Customers cannot receive login codes. Refusing to start in production.");
    process.exit(1);
  }
  if (process.env.DEV_SHOW_CODE === "true") {
    console.error("DEV_SHOW_CODE=true would let anyone log in as anyone. Remove it. Refusing to start in production.");
    process.exit(1);
  }
}

async function sendLoginCode(email, code) {
  if (!transport) {
    console.log(`\n  [Vendorfy] Login code for ${email}:  ${code}\n`);
    return;
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM || "Vendorfy <no-reply@vendorfy.local>",
    to: email,
    subject: `Your Vendorfy code is ${code}`,
    text:
      `Your Vendorfy login code is ${code}\n\n` +
      `It works for 10 minutes. If you did not ask for it, you can ignore this email.\n` +
      `Never share this code with anyone.`,
  });
}

module.exports = { sendLoginCode };
