import PurchaseSuccessPage from '@/app/examples/purchase-success';

// Stripe Checkout returns here; the page checks the account's entitlements.
export default function PaymentReturn() { return <PurchaseSuccessPage />; }
