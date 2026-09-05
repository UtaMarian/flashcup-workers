// Stripe webhook handler — the ONLY place a real-money shop purchase is
// fulfilled (resources granted). Never grant from the checkout-session
// creation call or from the browser returning to the success page: a
// player can pay successfully and lose their connection before that page
// loads, and Stripe's own recommended pattern is to drive fulfillment from
// the event, not the redirect. See players.controller.js createShopCheckout
// for how the matching PENDING ShopOrder is created.
const prisma = require("../config/db");
const { getStripeClient } = require("../config/stripe");
const logger = require("../config/logger");

/** Grants a fulfilled order's resources and marks it PAID. Idempotent: a
 * second delivery of the same event (Stripe retries webhooks at-least-once)
 * is a no-op once fulfilledAt is set. */
async function fulfillOrder(order, paymentIntentId) {
  if (order.fulfilledAt) return; // already fulfilled — safe no-op

  await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction so two near-simultaneous webhook
    // deliveries for the same session can't both pass the fulfilledAt check.
    const fresh = await tx.shopOrder.findUnique({ where: { id: order.id } });
    if (!fresh || fresh.fulfilledAt) return;

    const user = await tx.user.findUnique({ where: { id: fresh.userId } });
    if (!user) return;

    // Guards a race the session-creation check can't: two tabs opening two
    // Starter Pack sessions before either is fulfilled. Both can get paid;
    // only the first grants — this one is marked PAID (the player was
    // genuinely charged) without granting a second time. Needs a manual
    // refund from the Dashboard if it ever actually happens.
    if (fresh.kind === "starter" && user.starterPackClaimedAt) {
      await tx.shopOrder.update({
        where: { id: fresh.id },
        data: { status: "PAID", fulfilledAt: new Date(), stripePaymentIntentId: paymentIntentId || null },
      });
      logger.error({ userId: user.id, orderId: fresh.id }, "Starter Pack deja revendicat — comandă marcată PAID fără a acorda din nou. Verifică dacă e nevoie de rambursare.");
      return;
    }

    const data = {
      cash: user.cash + fresh.grantCash,
      energy: user.energy + fresh.grantEnergy,
      tokens: user.tokens + fresh.grantTokens,
    };
    if (fresh.kind === "starter") data.starterPackClaimedAt = new Date();

    await tx.user.update({ where: { id: user.id }, data });
    await tx.shopOrder.update({
      where: { id: fresh.id },
      data: { status: "PAID", fulfilledAt: new Date(), stripePaymentIntentId: paymentIntentId || null },
    });
  });
}

async function markOrderStatus(sessionId, status) {
  try {
    await prisma.shopOrder.update({ where: { stripeCheckoutSessionId: sessionId }, data: { status } });
  } catch {
    // No matching order (e.g. a Checkout Session not created by this shop) — ignore.
  }
}

// POST /api/stripe/webhook — mounted in app.js with a raw-body parser, BEFORE
// the global express.json() middleware (Stripe signature verification needs
// the exact raw bytes Stripe signed).
async function handleStripeWebhook(req, res) {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET nu este configurat — eveniment respins.");
    return res.status(500).send("Webhook not configured.");
  }

  let event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    logger.error({ err }, "Semnătură webhook Stripe invalidă");
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        // Delayed-notification payment methods fire "completed" while the
        // session is still unpaid — only fulfill once it's actually paid.
        if (session.payment_status === "unpaid") break;
        const order = await prisma.shopOrder.findUnique({ where: { stripeCheckoutSessionId: session.id } });
        if (order) await fulfillOrder(order, session.payment_intent || null);
        break;
      }
      case "checkout.session.async_payment_failed":
        await markOrderStatus(event.data.object.id, "FAILED");
        break;
      case "checkout.session.expired":
        await markOrderStatus(event.data.object.id, "EXPIRED");
        break;
      default:
        break; // every other event type is irrelevant to shop fulfillment
    }
    res.json({ received: true });
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Eroare la procesarea evenimentului webhook");
    // 500 -> Stripe retries the event later instead of silently losing it.
    res.status(500).send("Webhook handler error.");
  }
}

module.exports = { handleStripeWebhook };
