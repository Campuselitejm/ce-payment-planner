// ---- plan tiers (T&C 2.4) ----
export const PARTY_PASS = "Premium Party Pass";
export const TRIP_PASS  = "Premium Trip Pass";
export const STANDARD   = "Standard Varsity";

export const PLANS = {
  [PARTY_PASS]: { total: 20000, down: 3000 },
  [TRIP_PASS]:  { total: 20000, down: 3000 },
  [STANDARD]:   { total: 12000, down: 2000 },
};
export const PLAN_KEYS = Object.keys(PLANS);

// T&C 7.1 — only fifty Party Passes exist.
export const PARTY_PASS_CAP = 50;

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

// ⚠️ DUMMY CODES — replace before launch. Party Pass needs at least 50.
export const COUPONS = {
  [PARTY_PASS]: ["CEP7XQ2","CEP9KLM","CEP3RTY","CEP5ZXC","CEP8QAZ","CEP2WSX","CEP6EDC","CEP4RFV","CEP1TGB","CEP0YHN"],
  [TRIP_PASS]:  ["CET7XQ2","CET9KLM","CET3RTY","CET5ZXC","CET8QAZ","CET2WSX","CET6EDC","CET4RFV","CET1TGB","CET0YHN"],
  [STANDARD]:   ["CES7XQ2","CES9KLM","CES3RTY","CES5ZXC","CES8QAZ","CES2WSX","CES6EDC","CES4RFV","CES1TGB","CES0YHN"],
};

// negative amounts render as -$35,000, not $-35,000
export const money = (n) => {
  const v = Number(n || 0);
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US");
};

export function daysLeft(deadline) {
  const ms = new Date(deadline + "T00:00:00") - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  return Math.max(0, Math.ceil(ms / 86400000));
}

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
  special_case:       { label: "Special case",       pill: "bg-rose-50 text-rose-700",     dot: "bg-rose-500",   edge: "border-l-rose-400" },
};

export function paidAmount(payments = []) {
  return payments.reduce((s, p) => s + (p.amount || 0), 0);
}
