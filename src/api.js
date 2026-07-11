import { supabase } from "./supabaseClient.js";
import { PLANS, buildSchedule } from "./lib.js";

// ---- profile / auth ----
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data ? { ...data, email: user.email } : null;
}

// ---- email trigger ----
async function notify(type, account_id) {
  try { await supabase.functions.invoke("notify", { body: { action: "send", type, account_id } }); }
  catch (e) { console.warn("notify failed", type, e); } // don't block the UI on email failure
}

// ---- accounts (RLS scopes them automatically) ----
export async function listAccounts() {
  const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAccountBundle(id) {
  const [{ data: account }, { data: installments }, { data: payments }] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", id).single(),
    supabase.from("installments").select("*").eq("account_id", id).order("seq"),
    supabase.from("payments").select("*").eq("account_id", id).order("created_at"),
  ]);
  return { account, installments: installments || [], payments: payments || [] };
}

// ---- create application (status: awaiting_signature) + send contract email ----
export async function createApplication(f, coordinatorId) {
  const price = PLANS[f.plan];
  const { data, error } = await supabase.from("accounts").insert({
    coordinator_id: coordinatorId,
    member_name: f.member_name, email: f.email, university: f.university, ce_id: f.ce_id,
    plan: f.plan, total: price.total, downpayment: price.down,
    frequency: f.frequency, voluntary_deadline: f.voluntary_deadline,
    status: "awaiting_signature",
  }).select().single();
  if (error) throw error;
  await notify("contract", data.id);
  return data;
}

// ---- lifecycle transitions ----
export async function markSigned(id) {
  const { error } = await supabase.from("accounts")
    .update({ status: "signed", signed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function approveApplication(id) {
  const { error } = await supabase.from("accounts")
    .update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// ---- confirm downpayment → generate schedule → activate → plan_start email ----
export async function confirmDownpayment(account, receiptUrl, coordinatorId) {
  const start = new Date().toISOString().slice(0, 10);
  await supabase.from("payments").insert({
    account_id: account.id, kind: "downpayment", amount: account.downpayment,
    receipt_url: receiptUrl || null, created_by: coordinatorId,
  });
  const remaining = account.total - account.downpayment;
  const schedule = buildSchedule(start, account.voluntary_deadline, account.frequency, remaining);
  if (schedule.length) {
    await supabase.from("installments").insert(schedule.map((s) => ({ ...s, account_id: account.id })));
  }
  await supabase.from("accounts").update({ status: "active", start_date: start }).eq("id", account.id);
  await notify("plan_start", account.id);
}

// ---- upload a receipt to Storage, return public-ish signed path ----
export async function uploadReceipt(coordinatorId, accountId, file) {
  const path = `${coordinatorId}/${accountId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file);
  if (error) throw error;
  return path;
}

// ---- confirm an installment payment (with optional receipt) ----
export async function confirmInstallment(account, installment, receiptPath, coordinatorId) {
  await supabase.from("payments").insert({
    account_id: account.id, installment_id: installment.id, kind: "installment",
    amount: installment.amount, receipt_url: receiptPath || null, created_by: coordinatorId,
  });
  await supabase.from("installments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", installment.id);
  await maybeComplete(account.id);
}

// ---- log an adhoc payment ----
export async function logAdhoc(account, amount, receiptPath, coordinatorId) {
  await supabase.from("payments").insert({
    account_id: account.id, kind: "adhoc", amount: Number(amount),
    receipt_url: receiptPath || null, created_by: coordinatorId,
  });
  await maybeComplete(account.id);
}

// ---- completion check: total reached → completed + emails ----
async function maybeComplete(accountId) {
  const { data: account } = await supabase.from("accounts").select("*").eq("id", accountId).single();
  const { data: pays } = await supabase.from("payments").select("amount").eq("account_id", accountId);
  const paid = (pays || []).reduce((s, p) => s + p.amount, 0);
  if (account && account.status !== "completed" && paid >= account.total) {
    await supabase.from("accounts")
      .update({ status: "completed", at_risk: false, completed_at: new Date().toISOString() }).eq("id", accountId);
    await notify("complete", accountId);
    await notify("admin_activate", accountId);
  }
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
