// Reuse the isolated test server; never read the developer's private .env files.
process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
process.env.NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8189';
process.env.NEXT_PUBLIC_PAYMENT_MODE = 'test';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_browser_fixture';
await import('./run-e2e-server.mjs');
