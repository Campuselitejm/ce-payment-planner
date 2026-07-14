import { supabase } from "./supabaseClient.js";
import { PLANS, PREMIUM_COUPONS, STANDARD_COUPONS } from "./lib.js";

// ---- profile / auth ----
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

// ---- email trigger ----
async function notify(type, account_id) {
  try { await supabase.functions.invoke("notify", { body: { action: "send", type, account_id } }); }
  catch (e) { console.warn("notify failed", type, e); }
}

// ---- accounts ----
export async function listAccounts() {
  const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAccountBundle(id) {
  const [{ data: account }, { data: payments }] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", id).single(),
    supabase.from("payments").select("*").eq("account_id", id).order("created_at"),
  ]);
  return { account, payments: payments || [] };
}

// ---- create application: deposit + receipt captured at creation ----
export async function createApplication(f, coordinatorId) {
  const price = PLANS[f.plan];
  const { data: account, error } = await supabase.from("accounts").insert({
    coordinator_id: coordinatorId,
    member_name: f.member_name, email: f.email, whatsapp: f.whatsapp || null,
    university: f.university, ce_id: f.ce_id,
    plan: f.plan, total: price.total, downpayment: price.down,
    deadline: f.deadline,
    status: "awaiting_signature",
  }).select().single();
  if (error) throw error;

  const receiptPath = await uploadReceipt(coordinatorId, account.id, f.deposit_receipt);
  await supabase.from("payments").insert({
    account_id: account.id, kind: "deposit", amount: price.down,
    method: f.deposit_method, paid_on: f.deposit_date, receipt_url: receiptPath,
    created_by: coordinatorId,
  });

  await notify("contract", account.id);
  return account;
}

// ---- mark signed → straight to active ----
export async function markSigned(account) {
  await supabase.from("accounts")
    .update({ status: "active", signed_at: new Date().toISOString() }).eq("id", account.id);
  await notify("plan_start", account.id);
}

// ---- receipts ----
export async function uploadReceipt(coordinatorId, accountId, file) {
  const path = `${coordinatorId}/${accountId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file);
  if (error) throw error;
  return path;
}

// ---- log a payment (deposit or later) → recalc → complete if balance cleared ----
export async function logPayment(account, { amount, method, paid_on, file }, coordinatorId) {
  let receiptPath = null;
  if (file) receiptPath = await uploadReceipt(coordinatorId, account.id, file);

  await supabase.from("payments").insert({
    account_id: account.id, kind: "payment", amount: Number(amount),
    method, paid_on, receipt_url: receiptPath, created_by: coordinatorId,
  });

  const { data: pays } = await supabase.from("payments").select("amount").eq("account_id", account.id);
  const paid = (pays || []).reduce((s, p) => s + p.amount, 0);

  if (paid >= account.total) {
    const coupon = await assignCoupon(account.plan);
    await supabase.from("accounts")
      .update({ status: "completed", completed_at: new Date().toISOString(), coupon_code: coupon })
      .eq("id", account.id);
    await notify("complete", account.id);
    await notify("admin_activate", account.id);
  } else {
    await notify("payment_logged", account.id);
  }
}

async function assignCoupon(plan) {
  const list = plan === "Premium" ? PREMIUM_COUPONS : STANDARD_COUPONS;
  const { data: used } = await supabase.from("accounts").select("coupon_code").eq("plan", plan).not("coupon_code", "is", null);
  const usedSet = new Set((used || []).map((u) => u.coupon_code));
  return list.find((c) => !usedSet.has(c)) || list[Math.floor(Math.random() * list.length)];
}

// ---- super admin: coordinators ----
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
