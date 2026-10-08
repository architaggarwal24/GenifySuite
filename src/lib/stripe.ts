import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/**
 * Lazily constructed so the app still boots without STRIPE_SECRET_KEY set
 * (the "use our shared key" AI features work without billing configured -
 * this is only needed once someone actually hits /pricing).
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to .env to enable billing.");
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  }
  return stripeInstance;
}
