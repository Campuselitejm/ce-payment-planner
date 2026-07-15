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

// Hard cap on Premium Party Passes (T&C 7.1).
export const PARTY_PASS_CAP = 30;

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

export const COUPONS = {
  // 30 codes — matches PARTY_PASS_CAP exactly.
  [PARTY_PASS]: [
    "VAR6IXPPPIHzYlR","VAR6IXPPP8LYafQ","VAR6IXPPP79IWqG","VAR6IXPPPtzgLxR","VAR6IXPPPnks5Ke",
    "VAR6IXPPPaeK8Xu","VAR6IXPPPWUDWRu","VAR6IXPPPhwVWAa","VAR6IXPPPTNAUiA","VAR6IXPPPMU3Eya",
    "VAR6IXPPP0j7dqC","VAR6IXPPPBJXWg2","VAR6IXPPPuOLsXt","VAR6IXPPPGCwmpQ","VAR6IXPPPd4sF7u",
    "VAR6IXPPP269Lii","VAR6IXPPP7o7XOG","VAR6IXPPPxd3MH9","VAR6IXPPPYKgUuR","VAR6IXPPPqQrNkk",
    "VAR6IXPPPg43uEF","VAR6IXPPPWWn8FB","VAR6IXPPP2CLO38","VAR6IXPPPBtwIko","VAR6IXPPPOF2ibi",
    "VAR6IXPPPETgJ3E","VAR6IXPPPjDdl8Z","VAR6IXPPPdQFaGQ","VAR6IXPPP2POPjn","VAR6IXPPPfAXjJ3",
  ],
  // 100 codes
  [TRIP_PASS]: [
    "VAR6IXPTPvkAK","VAR6IXPTPjUI0","VAR6IXPTPEoV6","VAR6IXPTPWEq2","VAR6IXPTPDovF",
    "VAR6IXPTPd57E","VAR6IXPTPI8aa","VAR6IXPTPVIwh","VAR6IXPTPxVTs","VAR6IXPTPAfXZ",
    "VAR6IXPTPgthV","VAR6IXPTPLeLl","VAR6IXPTP6jDD","VAR6IXPTPZQDK","VAR6IXPTPOFTD",
    "VAR6IXPTP6lzC","VAR6IXPTPECVZ","VAR6IXPTPdnVg","VAR6IXPTPb2aK","VAR6IXPTPCDYb",
    "VAR6IXPTP4mdV","VAR6IXPTP8H1d","VAR6IXPTPbPIg","VAR6IXPTPMeiF","VAR6IXPTPmBc6",
    "VAR6IXPTPENJD","VAR6IXPTPXgzg","VAR6IXPTPYYAx","VAR6IXPTPkyrD","VAR6IXPTPmRnE",
    "VAR6IXPTPrhwb","VAR6IXPTPvAIv","VAR6IXPTP04a1","VAR6IXPTPZpPJ","VAR6IXPTPmU3Q",
    "VAR6IXPTPy9xi","VAR6IXPTPVGE4","VAR6IXPTPTKeT","VAR6IXPTP4CVa","VAR6IXPTPfa8z",
    "VAR6IXPTPf8Qm","VAR6IXPTPXhPe","VAR6IXPTPXJg9","VAR6IXPTPKnoa","VAR6IXPTP6huB",
    "VAR6IXPTPCYOG","VAR6IXPTPgcA2","VAR6IXPTPffTo","VAR6IXPTPTxfW","VAR6IXPTPlo81",
    "VAR6IXPTPBb62","VAR6IXPTP6KDe","VAR6IXPTPmEUr","VAR6IXPTPoi5z","VAR6IXPTPArJq",
    "VAR6IXPTPgklN","VAR6IXPTPrehN","VAR6IXPTPTw9m","VAR6IXPTPWnx2","VAR6IXPTPzDY8",
    "VAR6IXPTPcgk9","VAR6IXPTP8Nus","VAR6IXPTP4tka","VAR6IXPTPdKeJ","VAR6IXPTPZFKC",
    "VAR6IXPTPIn3Z","VAR6IXPTPN4uY","VAR6IXPTPlGan","VAR6IXPTPUmCi","VAR6IXPTPgsRs",
    "VAR6IXPTPAGrL","VAR6IXPTP7R2H","VAR6IXPTPnHxW","VAR6IXPTPzpRy","VAR6IXPTP8cOv",
    "VAR6IXPTPDs1M","VAR6IXPTPBKss","VAR6IXPTPZGZF","VAR6IXPTPgNgw","VAR6IXPTPCGRD",
    "VAR6IXPTPczHH","VAR6IXPTPNdPj","VAR6IXPTP51l5","VAR6IXPTPOvwV","VAR6IXPTPMYtm",
    "VAR6IXPTPY5Iu","VAR6IXPTP69ys","VAR6IXPTPOw5q","VAR6IXPTPWHiO","VAR6IXPTPoH5e",
    "VAR6IXPTPxvL9","VAR6IXPTPkjty","VAR6IXPTPsXA2","VAR6IXPTPtLla","VAR6IXPTPBhk8",
    "VAR6IXPTPLnoo","VAR6IXPTPYCXj","VAR6IXPTPiI8s","VAR6IXPTPexL8","VAR6IXPTPDnUb",
  ],
  // 50 codes
  [STANDARD]: [
    "VAR6IXXasHKuICl","VAR6IXy7aEc5f1j","VAR6IXssUYbNpQk","VAR6IXjE1g7XFfC","VAR6IX0lBHtdUq5",
    "VAR6IXqp6c5xrXk","VAR6IXqU2i7Kr11","VAR6IX8Guuf0s0e","VAR6IXJsl8BisZs","VAR6IXf2s0yPi1N",
    "VAR6IXS3jMorfcb","VAR6IX6BtsNS2EF","VAR6IXs4LHQzwpZ","VAR6IXE0wIBSsyn","VAR6IXX1RkgAkKo",
    "VAR6IXWsFHuZIjs","VAR6IXDLnrG5Wmw","VAR6IXUnbjHwWDZ","VAR6IXjKPgNFWxe","VAR6IXDZMDD9eVO",
    "VAR6IXSdzQ6HzWQ","VAR6IXpVJRllfnk","VAR6IXtqecs1p9y","VAR6IX3glpb4xUG","VAR6IXFpOgiN2Kt",
    "VAR6IXMzEXdGQcB","VAR6IX5qCk7XQie","VAR6IXAjZVpxqqO","VAR6IXD7pG2ELdQ","VAR6IXhNU92HKfv",
    "VAR6IXxC7WfkLel","VAR6IXwRofV8TH5","VAR6IXLq5xsewRA","VAR6IXfQqe9v1GM","VAR6IXIZZNtR0Xl",
    "VAR6IXHGMTSBrDB","VAR6IX3cfNclnkq","VAR6IXvDrAcYgvA","VAR6IXrZzmEG81e","VAR6IXyew4kFqSa",
    "VAR6IXNNMqps4Vh","VAR6IXMKuM72nnK","VAR6IX3OoVUleqn","VAR6IXWPTOPkm8M","VAR6IXI1TqVmYTN",
    "VAR6IXUcpSsS7lj","VAR6IXHlUH5Gunu","VAR6IXKfVLwTzqT","VAR6IXDkXk9Vigs","VAR6IXxQJ5vS4XM",
  ],
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
  completed:          { label: "Complete",           pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", edge: "border-l-emerald-500" },
  invitational:       { label: "Rolled to Invitational", pill: "bg-amber-50 text-amber-700", dot: "bg-brandyellow", edge: "border-l-brandyellow" },
  special_case:       { label: "Special case",       pill: "bg-rose-50 text-rose-700",     dot: "bg-rose-500",   edge: "border-l-rose-400" },
};

export function paidAmount(payments = []) {
  return payments.reduce((s, p) => s + (p.amount || 0), 0);
}
