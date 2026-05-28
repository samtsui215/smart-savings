/**
 * Money helpers.
 *
 * Internal representation is *integer cents*. We never let a Number with a
 * fractional component touch a balance — JS floats can't represent 0.10
 * exactly, and "1.10 + 2.20 !== 3.30" silently corrupts ledgers.
 *
 * For display we add thousands separators ("3,500.00"). Parsing strips
 * commas so users can round-trip the displayed value back into a form.
 */

const CENTS_PATTERN = /^-?\d+(\.\d{1,2})?$/;

/** Parse a dollar string (e.g. "12.34" or "3,500.00") into integer cents. */
export function dollarsToCents(input: string | number): number {
  // Strip commas first — they are display-only grouping.
  const s = (typeof input === "number" ? input.toString() : input.trim()).replace(/,/g, "");
  if (!CENTS_PATTERN.test(s)) {
    throw new Error(`Invalid money value: ${input}`);
  }
  const [whole, frac = ""] = s.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const wholeCents = Math.abs(parseInt(whole, 10)) * 100;
  const fracCents = parseInt((frac + "00").slice(0, 2), 10);
  return sign * (wholeCents + fracCents);
}

/** Format integer cents as a dollar string with two decimals and thousands separators. */
export function centsToDollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  // Insert a comma every 3 digits from the right of the integer part.
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}.${frac}`;
}

/** Reject anything non-finite or fractional — catches client tampering. */
export function assertPositiveCents(cents: number): void {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error(`Amount must be a positive integer cents value, got ${cents}`);
  }
}
