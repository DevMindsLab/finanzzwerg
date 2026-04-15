/** Conditionally join class names (lightweight cx/clsx replacement). */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Format a decimal string as a localized currency amount. */
export function formatCurrency(amount: string | number, currency = "EUR"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

/** Format ISO date string to a short readable date. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Return a Tailwind text color class for positive/negative amounts. */
export function amountColor(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num > 0) return "text-emerald-600";
  if (num < 0) return "text-rose-600";
  return "text-slate-600";
}
