import { supabase } from "./supabaseClient.js";
import { PLANS, PREMIUM_COUPONS, STANDARD_COUPONS } from "./lib.js";
import { compressImage } from "./compress.js";

// ---- error helper: turn network junk into something a coordinator understands ----
function netMsg(e, fallback = "Something went wrong. Please try again.") {
  const m = (e && (e.message || e.error_description)) || String(e || "");
  if (/load failed|failed to fetch|network|timeout|aborted/i.test(m))
    return "The connection dropped before this finished. Nothing was saved — check your signal and try again.";
  return m || fallback;
}

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

// ---- receipts: compress, sanitise, upload with one retry ----
export async function uploadReceipt(coordinatorId, file) {
  const prepared = await compressImage(file);

  if (prepared.size > 8 * 1024 * 1024)
    throw new Error("That file is too large to upload. Try a screenshot or a smaller photo.");

  const safe = (prepared.name || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `${coordinatorId}/${crypto.randomUUID()}-${safe}`;

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.storage.from("receipts").upload(path, prepared, {
      contentType: prepared.type || "application/octet-stream",
      upsert: true,
    });
    if (!error) return path;
    lastErr = error;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
  }
  throw new Error(netMsg(lastErr, "The receipt didn't upload."));
}

// ---- create application: receipt uploads FIRST, so a drop saves nothing at all ----
export async function createApplication(f, coordinatorId, onStage = () => {}) {
  const price = PLANS[f.plan];

  onStage("Uploading receipt…");
  const receiptPath = await uploadReceipt(coordinatorId, f.deposit_receipt);

  onStage("Creating plan…");
  const { data: account, error } = await supabase.from("accounts").insert({
    coordinator_id: coordinatorId,
    member_name: f.member_name, email: f.email, whatsapp: f.whatsapp || null,
    university: f.university, ce_id: f.ce_id,
    plan: f.plan, total: price.total, downpayment: price.down,
    deadline: f.deadline,
    status: "awaiting_signature",
  }).select().single();
  if (error) throw new Error(netMsg(error));

  onStage("Recording deposit…");
  const { error: payErr } = await supabase.from("payments").insert({
    account_id: account.id, kind: "deposit", amount: price.down,
    method: f.deposit_method, paid_on: f.deposit_date, receipt_url: receiptPath,
    created_by: coordinatorId,
  });
  if (payErr) {
    // roll back rather than leave a plan with no deposit against it
    await supabase.from("accounts").delete().eq("id", account.id);
    throw new Error(netMsg(payErr, "The deposit couldn't be recorded. Nothing was saved."));
  }

  onStage("Sending terms…");
  await notify("contract", account.id);
  return account;
}

// ---- mark signed → straight to active ----
export async function markSigned(account) {
  const { error } = await supabase.from("accounts")
    .update({ status: "active", signed_at: new Date().toISOString() }).eq("id", account.id);
  if (error) throw new Error(netMsg(error));
  await notify("plan_start", account.id);
}

// ---- log a payment → recalc → complete if balance cleared ----
export async function logPayment(account, { amount, method, paid_on, file }, coordinatorId) {
  let receiptPath = null;
  if (file) receiptPath = await uploadReceipt(coordinatorId, file);

  const { error: insErr } = await supabase.from("payments").insert({
    account_id: account.id, kind: "payment", amount: Number(amount),
    method, paid_on, receipt_url: receiptPath, created_by: coordinatorId,
  });
  if (insErr) throw new Error(netMsg(insErr, "The payment couldn't be saved."));

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
