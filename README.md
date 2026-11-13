# Vendorfy

A marketplace where vendors list their own products and set their own prices, and shoppers
create a free account (just an email, no password) to buy.
Built with Node.js, Express and SQLite. The pages are plain HTML, CSS and JavaScript.

## Run it on your computer

1. Install Node.js version 22 (LTS) from nodejs.org. Newer versions such as 24 can fail at `npm install` on Windows, because the database package has no ready-made build for them.
2. Open this folder in VS Code and open the terminal (Terminal menu, New Terminal).
3. Install the packages (only needed once, it creates the `node_modules` folder):

       npm install

4. Create your settings file. Copy `.env.example` to a new file called `.env`, then open `.env` and fill it in:
   - `JWT_SECRET`: run this in the terminal and paste the result in:
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: your own admin login (password at least 10 characters).
   - While testing you can set `AUTO_APPROVE_VENDORS=true` so new vendors can sell straight away.
   - Leave `DEV_SHOW_CODE=true` for now. It shows the login code on the page while you test.
5. (Optional) Load sample products so the shop is not empty. For testing only:

       npm run seed

6. Start the server:

       npm start

7. Open http://localhost:3000 in your browser.

Do not open the HTML files by double clicking them. The pages need the server to get their data.

## How shoppers log in (no password)

1. The shopper enters their email (and a name the first time) and clicks "Send me a code".
2. A 6-digit code is sent to that email. It works for 10 minutes.
3. They type the code and they are in. The browser stays logged in for 7 days.

While you test on your own computer no email is sent. The code is printed in the terminal where
the server runs, and also shown on the login page because of `DEV_SHOW_CODE=true`.

The code is stored scrambled, can be tried 5 times, and a new one can be requested once a minute.

## What the account remembers

Everything is saved on the server against the shopper's account, so it follows them to any phone or computer:

- cart and wishlist
- delivery details (name, phone, address, state)
- every order, with its status (placed, shipped, delivered, cancelled)

Guests can browse and add things to a cart (saved in their own browser). When they log in or sign up,
that cart is merged into their account. Guests cannot check out, see orders or open the account page.
Those send them to the login page, and then straight back to where they were going.

## Pages

| Page | What it is |
| --- | --- |
| `/index.html` | Landing page (the front door) |
| `/shop.html` | The shop home page |
| `/product.html?id=1` | Product page |
| `/login.html` | Shopper log in and create account |
| `/cart.html` | Cart (anyone) |
| `/checkout.html` | Checkout (account needed) |
| `/orders.html` | My orders, with cancel before it ships (account needed) |
| `/wishlist.html` | Saved items (account needed) |
| `/account.html` | Name and delivery details, log out (account needed) |
| `/vendor-login.html` | Vendors: sign up and log in (the admin logs in here too) |
| `/vendor.html` | Vendors: products, prices, and the orders to deliver |
| `/admin.html` | You: approve or suspend vendors |

## Buying

Payment is pay on delivery for now. When the shopper places an order the server:

- reads every price and the stock from the database (it never trusts a price sent by the browser),
- takes the items out of stock in one safe step, so two people cannot buy the last item,
- saves a copy of the title and price on the order, so later price changes do not rewrite history.

The vendor sees the delivery details for their own items only. They mark an item shipped, then delivered,
or cancel it (the stock goes back). Shoppers can cancel an item themselves until it ships.

## Folder guide

    server.js            starts the server
    seed.js              loads sample products (testing only)
    server/              the back-end code
      db.js              database tables (upgrades an older database by itself)
      auth.js            login cookie and "who is allowed in" checks
      mailer.js          sends the login code (prints it in the terminal until SMTP is set)
      validate.js        checks every price and field that is sent
      routes/            auth, customerAuth, me (account, cart, orders), shop (public), vendor, admin
    public/              everything the browser loads (HTML, CSS, JS, images)
    uploads/             pictures vendors upload (created automatically)
    data/                the database file (created automatically)

Never put secret files inside `public/`. Anything in that folder can be opened by anyone.

## Things that protect the site (already built in)

- Vendor and admin passwords are stored hashed (bcrypt). Shoppers have no password to steal.
- Login cookies cannot be read by JavaScript, and login and code requests are rate limited.
- Shoppers and vendors can only see and change their own data. The server checks this on every request.
- Asking for a code does not reveal whether an email has an account.
- Vendor and admin emails cannot be used for shopper login.
- Prices, quantities and addresses are checked on the server, not only in the browser.
- Uploads must be real JPG, PNG or WEBP pictures under 3 MB, saved with random file names.
- Anything a person types (names, titles, notes) is escaped before it is shown, so nobody can inject code into pages.
- New vendors are hidden from the shop until you approve them.

## Company details, About, Contact, Privacy and Terms

Your company details live in ONE file: `public/js/site.js`, at the top. The footer on every page, the About, Contact, Privacy and Terms pages all read from it.
Anything in [square brackets] is a placeholder. Replace it with the real value (brackets included) and save:

- `companyName`: your registered company name
- `rcNumber`: your CAC registration number
- `address` and `phone`: your business address and phone number
- `email`: currently hello@vendorfy.shop. Create that mailbox with your domain host before going live.
- `social`: paste your Instagram, X, Facebook and other page links. Empty ones are hidden.

The Privacy Policy and Terms of Service are plain-language drafts written for what Vendorfy does today. Have a lawyer read them before you rely on them, and update them when you add online payments.

## Putting it online for a test link (Render, free)

GitHub only stores your code. To get a link people can open, the server has to run somewhere. Render can do it straight from your GitHub repository, and `render.yaml` in this project sets almost everything up.

1. Push the project to GitHub (without `.env`, `node_modules` or `data`, which `.gitignore` already skips).
2. Go to render.com, sign up with GitHub, click New, then Blueprint, and pick your Vendorfy repository.
3. Render asks for `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Use an email you do NOT shop with, and a password of 10+ characters.
4. Click Apply. After a few minutes you get a link like `https://vendorfy.onrender.com`.
5. In the Render dashboard you can add your own domain (vendorfy.shop) under Settings, Custom Domains.

This setup is a test link, not the real thing:

- `DEMO_MODE=true` shows the login code on the page, so anyone can log in as any shopper. That is fine for showing the site to friends and testers. Turn it off, and set up the `SMTP_` email settings, before real customers arrive.
- The free plan sleeps when nobody visits (the first page load can take about a minute) and it does NOT keep files between restarts. Accounts, products and orders will reset now and then. For real use, choose a paid plan with a persistent disk, or move the database to a hosted one.
- `SEED_DEMO=true` keeps the shop filled with the sample products from `server/demo.js` every time the server starts. It adds any that are missing, updates their title, price and picture, and never resets stock. So the free link is never bare after a reset. A sample product you delete comes back on the next start. Remove this setting before real vendors and customers arrive, and delete the sample vendors then.

## Showing it on Vercel (pages on Vercel, server on Render)

Vercel cannot run the server and database, but it can show the pages and pass the site's data requests to your Render server. `vercel.json` does this.

1. Put the project on Render first (section above) and note its link, for example `https://vendorfy.onrender.com`.
2. Open `vercel.json` and replace both `YOUR-RENDER-NAME.onrender.com` with your Render address (no `https://` change needed, just the name).
3. In Render, add the setting `TRUST_PROXY` = `2`.
4. Push to GitHub. Vercel redeploys by itself.
5. In Vercel, under Settings, General, make sure Root Directory is empty and the project points at this repository.

Delete any old `index.html`, `css`, `js` and `images` folders from the top level of the GitHub repository. The current pages live inside `public/`.

## Replacing the sample pictures with your own photos

The sample shop only contains products that have a real photo, in `public/images/products/`. To change a picture, save your photo there with the SAME NAME as the one it replaces, ending in `.jpg`, `.png` or `.webp`. Keep the name lowercase.
To add a product, add a line for it in `server/demo.js`, put its photo in that folder with the matching name, and restart (or push so Render redeploys).

| Name to use | Product | Picture now |
| --- | --- | --- |
| `handbag` | Tan Leather Tote (Chic Collection) | your photo |
| `watch` | Gold Wristwatch (Timeless Hub) | your photo |
| `gold-chronograph` | Gold Chronograph Watch (Timeless Hub) | your photo |
| `tote-grey` | Grey Structured Tote (Chic Collection) | your photo |
| `tote-burgundy` | Burgundy Structured Tote (Chic Collection) | your photo |
| `tote-mocha` | Mocha Structured Tote (Chic Collection) | your photo |
| `tote-black` | Black Structured Tote (Chic Collection) | your photo |
| `handbag-black` | Black Textured Handbag (Chic Collection) | your photo |
| `handbag-beige` | Beige Teardrop Handbag (Chic Collection) | your photo |
| `handbag-taupe` | Taupe Handbag with Silver Handle (Chic Collection) | your photo |
| `clutch-black` | Black Evening Clutch (Luxe Closet) | your photo |
| `briefcase-black` | Black Leather Laptop Bag (Timeless Hub) | your photo |
| `briefcase-tan` | Tan Leather Briefcase (Timeless Hub) | your photo |
| `linen-set-white` | White Linen Shirt and Trouser Set (Linen Lane) | your photo |
| `linen-shirt-olive` | Olive Linen Shirt (Linen Lane) | your photo |
| `linen-set-sand-knot` | Sand Knot-Button Linen Set (Linen Lane) | your photo |
| `linen-set-navy-sand` | Navy Shirt and Sand Trouser Set (Linen Lane) | your photo |
| `linen-mandarin-espresso` | Espresso Mandarin Collar Linen Shirt (Linen Lane) | your photo |
| `linen-henley-black` | Black Linen Henley Shirt (Linen Lane) | your photo |
| `linen-shirt-apricot` | Apricot Linen Shirt (Linen Lane) | your photo |
| `linen-set-sand-navy` | Sand Shirt and Navy Trouser Set (Linen Lane) | your photo |
| `linen-popover-stripe` | Cream Striped Popover Shirt (Linen Lane) | your photo |
| `linen-set-navy` | Navy Linen Shirt and Trouser Set (Linen Lane) | your photo |
| `linen-popover-ivory` | Ivory Linen Popover Shirt (Linen Lane) | your photo |
| `linen-popover-brown` | Brown Linen Popover Shirt (Linen Lane) | your photo |
| `linen-henley-ivory` | Ivory Henley Shirt (Linen Lane) | your photo |
| `linen-popover-darkbrown` | Dark Brown Linen Popover Shirt (Linen Lane) | your photo |
| `linen-set-stripe-sand` | Sand Striped Shirt and Trouser Set (Linen Lane) | your photo |
| `linen-henley-mocha` | Mocha Linen Henley Shirt (Linen Lane) | your photo |
| `linen-set-stripe-green` | Green Striped Shirt and Trouser Set (Linen Lane) | your photo |
| `linen-set-stripe-rose` | Rose Striped Shirt and Trouser Set (Linen Lane) | your photo |

Tips: use square or near-square photos, about 800 by 800 pixels, under 500 KB each. Real vendor products use the photos the vendor uploads in the dashboard, not these files.

## Before you put it on the internet

- Set up email. Fill in the `SMTP_` lines in `.env` with an email service (Brevo, Mailgun, Gmail app password or similar). In production the server will not start without them, because shoppers could not get their codes.
- Delete `DEV_SHOW_CODE` from `.env`. The server refuses to start in production if it is on.
- Use HTTPS (most hosts give you this) and set `NODE_ENV=production` so the login cookie is HTTPS only.
- Set a real `JWT_SECRET` in the host's settings.
- Do not run `npm run seed` on the live site.
- Back up the `data/` and `uploads/` folders regularly. Many hosts wipe local files on redeploy, so choose one with a persistent disk.
- Do not upload `node_modules`. Run `npm install` on the host instead.

## Still to build

- Online payment (Paystack or Flutterwave). Keep reading prices from the database when you add it.
- Real Terms and Privacy pages (the links are placeholders).
- Chat and Notifications (the sidebar links are placeholders).
- Email to shoppers when an order ships, and email to vendors when they get an order.
- Reviews and vendor store pages.
