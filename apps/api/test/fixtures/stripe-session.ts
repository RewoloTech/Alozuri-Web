import type Stripe from 'stripe';

// Complete SDK fixture: critical payment/linkage fields stay explicit in each test.
export function checkoutSessionFixture(
  overrides: Pick<
    Stripe.Checkout.Session,
    | 'id'
    | 'livemode'
    | 'amount_total'
    | 'currency'
    | 'client_reference_id'
    | 'metadata'
    | 'payment_intent'
  > &
    Partial<Stripe.Checkout.Session>,
): Stripe.Checkout.Session {
  return {
    object: 'checkout.session',
    adaptive_pricing: null,
    after_expiration: null,
    allow_promotion_codes: null,
    allowed_payment_method_types: null,
    amount_subtotal: null,
    automatic_tax: { enabled: false, liability: null, provider: null, status: null },
    billing_address_collection: null,
    cancel_url: null,
    client_secret: null,
    collected_information: null,
    consent: null,
    consent_collection: null,
    created: 0,
    currency_conversion: null,
    custom_fields: [],
    custom_text: {
      after_submit: null,
      shipping_address: null,
      submit: null,
      terms_of_service_acceptance: null,
    },
    customer: null,
    customer_account: null,
    customer_creation: null,
    customer_details: null,
    customer_email: null,
    discounts: null,
    expires_at: 3600,
    integration_identifier: null,
    invoice: null,
    invoice_creation: null,
    locale: null,
    managed_payments: null,
    mode: 'payment',
    origin_context: null,
    payment_link: null,
    payment_method_collection: null,
    payment_method_configuration_details: null,
    payment_method_options: null,
    payment_method_types: ['card'],
    payment_status: 'paid',
    permissions: null,
    recovered_from: null,
    saved_payment_method_options: null,
    setup_intent: null,
    shipping_address_collection: null,
    shipping_cost: null,
    shipping_options: [],
    status: 'complete',
    submit_type: null,
    subscription: null,
    success_url: null,
    total_details: null,
    ui_mode: null,
    url: null,
    wallet_options: null,
    ...overrides,
  };
}
