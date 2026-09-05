// Stripe client singleton. Mirrors src/config/db.js: one instance, required
// everywhere a Stripe call is needed.
//
// The secret key is read lazily (not at module load) so the server can still
// boot — and CI's `require('./src/app')` module-load check still passes —
// when STRIPE_SECRET_KEY isn't set (e.g. no Stripe configured yet). Any
// actual attempt to use the client without a key throws a clear error
// instead of a cryptic one from the Stripe SDK.
const Stripe = require("stripe");

let client = null;

function getStripeClient() {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY nu este configurat pe server.");
  }
  client = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  return client;
}

module.exports = { getStripeClient };
