// Stripe's amount contract uses two decimals except these charge currencies.
const zeroDecimal = new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','VND','VUV','XAF','XOF','XPF']);
export function priceLabel(price: { currency: string; unitAmount: number; recurringInterval?: string | null; recurringIntervalCount?: number }) {
  const currency = price.currency.toUpperCase();
  const digits = zeroDecimal.has(currency) ? 0 : 2;
  const amount = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(price.unitAmount / 10 ** digits);
  const count = price.recurringIntervalCount ?? 1;
  return price.recurringInterval ? `${amount} / ${count > 1 ? `${count} ${price.recurringInterval}s` : price.recurringInterval}` : amount;
}
