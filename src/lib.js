// Plan pricing (JMD) and the hard deadline
export const PLANS = {
  Premium: { total: 20000, down: 3000 },
  Standard: { total: 12000, down: 2000 },
};
export const ABSOLUTE_DEADLINE = "2026-09-15";

export const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const iso = (d) => new Date(d).toISOString().slice(0, 10);

// Build equal installments from start → min(deadline, absolute). Final absorbs the remainder.
export function buildSchedule(startDate, deadline, frequency, remaining) {
  if (frequency === "Adhoc") return [];
  const end = new Date(Math.min(new Date(deadline).getTime(), new Date(ABSOLUTE_DEADLINE).getTime()));
  const dates = [];
  let d = new Date(startDate);
  if (frequency === "Weekly") {
    d = addDays(d, 7);
    while (d <= end) { dates.push(new Date(d)); d = addDays(d, 7); }
  } else { // Monthly
    d = addMonths(d, 1);
    while (d <= end) { dates.push(new Date(d)); d = addMonths(d, 1); }
  }
  if (dates.length === 0) dates.push(end); // deadline too close → single final payment
  const n = dates.length;
  const per = Math.floor(remaining / n);
  return dates.map((dt, i) => ({
    seq: i + 1,
    due_date: iso(dt),
    amount: i === n - 1 ? remaining - per * (n - 1) : per,
    status: "pending",
  }));
}

// Derive a display status from account + installments
export function displayStatus(a, installments = []) {
  if (a.status === "completed") return "done";
  if (a.status === "awaiting_signature") return "await";
  if (a.status === "signed") return "signed";
  if (a.status === "approved") return "pending"; // downpayment due
  // active:
  const today = iso(new Date());
  const missed = installments.some((i) => i.status === "missed" || (i.status === "pending" && i.due_date < today));
  return (a.at_risk || missed) ? "risk" : "active";
}

export const STATUS = {
  active:  { label: "On track",           pill: "bg-blue-50 text-blue-700",     dot: "bg-brandblue" },
  risk:    { label: "Needs attention",    pill: "bg-amber-50 text-amber-700",   dot: "bg-brandyellow" },
  await:   { label: "Awaiting signature", pill: "bg-violet-50 text-violet-700", dot: "bg-brandpurple" },
  signed:  { label: "Signed · to approve",pill: "bg-violet-50 text-violet-700", dot: "bg-brandpurple" },
  pending: { label: "Downpayment due",    pill: "bg-violet-50 text-violet-700", dot: "bg-brandpurple" },
  done:    { label: "Complete",           pill: "bg-brandblue text-white",      dot: "bg-white" },
};

export function paidAmount(payments = []) {
  return payments.reduce((s, p) => s + (p.amount || 0), 0);
}
