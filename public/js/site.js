// ONE place for your company details.
// Everything on the site (footer, About, Contact, Privacy, Terms) reads from here.
// When you have the real details, change the values below and save. That is all.
//
// Anything inside [square brackets] is a placeholder. Replace it, brackets included.
const SITE = {
  name: "Vendorfy",
  domain: "vendorfy.shop",
  tagline: "An online marketplace where independent vendors in Nigeria sell to shoppers.",

  companyName: "[Registered company name]",
  rcNumber: "[CAC registration number]",
  address: "[Business address, city, state, Nigeria]",
  phone: "[Phone number]",

  // Create these mailboxes with your domain host before you go live (hello@ is the important one).
  email: "hello@vendorfy.shop",

  // Add your social pages here when you have them, for example instagram: "https://instagram.com/yourpage".
  // Empty ones are simply not shown.
  social: { instagram: "", x: "", facebook: "", youtube: "", linkedin: "" },

  lastUpdated: "5 November 2026",
};

function siteEmailLink() {
  return `<a href="mailto:${SITE.email}">${SITE.email}</a>`;
}

function siteFooterHtml() {
  const names = { instagram: "Instagram", x: "X", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn" };
  const social = Object.keys(SITE.social).filter((k) => SITE.social[k])
    .map((k) => `<a href="${SITE.social[k]}" target="_blank" rel="noopener">${names[k]}</a>`).join("");
  const year = new Date().getFullYear();
  return `
    <div class="sf-wrap">
      <div class="sf-grid">
        <div class="sf-about">
          <a href="index.html" class="logo" style="padding:0">vendorfy</a>
          <p>${SITE.tagline} Order online and pay when it arrives.</p>
          ${social ? `<div class="sf-social">${social}</div>` : ""}
        </div>
        <div>
          <h4>Marketplace</h4>
          <a href="shop.html">Products</a>
          <a href="login.html#signup">Create an account</a>
          <a href="vendor-login.html#register">Sell on Vendorfy</a>
          <a href="orders.html">My orders</a>
        </div>
        <div>
          <h4>Company</h4>
          <a href="about.html">About us</a>
          <a href="contact.html">Contact us</a>
          <a href="privacy.html">Privacy Policy</a>
          <a href="terms.html">Terms of Service</a>
        </div>
        <div>
          <h4>Get in touch</h4>
          <p>${SITE.companyName}<br>${SITE.address}<br>${SITE.phone}<br>${siteEmailLink()}</p>
        </div>
      </div>
      <div class="sf-bottom">
        <span>&copy; ${year} ${SITE.name}. Operated by ${SITE.companyName}.</span>
        <span>${SITE.domain}</span>
      </div>
    </div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  // Replace any old footer with the shared one
  document.querySelectorAll("footer.footer, footer.lfoot").forEach((f) => {
    f.className = "sitefoot";
    f.innerHTML = siteFooterHtml();
  });
  // Fill details inside the About, Contact, Privacy and Terms pages
  document.querySelectorAll("[data-site]").forEach((el) => { el.textContent = SITE[el.dataset.site] || ""; });
  document.querySelectorAll("[data-site-email]").forEach((el) => {
    el.innerHTML = siteEmailLink();
  });
});
