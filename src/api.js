import { supabase } from "./supabaseClient.js";
import { PLANS, COUPONS, PARTY_PASS, PARTY_PASS_CAP, money } from "./lib.js";
import { compressImage } from "./compress.js";

function netMsg(e, fallback = "Something went wrong. Please try again.") {
  const m = (e && (e.message || e.error_description)) || String(e || "");
  if (/load failed|failed to fetch|network|timeout|aborted/i.test(m))
    return "The connection dropped before this finished. Nothing was saved — check your signal and try again.";
  return m || fallback;
}

export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data ? { ...data, email: user.email } : null;
}

export async function changeOwnPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

async function notify(type, account_id) {
  try { await supabase.functions.invoke("notify", { body: { action: "send", type, account_id } }); }
  catch (e) { console.warn("notify failed", type, e); }
}

export async function listAccounts() {
  const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(netMsg(error));
  return data || [];
}

export async function getAccountBundle(id) {
  const [{ data: account }, { data: payments }] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", id).single(),
    supabase.from("payments").select("*").eq("account_id", id).order("created_at"),
  ]);
  return { account, payments: payments || [] };
}

async function paidTotal(accountId) {
  const { data } = await supabase.from("payments").select("amount").eq("account_id", accountId);
  return (data || []).reduce((s, p) => s + p.amount, 0);
}

// T&C 7.2 — a Pass is secured only on full verified payment.
export async function securedPartyPasses() {
  const { count } = await supabase.from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("plan", PARTY_PASS).eq("status", "completed");
  return count || 0;
}

export async function partyPassesLeft() {
  return Math.max(0, PARTY_PASS_CAP - (await securedPartyPasses()));
}

// close out a fully-paid plan — guarded against double-firing
async function completeAccount(account) {
  const { data: fresh } = await supabase.from("accounts").select("status").eq("id", account.id).single();
  if (fresh?.status === "completed") return;            // already done, don't re-email
  if (fresh?.status === "special_case") return;

  // T&C 7.3 / 8 — sold out before this member secured one
  if (account.plan === PARTY_PASS && (await securedPartyPasses()) >= PARTY_PASS_CAP) {
    await supabase.from("accounts").update({
      status: "special_case",
      special_case_reason: "Party Pass sold out before this plan completed (T&C 8) — member to choose Trip Pass or Standard.",
    }).eq("id", account.id);
    await notify("party_sold_out", account.id);
    await notify("admin_special_case", account.id);
    return;
  }

  const coupon = await assignCoupon(account.plan);
  await supabase.from("accounts")
    .update({ status: "completed", completed_at: new Date().toISOString(), coupon_code: coupon })
    .eq("id", account.id);
  await notify("complete", account.id);
  await notify("admin_activate", account.id);
}

export async function uploadReceipt(coordinatorId, file) {
  const prepared = await compressImage(file);
  if (prepared.size > 8 * 1024 * 1024)
    throw new Error("That file is too large to upload. Try a screenshot or a smaller photo.");

  const safe = (prepared.name || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `${coordinatorId}/${crypto.randomUUID()}-${safe}`;

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.storage.from("receipts").upload(path, prepared, {
      contentType: prepared.type || "application/octet-stream", upsert: true,
    });
    if (!error) return path;
    lastErr = error;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
  }
  throw new Error(netMsg(lastErr, "The receipt didn't upload."));
}

export async function createApplication(f, coordinatorId, onStage = () => {}) {
  const price = PLANS[f.plan];
  if (!price) throw new Error("Unknown plan.");
  const opening = Number(f.deposit_amount);

  if (!opening || opening < price.down) throw new Error(`The opening payment must be at least ${money(price.down)}.`);
  if (opening > price.total) throw new Error(`That's more than the ${money(price.total)} plan total.`);

  onStage("Uploading receipt…");
  const receiptPath = await uploadReceipt(coordinatorId, f.deposit_receipt);

  onStage("Creating plan…");
  const { data: account, error } = await supabase.from("accounts").insert({
    coordinator_id: coordinatorId,
    member_name: f.member_name, email: f.email, whatsapp: f.whatsapp || null,
    university: f.university, ce_id: f.ce_id,
    plan: f.plan, total: price.total, downpayment: opening,
    deadline: f.deadline,
    status: "awaiting_signature",
  }).select().single();
  if (error) throw new Error(netMsg(error));

  onStage("Recording deposit…");
  const { error: payErr } = await supabase.from("payments").insert({
    account_id: account.id, kind: "deposit", amount: opening,
    method: f.deposit_method, paid_on: f.deposit_date, receipt_url: receiptPath,
    created_by: coordinatorId,
  });
  if (payErr) {
    await supabase.from("accounts").delete().eq("id", account.id);
    throw new Error(netMsg(payErr, "The deposit couldn't be recorded. Nothing was saved."));
  }

  onStage("Sending terms…");
  await notify("contract", account.id);
  return account;
}

export async function markSigned(account) {
  const { error } = await supabase.from("accounts")
    .update({ status: "active", signed_at: new Date().toISOString() }).eq("id", account.id);
  if (error) throw new Error(netMsg(error));

  if ((await paidTotal(account.id)) >= account.total) await completeAccount(account);
  else await notify("plan_start", account.id);
}

export async function logPayment(account, { amount, method, paid_on, file }, coordinatorId) {
  const amt = Number(amount);
  const alreadyPaid = await paidTotal(account.id);
  const remaining = account.total - alreadyPaid;

  if (!amt || amt <= 0) throw new Error("Enter a valid amount.");
  if (amt > remaining)
    throw new Error(`That's more than the ${money(remaining)} outstanding. An overpayment is a Special Case — flag it instead of logging it.`);

  let receiptPath = null;
  if (file) receiptPath = await uploadReceipt(coordinatorId, file);

  const { error: insErr } = await supabase.from("payments").insert({
    account_id: account.id, kind: "payment", amount: amt,
    method, paid_on, receipt_url: receiptPath, created_by: coordinatorId,
  });
  if (insErr) throw new Error(netMsg(insErr, "The payment couldn't be saved."));

  if ((await paidTotal(account.id)) >= account.total) await completeAccount(account);
  else await notify("payment_logged", account.id);
}

// throws rather than silently issuing a duplicate code
async function assignCoupon(plan) {
  const list = COUPONS[plan] || [];
  const { data: used } = await supabase.from("accounts").select("coupon_code").eq("plan", plan).not("coupon_code", "is", null);
  const usedSet = new Set((used || []).map((u) => u.coupon_code));
  const free = list.find((c) => !usedSet.has(c));
  if (!free) throw new Error(`No coupon codes left for ${plan}. Add more codes in lib.js before completing this plan.`);
  return free;
}

export async function listCoordinators() {
  const { data } = await supabase.from("profiles").select("*").eq("role", "coordinator").order("created_at");
  return data || [];
}
export async function approveCoordinator(id) {
  const { error } = await supabase.from("profiles").update({ approved: true }).eq("id", id);
  if (error) throw error;
}
export async function updateCoordinatorName(id, full_name) {
  const { error } = await supabase.from("profiles").update({ full_name }).eq("id", id);
  if (error) throw error;
}
export async function sendCoordinatorPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
