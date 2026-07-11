import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { PLANS, ABSOLUTE_DEADLINE, money, STATUS } from "./lib.js";
import * as api from "./api.js";

const COORD_COLORS = ["#2563EB", "#7C3AED", "#F5B400", "#1D4ED8", "#0EA5E9", "#DB2777"];
const colorFor = (i) => COORD_COLORS[i % COORD_COLORS.length];

// =====================================================================
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    api.getProfile().then((p) => { setProfile(p); setLoading(false); });
  }, [session]);

  if (loading) return <Center><Spinner /></Center>;
  if (!session) return <Login />;
  if (!profile) return <Center><p className="text-slate-500">Loading profile…</p></Center>;
  if (profile.role === "coordinator" && !profile.approved) return <Pending profile={profile} />;
  return <Dashboard profile={profile} />;
}

// ---------- shared bits ----------
const Center = ({ children }) => (
  <div className="min-h-screen grid place-items-center px-4">{children}</div>
);
const Spinner = () => (
  <div className="w-8 h-8 border-2 border-slate-200 border-t-brandblue rounded-full animate-spin" />
);
function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl grid place-items-center text-white font-extrabold"
        style={{ background: "linear-gradient(140deg,#2563EB,#7C3AED)" }}>CE</div>
      <div className="leading-tight">
        <div className="font-bold text-[15px]">Payment Plans</div>
        <div className="text-[11px] tracking-wider uppercase text-slate-400">Varsity SZN 6</div>
      </div>
    </div>
  );
}

// ---------- LOGIN ----------
function Login() {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  };
  return (
    <Center>
      <div className="w-full max-w-sm bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
        <div className="flex justify-center mb-5"><Brand /></div>
        <h1 className="text-xl font-extrabold text-center mb-1">Sign in</h1>
        <p className="text-slate-500 text-sm text-center mb-5">Coordinator & super-admin access</p>
        {err && <div className="bg-amber-50 text-amber-700 text-sm rounded-xl p-3 mb-3">{err}</div>}
        <input className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-3 text-sm" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-4 text-sm" placeholder="Password" type="password"
          value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button onClick={submit} disabled={busy}
          className="w-full py-3 rounded-xl bg-brandblue hover:bg-brandpurple text-white font-bold text-sm transition disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </Center>
  );
}

// ---------- PENDING APPROVAL ----------
function Pending({ profile }) {
  return (
    <Center>
      <div className="w-full max-w-sm bg-white border border-slate-100 rounded-2xl shadow-sm p-6 text-center">
        <div className="flex justify-center mb-5"><Brand /></div>
        <div className="w-12 h-12 rounded-full bg-violet-50 text-brandpurple grid place-items-center mx-auto mb-3 text-xl">⏳</div>
        <h1 className="text-lg font-extrabold mb-1">Awaiting approval</h1>
        <p className="text-slate-500 text-sm mb-5">Hi {profile.full_name || profile.email} — the super admin needs to approve your account before you can start managing plans.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-sm font-semibold text-slate-500">Sign out</button>
      </div>
    </Center>
  );
}

// =====================================================================
// DASHBOARD
// =====================================================================
function Dashboard({ profile }) {
  const isAdmin = profile.role === "super_admin";
  const [screen, setScreen] = useState("board");       // board | new | coordinators
  const [board, setBoard] = useState({ accounts: [], paidMap: {}, riskMap: {} });
  const [coordMap, setCoordMap] = useState({});
  const [coordFilter, setCoordFilter] = useState(null); // super admin
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [toast, setToast] = useState("");

  async function loadBoard() {
    const accounts = await api.listAccounts();
    const ids = accounts.map((a) => a.id);
    const paidMap = {}, riskMap = {};
    if (ids.length) {
      const { data: pays } = await supabase.from("payments").select("account_id,amount").in("account_id", ids);
      (pays || []).forEach((p) => { paidMap[p.account_id] = (paidMap[p.account_id] || 0) + p.amount; });
      const today = new Date().toISOString().slice(0, 10);
      const { data: insts } = await supabase.from("installments").select("account_id,status,due_date").in("account_id", ids);
      (insts || []).forEach((i) => { if (i.status === "missed" || (i.status === "pending" && i.due_date < today)) riskMap[i.account_id] = true; });
    }
    setBoard({ accounts, paidMap, riskMap });
  }
  async function loadCoords() {
    if (!isAdmin) return;
    const list = await api.listCoordinators();
    const map = {}; list.forEach((c, i) => { map[c.id] = { ...c, color: colorFor(i) }; });
    setCoordMap(map);
  }
  useEffect(() => { loadBoard(); loadCoords(); }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 3200); };

  function statusOf(a) {
    if (a.status === "completed") return "done";
    if (a.status === "awaiting_signature") return "await";
    if (a.status === "signed") return "signed";
    if (a.status === "approved") return "pending";
    return board.riskMap[a.id] || a.at_risk ? "risk" : "active";
  }

  const visible = useMemo(() => {
    let s = board.accounts;
    if (isAdmin && coordFilter) s = s.filter((a) => a.coordinator_id === coordFilter);
    if (filter !== "all") s = s.filter((a) => statusOf(a) === filter);
    if (q) { const t = q.toLowerCase(); s = s.filter((a) => (a.ce_id + " " + a.member_name).toLowerCase().includes(t)); }
    return s;
  }, [board, filter, q, coordFilter]);

  const stats = useMemo(() => {
    const set = isAdmin && coordFilter ? board.accounts.filter((a) => a.coordinator_id === coordFilter) : board.accounts;
    const collected = set.reduce((s, a) => s + (board.paidMap[a.id] || 0), 0);
    const outstanding = set.reduce((s, a) => s + (a.total - (board.paidMap[a.id] || 0)), 0);
    const active = set.filter((a) => statusOf(a) === "active").length;
    const risk = set.filter((a) => statusOf(a) === "risk").length;
    return { collected, outstanding, active, risk };
  }, [board, coordFilter]);

  const FILTERS = [["all", "All"], ["active", "On track"], ["risk", "Attention"], ["await", "Awaiting"], ["done", "Complete"]];

  return (
    <div className="pb-20">
      {/* top bar */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="mr-auto"><Brand /></div>
          <nav className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <NavBtn on={screen === "board"} onClick={() => setScreen("board")}>Accounts</NavBtn>
            {!isAdmin && <NavBtn on={screen === "new"} onClick={() => setScreen("new")}>+ New</NavBtn>}
            {isAdmin && <NavBtn on={screen === "coordinators"} onClick={() => setScreen("coordinators")}>Coordinators</NavBtn>}
          </nav>
          <button onClick={() => supabase.auth.signOut()} className="text-[13px] font-semibold text-slate-500 px-2">Sign out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6">
        {screen === "coordinators" && <Coordinators onChange={loadCoords} coordMap={coordMap} />}

        {screen === "new" && (
          <NewApplication profile={profile} onDone={(name) => { setScreen("board"); loadBoard(); flash(`Application sent · contract emailed to ${name}`); }} />
        )}

        {screen === "board" && (
          <>
            <div className="pt-7 pb-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{isAdmin ? "All accounts" : "My accounts"}</h1>
              <p className="text-slate-500 text-sm mt-1.5">
                {isAdmin ? "Every account across all coordinators. Tap a coordinator to focus." : "Every member you've enrolled and where their plan stands."}
              </p>
            </div>

            {/* stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <Stat k="Collected" v={`${money(stats.collected)}`} sub="JMD" tone="text-brandblue" />
              <Stat k="Outstanding" v={`${money(stats.outstanding)}`} sub="JMD" tone="text-slate-900" />
              <Stat k="Active plans" v={stats.active} tone="text-brandpurple" />
              <Stat k="Need attention" v={stats.risk} tone="text-amber-600" />
            </div>

            {/* super-admin coordinator summary */}
            {isAdmin && (
              <div className="mt-6">
                <h2 className="text-base font-bold mb-3">Per-coordinator summary</h2>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
                  {Object.values(coordMap).map((c) => {
                    const set = board.accounts.filter((a) => a.coordinator_id === c.id);
                    const col = set.reduce((s, a) => s + (board.paidMap[a.id] || 0), 0);
                    const tgt = set.reduce((s, a) => s + a.total, 0);
                    const risk = set.filter((a) => statusOf(a) === "risk").length;
                    const pct = tgt ? Math.round((col / tgt) * 100) : 0;
                    const on = coordFilter === c.id;
                    return (
                      <button key={c.id} onClick={() => setCoordFilter(on ? null : c.id)}
                        className={`text-left bg-white border rounded-2xl p-4 shadow-sm transition ${on ? "border-brandblue ring-2 ring-blue-100" : "border-slate-100"}`}>
                        <div className="flex items-center gap-2.5 font-bold text-[15px]">
                          <span className="w-7 h-7 rounded-lg grid place-items-center text-white text-[13px]" style={{ background: c.color }}>{(c.full_name || "?")[0]}</span>
                          {c.full_name || "Unnamed"}
                        </div>
                        <Row l="Accounts" v={set.length} />
                        <Row l="Collected" v={money(col)} />
                        <Row l="Need attention" v={risk} warn={risk > 0} />
                        <div className="h-1.5 rounded-full bg-slate-100 mt-3 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#2563EB,#7C3AED)" }} />
                        </div>
                        <Row l="Toward target" v={`${pct}%`} />
                      </button>
                    );
                  })}
                </div>
                {coordFilter && <button onClick={() => setCoordFilter(null)} className="text-[13px] font-semibold text-brandblue mt-3">Clear coordinator filter</button>}
              </div>
            )}

            {/* controls */}
            <div className="sticky top-[60px] z-10 pt-5 pb-3 mt-2" style={{ background: "linear-gradient(#F8FAFC 74%,transparent)" }}>
              <div className="relative mb-3">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by CE ID or name…"
                  className="w-full bg-white border border-slate-200 rounded-2xl text-[15px] px-4 py-3.5 focus:outline-none focus:border-brandblue focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="flex gap-2.5 flex-wrap">
                {FILTERS.map(([k, l]) => {
                  const n = k === "all" ? visible.length : board.accounts.filter((a) => statusOf(a) === k).length;
                  const on = filter === k;
                  return (
                    <button key={k} onClick={() => setFilter(k)}
                      className={`text-[13.5px] font-semibold px-4 py-2 rounded-full border transition ${on ? "bg-brandblue text-white border-brandblue" : "bg-white text-slate-500 border-slate-200 hover:border-brandblue hover:text-brandblue"}`}>
                      {l}<span className="text-xs ml-1.5 opacity-70">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* cards */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
              {visible.length ? visible.map((a) => (
                <Card key={a.id} a={a} paid={board.paidMap[a.id] || 0} st={statusOf(a)} isAdmin={isAdmin}
                  coord={coordMap[a.coordinator_id]} onOpen={() => setDetailId(a.id)} />
              )) : (
                <div className="col-span-full text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-500">
                  <b className="block text-lg text-slate-900 mb-1.5">No accounts match</b>Try another CE ID or clear the filter.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {detailId && (
        <AccountDetail id={detailId} profile={profile} onClose={() => setDetailId(null)}
          onChange={() => { loadBoard(); }} flash={flash} />
      )}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg z-50">{toast}</div>}
    </div>
  );
}

const NavBtn = ({ on, children, ...p }) => (
  <button {...p} className={`text-[13px] font-semibold px-4 py-2 rounded-lg ${on ? "bg-brandblue text-white" : "text-slate-500"}`}>{children}</button>
);
const Stat = ({ k, v, sub, tone }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
    <div className="text-xs text-slate-500 font-medium">{k}</div>
    <div className={`text-[22px] font-extrabold mt-1.5 tabular-nums ${tone}`}>{v} {sub && <span className="text-xs text-slate-400 font-semibold">{sub}</span>}</div>
  </div>
);
const Row = ({ l, v, warn }) => (
  <div className="flex justify-between text-[13px] text-slate-500 mt-2.5"><span>{l}</span><b className={`tabular-nums ${warn ? "text-amber-600" : "text-slate-900"}`}>{v}</b></div>
);

// ---------- CARD ----------
function Card({ a, paid, st, isAdmin, coord, onOpen }) {
  const S = STATUS[st];
  const remaining = a.total - paid;
  const pct = Math.round((paid / a.total) * 100);
  const cta = st === "await" ? "Mark as signed" : st === "signed" ? "Approve application"
    : st === "pending" ? "Confirm downpayment" : st === "done" ? "View summary" : "Manage plan";
  const line = st === "done" ? ["Settled", "Membership activation queued"]
    : st === "await" ? ["Waiting", "Member to sign contract"]
    : st === "signed" ? ["Ready", "Approve to continue"]
    : st === "pending" ? ["To start", "Confirm downpayment"]
    : st === "risk" ? ["Attention", "Payment missed · recalculated"]
    : ["Progress", `${pct}% paid`];
  return (
    <article onClick={onOpen} className="rise bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-lg transition cursor-pointer">
      <div className="flex items-center justify-between gap-2.5 mb-3.5">
        <span className="text-xs font-bold text-slate-500">{a.plan} <span className="text-slate-400 font-medium">· {money(a.total)}</span></span>
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full ${S.pill}`}><span className={`w-1.5 h-1.5 rounded-full ${S.dot}`} />{S.label}</span>
      </div>
      <div className="text-[21px] font-bold tracking-tight leading-tight">{a.member_name}</div>
      <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
        <span className="text-xs font-bold text-brandpurple bg-violet-50 px-2.5 py-1 rounded-lg" style={{ fontFamily: "ui-monospace,monospace" }}>{a.ce_id}</span>
        <span className="text-[13px] text-slate-500">{a.university} · {a.frequency}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2.5 my-4">
        <span className="text-[26px] font-extrabold tabular-nums tracking-tight"><span className="text-sm text-slate-400 font-semibold">$</span>{remaining.toLocaleString("en-US")}</span>
        <span className="text-[12.5px] text-slate-500 text-right">remaining<br />of {money(a.total)} · paid <b className="text-brandblue">{money(paid)}</b></span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#2563EB,#7C3AED)" }} />
      </div>
      <div className="flex items-center gap-2.5 mt-4 text-[13.5px]">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{line[0]}</span>
        <b className={st === "risk" ? "text-amber-700" : "text-slate-900"}>{line[1]}</b>
      </div>
      <button className="w-full mt-4 py-3 rounded-xl bg-brandblue hover:bg-brandpurple text-white font-bold text-sm transition">{cta}</button>
      {isAdmin && coord && (
        <div className="flex items-center gap-2 mt-3.5 pt-3.5 border-t border-slate-100 text-[12.5px] text-slate-500">
          Managed by <span className="w-5 h-5 rounded-md grid place-items-center text-white text-[11px]" style={{ background: coord.color }}>{(coord.full_name || "?")[0]}</span>{coord.full_name}
        </div>
      )}
    </article>
  );
}

// ---------- NEW APPLICATION ----------
function NewApplication({ profile, onDone }) {
  const [f, setF] = useState({ member_name: "", email: "", university: "UWI Mona", ce_id: "", plan: "Premium", frequency: "Weekly", voluntary_deadline: "" });
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const price = PLANS[f.plan];

  const submit = async () => {
    setErr("");
    if (!f.member_name || !f.email || !f.ce_id) return setErr("Name, email and CE ID are required.");
    if (!f.voluntary_deadline) return setErr("Pick a voluntary deadline.");
    if (f.voluntary_deadline > ABSOLUTE_DEADLINE) return setErr(`Deadline can't be after ${ABSOLUTE_DEADLINE}.`);
    if (!terms) return setErr("Confirm the member agrees to the terms.");
    setBusy(true);
    try { await api.createApplication(f, profile.id); onDone(f.member_name); }
    catch (e) { setErr(e.message || String(e)); setBusy(false); }
  };

  const Field = ({ label, children }) => (
    <label className="block mb-4"><span className="text-[13px] font-semibold text-slate-600">{label}</span>{children}</label>
  );
  const inp = "w-full border border-slate-200 rounded-xl px-4 py-3 mt-1.5 text-sm focus:outline-none focus:border-brandblue focus:ring-2 focus:ring-blue-100";

  return (
    <div className="max-w-lg mx-auto pt-7">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">New application</h1>
      <p className="text-slate-500 text-sm mb-6">The member gets an email to sign the agreement. Approve it here once they've signed.</p>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
        {err && <div className="bg-amber-50 text-amber-700 text-sm rounded-xl p-3 mb-4">{err}</div>}
        <Field label="Full name"><input className={inp} value={f.member_name} onChange={set("member_name")} /></Field>
        <Field label="Email"><input className={inp} value={f.email} onChange={set("email")} type="email" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="University">
            <select className={inp} value={f.university} onChange={set("university")}><option>UWI Mona</option><option>UTech</option><option>Other</option></select>
          </Field>
          <Field label="CE ID"><input className={inp} value={f.ce_id} onChange={set("ce_id")} placeholder="CE-0000" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan">
            <select className={inp} value={f.plan} onChange={set("plan")}><option>Premium</option><option>Standard</option></select>
          </Field>
          <Field label="Frequency">
            <select className={inp} value={f.frequency} onChange={set("frequency")}><option>Weekly</option><option>Monthly</option><option>Adhoc</option></select>
          </Field>
        </div>
        <div className="bg-slate-50 rounded-xl p-3.5 text-sm text-slate-600 mb-4 flex justify-between">
          <span>Total <b className="text-slate-900">{money(price.total)}</b></span>
          <span>Downpayment to start <b className="text-brandpurple">{money(price.down)}</b></span>
        </div>
        <Field label={`Voluntary deadline (on/before ${ABSOLUTE_DEADLINE})`}>
          <input className={inp} type="date" max={ABSOLUTE_DEADLINE} value={f.voluntary_deadline} onChange={set("voluntary_deadline")} />
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-slate-600 mb-5">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" />
          Member agrees to the Campus Elite payment plan terms of agreement.
        </label>
        <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl bg-brandblue hover:bg-brandpurple text-white font-bold text-sm transition disabled:opacity-60">
          {busy ? "Sending…" : "Send application"}
        </button>
      </div>
    </div>
  );
}

// ---------- COORDINATORS (super admin) ----------
function Coordinators({ onChange, coordMap }) {
  const [list, setList] = useState([]);
  const load = async () => setList(await api.listCoordinators());
  useEffect(() => { load(); }, []);
  const approve = async (id) => { await api.approveCoordinator(id); await load(); onChange && onChange(); };
  return (
    <div className="max-w-2xl mx-auto pt-7">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Coordinators</h1>
      <p className="text-slate-500 text-sm mb-6">Approve a coordinator to unlock their account on first login.</p>
      <div className="space-y-3">
        {list.map((c, i) => (
          <div key={c.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg grid place-items-center text-white font-bold" style={{ background: colorFor(i) }}>{(c.full_name || c.id)[0]}</span>
            <div className="mr-auto">
              <div className="font-bold text-[15px]">{c.full_name || "Unnamed coordinator"}</div>
              <div className="text-[13px] text-slate-500">{c.approved ? "Approved" : "Awaiting approval"}</div>
            </div>
            {c.approved
              ? <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full">Active</span>
              : <button onClick={() => approve(c.id)} className="text-sm font-bold text-white bg-brandblue hover:bg-brandpurple px-4 py-2 rounded-xl transition">Approve</button>}
          </div>
        ))}
        {!list.length && <p className="text-slate-500 text-sm">No coordinators yet.</p>}
      </div>
    </div>
  );
}

// ---------- ACCOUNT DETAIL ----------
function AccountDetail({ id, profile, onClose, onChange, flash }) {
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [adhocAmt, setAdhocAmt] = useState("");

  const load = async () => setBundle(await api.getAccountBundle(id));
  useEffect(() => { load(); }, [id]);

  if (!bundle || !bundle.account) return (
    <Overlay onClose={onClose}><div className="grid place-items-center py-16"><Spinner /></div></Overlay>
  );
  const a = bundle.account;
  const paid = bundle.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = a.total - paid;

  const wrap = async (fn, msg) => { setBusy(true); try { await fn(); await load(); onChange(); msg && flash(msg); } catch (e) { flash(e.message || String(e)); } setBusy(false); };

  const doDownpayment = () => wrap(async () => {
    let path = null; if (file) path = await api.uploadReceipt(a.coordinator_id, a.id, file);
    await api.confirmDownpayment(a, path, profile.id); setFile(null);
  }, "Plan activated · start email sent");

  const doInstallment = (inst) => wrap(async () => {
    let path = null; if (file) path = await api.uploadReceipt(a.coordinator_id, a.id, file);
    await api.confirmInstallment(a, inst, path, profile.id); setFile(null);
  }, "Payment confirmed");

  const doAdhoc = () => wrap(async () => {
    if (!adhocAmt) throw new Error("Enter an amount");
    let path = null; if (file) path = await api.uploadReceipt(a.coordinator_id, a.id, file);
    await api.logAdhoc(a, adhocAmt, path, profile.id); setAdhocAmt(""); setFile(null);
  }, "Adhoc payment logged");

  const FileRow = () => (
    <label className="flex items-center gap-2 text-[13px] text-slate-500 cursor-pointer">
      <span className="px-3 py-2 rounded-lg border border-slate-200 font-semibold">{file ? "Receipt attached" : "Attach receipt"}</span>
      <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} accept="image/*,application/pdf" />
    </label>
  );

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-[22px] font-extrabold tracking-tight">{a.member_name}</div>
          <div className="text-[13px] text-slate-500 mt-1">{a.ce_id} · {a.university} · {a.plan} · {a.frequency}</div>
        </div>
        <button onClick={onClose} className="text-slate-400 text-2xl leading-none">×</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <MiniStat k="Total" v={money(a.total)} />
        <MiniStat k="Paid" v={money(paid)} tone="text-brandblue" />
        <MiniStat k="Remaining" v={money(remaining)} tone="text-brandpurple" />
      </div>

      {/* lifecycle actions */}
      {a.status === "awaiting_signature" && (
        <ActionBox title="Contract sent — waiting on signature"
          note="The signable link was emailed to the member. Once they've signed, mark it here.">
          <PrimaryBtn busy={busy} onClick={() => wrap(() => api.markSigned(a.id), "Marked as signed")}>Mark as signed</PrimaryBtn>
        </ActionBox>
      )}
      {a.status === "signed" && (
        <ActionBox title="Signed — approve to continue" note="Approving moves this to downpayment confirmation.">
          <PrimaryBtn busy={busy} onClick={() => wrap(() => api.approveApplication(a.id), "Application approved")}>Approve application</PrimaryBtn>
        </ActionBox>
      )}
      {a.status === "approved" && (
        <ActionBox title={`Confirm downpayment of ${money(a.downpayment)}`}
          note="Confirming starts the plan, builds the payment schedule, and emails the member their terms + group chat link.">
          <div className="flex items-center gap-3 flex-wrap"><FileRow /><PrimaryBtn busy={busy} onClick={doDownpayment}>Confirm downpayment</PrimaryBtn></div>
        </ActionBox>
      )}

      {/* active plan: schedule */}
      {(a.status === "active" || a.status === "completed") && a.frequency !== "Adhoc" && (
        <div className="mb-2">
          <h3 className="font-bold text-[15px] mb-2">Payment schedule</h3>
          <div className="space-y-2">
            {bundle.installments.map((inst) => {
              const overdue = inst.status === "pending" && inst.due_date < new Date().toISOString().slice(0, 10);
              return (
                <div key={inst.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3.5 py-3">
                  <div className="mr-auto">
                    <div className="text-sm font-semibold">{inst.due_date} <span className="text-slate-400 font-normal">· #{inst.seq}</span></div>
                    <div className={`text-[12px] font-semibold ${inst.status === "paid" ? "text-blue-600" : overdue || inst.status === "missed" ? "text-amber-600" : "text-slate-400"}`}>
                      {inst.status === "paid" ? "Paid" : inst.status === "missed" ? "Missed" : overdue ? "Overdue" : "Upcoming"}
                    </div>
                  </div>
                  <div className="font-extrabold tabular-nums text-sm">{money(inst.amount)}</div>
                  {inst.status !== "paid" && a.status === "active" && (
                    <button disabled={busy} onClick={() => doInstallment(inst)} className="text-xs font-bold text-white bg-brandblue hover:bg-brandpurple px-3 py-2 rounded-lg transition">Confirm</button>
                  )}
                </div>
              );
            })}
          </div>
          {a.status === "active" && <div className="mt-3"><FileRow /><p className="text-[12px] text-slate-400 mt-1">Attach a receipt before confirming a payment (optional).</p></div>}
        </div>
      )}

      {/* adhoc */}
      {a.status === "active" && a.frequency === "Adhoc" && (
        <ActionBox title="Adhoc plan — log a payment" note={`Closes automatically when ${money(a.total)} is reached.`}>
          <div className="flex items-center gap-3 flex-wrap">
            <input value={adhocAmt} onChange={(e) => setAdhocAmt(e.target.value)} type="number" placeholder="Amount (JMD)"
              className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm w-40" />
            <FileRow />
            <PrimaryBtn busy={busy} onClick={doAdhoc}>Log payment</PrimaryBtn>
          </div>
        </ActionBox>
      )}

      {a.status === "completed" && (
        <div className="bg-blue-50 text-blue-700 rounded-xl p-4 text-sm font-semibold mt-2">Plan paid in full · membership activation email sent to admin.</div>
      )}

      {/* payment history */}
      {bundle.payments.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold text-[15px] mb-2">Payments</h3>
          <div className="space-y-1.5">
            {bundle.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-[13px] text-slate-600 border-b border-slate-100 py-2">
                <span className="capitalize">{p.kind} · {new Date(p.created_at).toLocaleDateString()}</span>
                <span className="flex items-center gap-3">
                  {p.receipt_url && <ReceiptLink path={p.receipt_url} />}
                  <b className="tabular-nums text-slate-900">{money(p.amount)}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Overlay>
  );
}

function ReceiptLink({ path }) {
  const [url, setUrl] = useState(null);
  const open = async () => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  return <button onClick={open} className="text-brandblue font-semibold">Receipt</button>;
}

const Overlay = ({ children, onClose }) => (
  <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
    <div className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  </div>
);
const MiniStat = ({ k, v, tone }) => (
  <div className="bg-slate-50 rounded-xl p-3">
    <div className="text-[11px] text-slate-500 font-medium">{k}</div>
    <div className={`text-[15px] font-extrabold tabular-nums mt-0.5 ${tone || "text-slate-900"}`}>{v}</div>
  </div>
);
const ActionBox = ({ title, note, children }) => (
  <div className="border border-slate-200 rounded-2xl p-4 mb-4">
    <div className="font-bold text-[15px] mb-1">{title}</div>
    <p className="text-[13px] text-slate-500 mb-3">{note}</p>
    {children}
  </div>
);
const PrimaryBtn = ({ busy, children, ...p }) => (
  <button {...p} disabled={busy} className="py-2.5 px-4 rounded-xl bg-brandblue hover:bg-brandpurple text-white font-bold text-sm transition disabled:opacity-60">{busy ? "Working…" : children}</button>
);
