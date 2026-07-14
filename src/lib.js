export const PLANS = {
  Premium: { total: 20000, down: 3000 },
  Standard: { total: 12000, down: 2000 },
};

export const HARD_DEADLINE = "2026-09-14";

export const DEADLINE_OPTIONS = [
  { date: "2026-07-24", label: "Fri, Jul 24" },
  { date: "2026-07-31", label: "Fri, Jul 31" },
  { date: "2026-08-07", label: "Fri, Aug 7" },
  { date: "2026-08-14", label: "Fri, Aug 14" },
  { date: "2026-08-21", label: "Fri, Aug 21" },
  { date: "2026-08-28", label: "Fri, Aug 28" },
  { date: "2026-09-04", label: "Fri, Sep 4" },
  { date: "2026-09-11", label: "Fri, Sep 11" },
  { date: "2026-09-14", label: "Mon, Sep 14 — hard deadline" },
];

export function availableDeadlines() {
  const today = new Date().toISOString().slice(0, 10);
  return DEADLINE_OPTIONS.filter((d) => d.date >= today);
}

export const PAYMENT_METHODS = ["NCB Bank", "Other Bank", "Online", "Zelle", "PayPal", "Cash"];

// Dummy 7-character coupon codes — replace with real ones later.
export const PREMIUM_COUPONS = ["CEP7XQ2","CEP9KLM","CEP3RTY","CEP5ZXC","CEP8QAZ","CEP2WSX","CEP6EDC","CEP4RFV","CEP1TGB","CEP0YHN"];
export const STANDARD_COUPONS = ["CES7XQ2","CES9KLM","CES3RTY","CES5ZXC","CES8QAZ","CES2WSX","CES6EDC","CES4RFV","CES1TGB","CES0YHN"];

export const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");

export function daysLeft(deadline) {
  const ms = new Date(deadline + "T00:00:00") - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  return Math.max(0, Math.ceil(ms / 86400000));
}

// Normalizes a Jamaican number into a wa.me link. Best-effort: handles
// 7-digit local, 10-digit with area code, or already-full international.
export function waLink(raw) {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 7) d = "876" + d;
  if (d.length === 10) d = "1" + d;
  if (!d.startsWith("1")) d = "1" + d;
  return `https://wa.me/${d}`;
}

export const STATUS = {
  awaiting_signature: { label: "Awaiting signature", pill: "bg-violet-50 text-violet-700", dot: "bg-brandpurple", edge: "border-l-brandpurple" },
  active:             { label: "Active",             pill: "bg-blue-50 text-blue-700",     dot: "bg-brandblue",  edge: "border-l-brandblue" },
  completed:          { label: "Complete",           pill: "bg-brandblue text-white",      dot: "bg-white",      edge: "border-l-brandblue" },
  invitational:       { label: "Rolled to Invitational", pill: "bg-amber-50 text-amber-700", dot: "bg-brandyellow", edge: "border-l-brandyellow" },
};

export function paidAmount(payments = []) {
  return payments.reduce((s, p) => s + (p.amount || 0), 0);
}
