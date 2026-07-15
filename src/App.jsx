import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { PLANS, PLAN_KEYS, PARTY_PASS, PARTY_PASS_CAP, availableDeadlines, HARD_DEADLINE, PAYMENT_METHODS, money, daysLeft, waLink, STATUS } from "./lib.js";
import * as api from "./api.js";

const COORD_COLORS = ["#2563EB", "#7C3AED", "#F5B400", "#1D4ED8", "#0EA5E9", "#DB2777"];
const colorFor = (i) => COORD_COLORS[i % COORD_COLORS.length];
const todayISO = () => new Date().toISOString().slice(0, 10);

const Center = ({ children }) => <div className="min-h-screen grid place-items-center px-4">{children}</div>;
const Spinner = () => <div className="w-8 h-8 border-2 border-slate-200 border-t-brandblue rounded-full animate-spin" />;
function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl grid place-items-center text-white font-extrabold" style={{ background: "linear-gradient(140deg,#2563EB,#7C3AED)" }}>CE</div>
      <div className="leading-tight">
        <div className="font-bold text-[15px]">Payment Plans</div>
        <div className="text-[11px] tracking-wider uppercase text-slate-400">Varsity SZN 6</div>
      </div>
    </div>
  );
}
const NavBtn = ({ on, children, ...p }) => (
  <button {...p} className={`text-[13px] font-semibold px-4 py-2 rounded-lg whitespace-nowrap ${on ? "bg-brandblue text-white" : "text-slate-500"}`}>{children}</button>
);
const Stat = ({ k, v, sub, tone }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
    <div className="text-xs text-slate-500 font-medium">{k}</div>
    <div className={`text-[22px] font-extrabold mt-1.5 tabular-nums ${tone}`}>{v} {sub && <span className="text-xs text-slate-400 font-semibold">{sub}</span>}</div>
  </div>
);
const Field = ({ label, children }) => (
  <label className="block mb-4"><span className="text-[13px] font-semibold text-slate-600">{label}</span>{children}</label>
);
const INP = "w-full border border-slate-200 rounded-xl px-4 py-3 mt-1.5 text-sm focus:outline-none focus:border-brandblue focus:ring-2 focus:ring-blue-100";
const FileRow = ({ file, setFile, required }) => (
  <label className="flex items-center gap-2 text-[13px] text-slate-500 cursor-pointer flex-wrap">
    <span className={`px-3 py-2 rounded-lg border font-semibold ${required && !file ? "border-amber-300 text-amber-700 bg-amber-50" : "border-slate-200"}`}>
      {file ? "Receipt attached" : required ? "Attach receipt (required)" : "Attach receipt (recommended)"}
    </span>
    {file && (
      <span className="text-[11px] text-slate-400">
        {(file.size / 1048576).toFixed(1)} MB{file.size > 400 * 1024 && file.type?.startsWith("image/") ? " · will be compressed" : ""}
      </span>
    )}
    <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} accept="image/*,application/pdf" />
  </label>
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
const PrimaryBtn = ({ busy, tone, children, ...p }) => (
  <button {...p} disabled={busy} className={`py-2.5 px-4 rounded-xl text-white font-bold text-sm transition disabled:opacity-60 ${tone === "purple" ? "bg-brandpurple hover:bg-brandblue" : "bg-brandblue hover:bg-brandpurple"}`}>{busy ? "Working…" : children}</button>
);
const Overlay = ({ children, onClose }) => (
  <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
    <div className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>{children}</div>
  </div>
);
function WaButton({ number }) {
  const link = waLink(number);
  if (!link) return <span className="text-xs text-slate-300 font-semibold">No WhatsApp</span>;
  return (
    <button onClick={(e) => { e.stopPropagation(); window.open(link, "_blank"); }}
      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-full hover:bg-emerald-100 transition">
      WhatsApp
    </button>
  );
}

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
        <input className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-3 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" autoCorrect="off" inputMode="email" />
        <input className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-4 text-sm" placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl bg-brandblue hover:bg-brandpurple text-white font-bold text-sm transition disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
      </div>
    </Center>
  );
}

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

function Dashboard({ profile }) {
  const isAdmin = profile.role === "super_admin";
  const [screen, setScreen] = useState("board");
  const [view, setView] = useState("cards");
  const [board, setBoard] = useState({ accounts: [], paidMap: {} });
  const [coordMap, setCoordMap] = useState({});
  const [coordFilter, setCoordFilter] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [toast, setToast] = useState("");
  const [passesLeft, setPassesLeft] = useState(null);

  async function loadBoard() {
    const accounts = await api.listAccounts();
    const ids = accounts.map((a) => a.id);
    const paidMap = {};
    if (ids.length) {
      const { data: pays } = await supabase.from("payments").select("account_id,amount").in("account_id", ids);
      (pays || []).forEach((p) => { paidMap[p.account_id] = (paidMap[p.account_id] || 0) + p.amount; });
    }
    setBoard({ accounts, paidMap });
    api.partyPassesLeft().then(setPassesLeft).catch(() => {});
  }
  async function loadCoords() {
    if (!isAdmin) return;
    const list = await api.listCoordinators();
    const map = {}; list.forEach((c, i) => { map[c.id] = { ...c, color: colorFor(i) }; });
    setCoordMap(map);
  }
  useEffect(() => { loadBoard(); loadCoords(); }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 4200); };

  const visible = useMemo(() => {
    let s = board.accounts;
    if (isAdmin && coordFilter) s = s.filter((a) => a.coordinator_id === coordFilter);
    if (filter !== "all") s = s.filter((a) => a.status === filter);
    if (q) { const t = q.toLowerCase(); s = s.filter((a) => (a.ce_id + " " + a.member_name).toLowerCase().includes(t)); }
    return s;
  }, [board, filter, q, coordFilter]);

  const stats = useMemo(() => {
    const set = isAdmin && coordFilter ? board.accounts.filter((a) => a.coordinator_id === coordFilter) : board.accounts;
    const collected = set.reduce((s, a) => s + (board.paidMap[a.id] || 0), 0);
    const outstanding = set.reduce((s, a) => s + (a.total - (board.paidMap[a.id] || 0)), 0);
    const active = set.filter((a) => a.status === "active").length;
    const invitational = set.filter((a) => a.status === "invitational").length;
    return { collected, outstanding, active, invitational };
  }, [board, coordFilter]);

  const FILTERS = [["all", "All"], ["active", "Active"], ["awaiting_signature", "Awaiting"], ["completed", "Complete"], ["special_case", "Special"], ["invitational", "Invitational"]];

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="mr-auto flex items-center gap-3 min-w-0">
            <Brand />
            <div className="pl-3 border-l border-slate-200 leading-tight min-w-0">
              <div className="text-[13px] font-bold truncate max-w-[180px]">{profile.full_name || "Unnamed"}</div>
              <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{profile.email}</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <NavBtn on={screen === "board"} onClick={() => setScreen("board")}>Accounts</NavBtn>
            {!isAdmin && <NavBtn on={screen === "new"} onClick={() => setScreen("new")}>+ New</NavBtn>}
            {isAdmin && <NavBtn on={screen === "coordinators"} onClick={() => setScreen("coordinators")}>Coordinators</NavBtn>}
            <NavBtn on={screen === "account"} onClick={() => setScreen("account")}>Account</NavBtn>
          </nav>
          <button onClick={() => supabase.auth.signOut()} className="text-[13px] font-semibold text-slate-500 px-2">Sign out</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        {screen === "account" && <MyAccount profile={profile} flash={flash} />}
        {screen === "coordinators" && <Coordinators onChange={loadCoords} flash={flash} />}
        {screen === "new" && (
          <NewApplication profile={profile} passesLeft={passesLeft} onDone={(name) => { setScreen("board"); loadBoard(); flash(`Application sent · terms & sign link emailed to ${name}`); }} />
        )}

        {screen === "board" && (
          <>
            <div className="pt-7 pb-1 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{isAdmin ? "All accounts" : "My accounts"}</h1>
                <p className="text-slate-500 text-sm mt-1.5">{isAdmin ? "Every account across all coordinators." : "Every member you've enrolled and where their plan stands."}</p>
              </div>
              <div className="inline-flex bg-slate-100 rounded-xl p-1">
                <NavBtn on={view === "cards"} onClick={() => setView("cards")}>Cards</NavBtn>
                <NavBtn on={view === "table"} onClick={() => setView("table")}>Table</NavBtn>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <Stat k="Collected" v={money(stats.collected)} sub="JMD" tone="text-brandblue" />
              <Stat k="Outstanding" v={money(stats.outstanding)} sub="JMD" tone="text-slate-900" />
              <Stat k="Active plans" v={stats.active} tone="text-brandpurple" />
              <Stat k="Party Passes left" v={passesLeft === null ? "…" : passesLeft} sub={`of ${PARTY_PASS_CAP}`} tone={passesLeft === 0 ? "text-rose-600" : "text-amber-600"} />
            </div>

            {isAdmin && (
              <div className="mt-6">
                <h2 className="text-base font-bold mb-3">Per-coordinator summary</h2>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
                  {Object.values(coordMap).map((c) => {
                    const set = board.accounts.filter((a) => a.coordinator_id === c.id);
                    const col = set.reduce((s, a) => s + (board.paidMap[a.id] || 0), 0);
                    const tgt = set.reduce((s, a) => s + a.total, 0);
                    const pct = tgt ? Math.round((col / tgt) * 100) : 0;
                    const on = coordFilter === c.id;
                    return (
                      <button key={c.id} onClick={() => setCoordFilter(on ? null : c.id)}
                        className={`text-left bg-white border rounded-2xl p-4 shadow-sm transition ${on ? "border-brandblue ring-2 ring-blue-100" : "border-slate-100"}`}>
                        <div className="flex items-center gap-2.5 font-bold text-[15px]">
                          <span className="w-7 h-7 rounded-lg grid place-items-center text-white text-[13px]" style={{ background: c.color }}>{(c.full_name || "?")[0]}</span>
                          {c.full_name || "Unnamed"}
                        </div>
                        <div className="flex justify-between text-[13px] text-slate-500 mt-2.5"><span>Accounts</span><b className="text-slate-900">{set.length}</b></div>
                        <div className="flex justify-between text-[13px] text-slate-500 mt-2"><span>Collected</span><b className="text-slate-900">{money(col)}</b></div>
                        <div className="h-1.5 rounded-full bg-slate-100 mt-3 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#2563EB,#7C3AED)" }} /></div>
                      </button>
                    );
                  })}
                </div>
                {coordFilter && <button onClick={() => setCoordFilter(null)} className="text-[13px] font-semibold text-brandblue mt-3">Clear coordinator filter</button>}
              </div>
            )}

            <div className="sticky top-[60px] z-10 pt-5 pb-3 mt-2" style={{ background: "linear-gradient(#F8FAFC 74%,transparent)" }}>
              <div className="relative mb-3">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by CE ID or name…" autoCapitalize="none" autoCorrect="off"
                  className="w-full bg-white border border-slate-200 rounded-2xl text-[15px] px-4 py-3.5 focus:outline-none focus:border-brandblue focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="flex gap-2.5 flex-wrap">
                {FILTERS.map(([k, l]) => {
                  const n = k === "all" ? visible.length : board.accounts.filter((a) => a.status === k).length;
                  const on = filter === k;
                  return (
                    <button key={k} onClick={() => setFilter(k)} className={`text-[13.5px] font-semibold px-4 py-2 rounded-full border transition ${on ? "bg-brandblue text-white border-brandblue" : "bg-white text-slate-500 border-slate-200 hover:border-brandblue hover:text-brandblue"}`}>
                      {l}<span className="text-xs ml-1.5 opacity-70">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {view === "cards" ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,320px),1fr))" }}>
                {visible.length ? visible.map((a) => (
                  <Card key={a.id} a={a} paid={board.paidMap[a.id] || 0} isAdmin={isAdmin} coord={coordMap[a.coordinator_id]} onOpen={() => setDetailId(a.id)} />
                )) : <Empty />}
              </div>
            ) : (
              <TableView rows={visible} paidMap={board.paidMap} isAdmin={isAdmin} coordMap={coordMap} onOpen={setDetailId} />
            )}
          </>
        )}
      </main>

      {detailId && <AccountDetail id={detailId} profile={profile} onClose={() => setDetailId(null)} onChange={loadBoard} flash={flash} />}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg z-50 text-center max-w-[90vw]">{toast}</div>}
    </div>
  );
}

const Empty = () => (
  <div className="col-span-full text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-500">
    <b className="block text-lg text-slate-900 mb-1.5">No accounts match</b>Try another CE ID or clear the filter.
  </div>
);

function TableView({ rows, paidMap, isAdmin, coordMap, onOpen }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[820px]">
        <thead>
          <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">University</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Paid at start</th>
            <th className="px-4 py-3">Deadline</th>
            <th className="px-4 py-3">Balance due</th>
            <th className="px-4 py-3">Status</th>
            {isAdmin && <th className="px-4 py-3">Coordinator</th>}
            <th className="px-4 py-3">Contact</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const paid = paidMap[a.id] || 0;
            const S = STATUS[a.status] || STATUS.active;
            const coord = coordMap[a.coordinator_id];
            return (
              <tr key={a.id} onClick={() => onOpen(a.id)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-3 font-semibold whitespace-nowrap">{a.member_name}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{a.university}</td>
                <td className="px-4 py-3 whitespace-nowrap">{a.plan}</td>
                <td className="px-4 py-3 tabular-nums whitespace-nowrap">{money(a.downpayment)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{a.deadline}</td>
                <td className="px-4 py-3 font-bold tabular-nums whitespace-nowrap">{money(a.total - paid)}</td>
                <td className="px-4 py-3 whitespace-nowrap"><span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${S.pill}`}><span className={`w-1.5 h-1.5 rounded-full ${S.dot}`} />{S.label}</span></td>
                {isAdmin && <td className="px-4 py-3 whitespace-nowrap text-slate-500">{coord?.full_name || "—"}</td>}
                <td className="px-4 py-3 whitespace-nowrap"><WaButton number={a.whatsapp} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Card({ a, paid, isAdmin, coord, onOpen }) {
  const S = STATUS[a.status] || STATUS.active;
  const remaining = a.total - paid;
  const cta = a.status === "awaiting_signature" ? "Mark as signed" : a.status === "active" ? "Log payment" : a.status === "completed" ? "View summary" : "View details";
  const ctaTone = a.status === "awaiting_signature" ? "bg-brandpurple hover:bg-brandblue"
    : a.status === "completed" ? "bg-emerald-600 hover:bg-emerald-700"
    : "bg-brandblue hover:bg-brandpurple";
  const dleft = daysLeft(a.deadline);
  return (
    <article onClick={onOpen} className={`rise bg-white border border-slate-100 border-l-4 ${S.edge} rounded-2xl p-5 shadow-sm hover:shadow-lg transition cursor-pointer`}>
      <div className="flex items-center justify-between gap-2.5 mb-3.5">
        <span className="text-xs font-bold text-slate-500">{a.plan} <span className="text-slate-400 font-medium">· {money(a.total)}</span></span>
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full ${S.pill}`}><span className={`w-1.5 h-1.5 rounded-full ${S.dot}`} />{S.label}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[21px] font-bold tracking-tight leading-tight">{a.member_name}</div>
        <WaButton number={a.whatsapp} />
      </div>
      <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
        <span className="text-xs font-bold text-brandpurple bg-violet-50 px-2.5 py-1 rounded-lg" style={{ fontFamily: "ui-monospace,monospace" }}>{a.ce_id}</span>
        <span className="text-[13px] text-slate-500">{a.university}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2.5 my-4">
        <span className="text-[26px] font-extrabold tabular-nums tracking-tight">{money(remaining)}</span>
        <span className="text-[12.5px] text-slate-500 text-right">remaining<br />of {money(a.total)} · paid <b className="text-brandblue">{money(paid)}</b></span>
      </div>
      <div className="flex items-center gap-2.5 text-[13.5px]">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Deadline</span>
        <b className="text-slate-900">{a.deadline}</b>
        {a.status === "active" && <span className="text-slate-400">· {dleft}d left</span>}
      </div>
      <button className={`w-full mt-4 py-3 rounded-xl text-white font-bold text-sm transition ${ctaTone}`}>{cta}</button>
      {isAdmin && coord && (
        <div className="flex items-center gap-2 mt-3.5 pt-3.5 border-t border-slate-100 text-[12.5px] text-slate-500">
          Managed by <span className="w-5 h-5 rounded-md grid place-items-center text-white text-[11px]" style={{ background: coord.color }}>{(coord.full_name || "?")[0]}</span>{coord.full_name}
        </div>
      )}
    </article>
  );
}

function NewApplication({ profile, passesLeft, onDone }) {
  const [f, setF] = useState({
    member_name: "", email: "", whatsapp: "", university: "UWI Mona", ce_id: "",
    plan: PARTY_PASS, deposit_amount: String(PLANS[PARTY_PASS].down),
    deposit_date: todayISO(), deposit_method: "NCB Bank", deadline: "",
  });
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [stage, setStage] = useState("");
  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  const setPlan = (e) => {
    const plan = e.target.value;
    setF((prev) => ({ ...prev, plan, deposit_amount: String(PLANS[plan].down) }));
  };
  const price = PLANS[f.plan];
  const deadlines = availableDeadlines();
  const openingNum = Number(f.deposit_amount) || 0;
  const afterOpening = price.total - openingNum;
  const paidInFull = openingNum >= price.total;

  const submit = async () => {
    setErr("");
    if (!f.member_name || !f.email || !f.ce_id) return setErr("Name, email and CE ID are required.");
    if (openingNum < price.down) return setErr(`The opening payment must be at least ${money(price.down)}.`);
    if (openingNum > price.total) return setErr(`That's more than the ${money(price.total)} plan total.`);
    if (!f.deadline) return setErr("Pick a deadline.");
    if (!receipt) return setErr("The deposit receipt is required to start a plan.");
    setBusy(true);
    try {
      await api.createApplication({ ...f, deposit_receipt: receipt }, profile.id, setStage);
      onDone(f.member_name);
    } catch (e) {
      setErr(e.message || String(e));
      setStage("");
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto pt-7">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">New application</h1>
      <p className="text-slate-500 text-sm mb-6">Capture the deposit receipt and pick a deadline. The member gets their terms + sign link by email.</p>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
        {err && <div className="bg-amber-50 text-amber-700 text-sm rounded-xl p-3 mb-4">{err}</div>}
        <Field label="Full name"><input className={INP} value={f.member_name} onChange={set("member_name")} /></Field>
        <Field label="Email"><input className={INP} value={f.email} onChange={set("email")} type="email" autoCapitalize="none" autoCorrect="off" inputMode="email" /></Field>
        <Field label="WhatsApp number"><input className={INP} value={f.whatsapp} onChange={set("whatsapp")} placeholder="876 555 0123" inputMode="tel" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="University"><select className={INP} value={f.university} onChange={set("university")}><option>UWI Mona</option><option>UTech</option><option>Other</option></select></Field>
          <Field label="CE ID"><input className={INP} value={f.ce_id} onChange={set("ce_id")} placeholder="CE-0000" autoCapitalize="characters" autoCorrect="off" /></Field>
        </div>
        <Field label="Plan">
          <select className={INP} value={f.plan} onChange={setPlan}>
            {PLAN_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        {f.plan === PARTY_PASS && (
          <div className={`rounded-xl p-3.5 text-[13px] mb-4 ${passesLeft === 0 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
            {passesLeft === 0
              ? "All 50 Party Passes are secured. A plan can still be opened, but the Pass cannot be secured — clause 8 fallback applies."
              : `${passesLeft ?? "—"} of ${PARTY_PASS_CAP} Party Passes remain. A deposit does not reserve one — it's secured only on full payment (T&C 7.1).`}
          </div>
        )}
        <div className="bg-slate-50 rounded-xl p-3.5 text-sm text-slate-600 mb-4 flex justify-between flex-wrap gap-1">
          <span>Total <b className="text-slate-900">{money(price.total)}</b></span>
          <span>Minimum deposit <b className="text-brandpurple">{money(price.down)}</b></span>
        </div>

        <Field label="Amount paid now">
          <input className={INP} value={f.deposit_amount} onChange={set("deposit_amount")} type="number" inputMode="numeric" placeholder={String(price.down)} />
        </Field>
        <p className={`text-[12px] -mt-3 mb-4 ${openingNum && openingNum < price.down ? "text-amber-600" : "text-slate-400"}`}>
          {openingNum < price.down
            ? `Must be at least the ${money(price.down)} deposit.`
            : paidInFull
              ? "Paid in full — the plan completes as soon as the contract is signed."
              : `Balance after this payment: ${money(afterOpening)}`}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment date"><input className={INP} type="date" max={todayISO()} value={f.deposit_date} onChange={set("deposit_date")} /></Field>
          <Field label="Payment method">
            <select className={INP} value={f.deposit_method} onChange={set("deposit_method")}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        <div className="mb-4"><FileRow file={receipt} setFile={setReceipt} required /></div>

        <Field label="Deadline">
          <select className={INP} value={f.deadline} onChange={set("deadline")}>
            <option value="">Select a deadline…</option>
            {deadlines.map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}
          </select>
        </Field>
        <p className="text-[12px] text-slate-400 -mt-3 mb-5">Hard ceiling: {HARD_DEADLINE}. Unpaid balances past this date roll over to Varsity Invitational.</p>

        <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl bg-brandblue hover:bg-brandpurple text-white font-bold text-sm transition disabled:opacity-60">{busy ? (stage || "Sending…") : "Create plan"}</button>
      </div>
    </div>
  );
}

function Coordinators({ onChange, flash }) {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const load = async () => setList(await api.listCoordinators());
  useEffect(() => { load(); }, []);
  const approve = async (id) => { await api.approveCoordinator(id); await load(); onChange && onChange(); };
  const saveName = async (id) => { await api.updateCoordinatorName(id, name); setEditing(null); await load(); onChange && onChange(); };
  const resetPw = async (email) => { try { await api.sendCoordinatorPasswordReset(email); flash(`Password reset email sent to ${email}`); } catch (e) { flash(e.message || String(e)); } };

  return (
    <div className="max-w-2xl mx-auto pt-7">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Coordinators</h1>
      <p className="text-slate-500 text-sm mb-6">Approve first logins, rename coordinators, or send a password reset.</p>
      <div className="space-y-3">
        {list.map((c, i) => (
          <div key={c.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg grid place-items-center text-white font-bold flex-none" style={{ background: colorFor(i) }}>{(c.full_name || c.email || "?")[0]}</span>
              <div className="mr-auto min-w-0">
                {editing === c.id ? (
                  <div className="flex items-center gap-2">
                    <input className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm w-40" value={name} onChange={(e) => setName(e.target.value)} />
                    <button onClick={() => saveName(c.id)} className="text-xs font-bold text-white bg-brandblue px-3 py-1.5 rounded-lg">Save</button>
                  </div>
                ) : (
                  <div className="font-bold text-[15px] truncate">{c.full_name || "Unnamed coordinator"}</div>
                )}
                <div className="text-[13px] text-slate-500 truncate">{c.email} · {c.approved ? "Approved" : "Awaiting approval"}</div>
              </div>
              {c.approved
                ? <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full flex-none">Active</span>
                : <button onClick={() => approve(c.id)} className="text-sm font-bold text-white bg-brandblue hover:bg-brandpurple px-4 py-2 rounded-xl transition flex-none">Approve</button>}
            </div>
            {c.approved && editing !== c.id && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <button onClick={() => { setEditing(c.id); setName(c.full_name || ""); }} className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">Edit name</button>
                <button onClick={() => resetPw(c.email)} className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">Send password reset</button>
              </div>
            )}
          </div>
        ))}
        {!list.length && <p className="text-slate-500 text-sm">No coordinators yet.</p>}
      </div>
    </div>
  );
}

function MyAccount({ profile, flash }) {
  const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pw.length < 6) return flash("Password must be at least 6 characters.");
    setBusy(true);
    try { await api.changeOwnPassword(pw); setPw(""); flash("Password updated."); }
    catch (e) { flash(e.message || String(e)); }
    setBusy(false);
  };
  return (
    <div className="max-w-md mx-auto pt-7">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Account</h1>
      <p className="text-slate-500 text-sm mb-6">{profile.full_name || profile.email} · {profile.role === "super_admin" ? "Super admin" : "Coordinator"}</p>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
        <Field label="New password"><input className={INP} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" /></Field>
        <PrimaryBtn busy={busy} onClick={save}>Update password</PrimaryBtn>
      </div>
    </div>
  );
}

function AccountDetail({ id, profile, onClose, onChange, flash }) {
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [amt, setAmt] = useState(""); const [method, setMethod] = useState("NCB Bank"); const [paidOn, setPaidOn] = useState(todayISO());

  const load = async () => setBundle(await api.getAccountBundle(id));
  useEffect(() => { load(); }, [id]);

  if (!bundle || !bundle.account) return <Overlay onClose={onClose}><div className="grid place-items-center py-16"><Spinner /></div></Overlay>;
  const a = bundle.account;
  const paid = bundle.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = a.total - paid;
  const S = STATUS[a.status] || STATUS.active;

  const wrap = async (fn, msg) => { setBusy(true); try { await fn(); await load(); onChange(); msg && flash(msg); } catch (e) { flash(e.message || String(e)); } setBusy(false); };

  const doSign = () => wrap(() => api.markSigned(a), "Marked as signed · plan is now active");
  const doPayment = () => wrap(async () => {
    await api.logPayment(a, { amount: amt, method, paid_on: paidOn, file }, profile.id);
    setAmt(""); setFile(null); setPaidOn(todayISO());
  }, "Payment logged");

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-[22px] font-extrabold tracking-tight">{a.member_name}</div>
          <div className="text-[13px] text-slate-500 mt-1">{a.ce_id} · {a.university} · {a.plan}</div>
          <div className="mt-2 flex items-center gap-2"><WaButton number={a.whatsapp} /><span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${S.pill}`}><span className={`w-1.5 h-1.5 rounded-full ${S.dot}`} />{S.label}</span></div>
        </div>
        <button onClick={onClose} className="text-slate-400 text-2xl leading-none flex-none">×</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <MiniStat k="Total" v={money(a.total)} />
        <MiniStat k="Paid" v={money(paid)} tone="text-brandblue" />
        <MiniStat k="Remaining" v={money(remaining)} tone="text-brandpurple" />
      </div>
      <div className="text-[13px] text-slate-500 mb-5">Deadline: <b className="text-slate-900">{a.deadline}</b>{a.status === "active" && ` · ${daysLeft(a.deadline)} days left`}</div>

      {a.status === "awaiting_signature" && (
        <ActionBox title="Deposit received — waiting on signature" note="The terms & sign link were emailed to the member. Once JotForm notifies you they've signed, mark it here to activate the plan.">
          <PrimaryBtn busy={busy} tone="purple" onClick={doSign}>Mark as signed</PrimaryBtn>
        </ActionBox>
      )}

      {a.status === "active" && (
        <ActionBox title="Log a payment" note={`Enter the payment details from the receipt the member sent. Maximum ${money(remaining)}.`}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={amt} onChange={(e) => setAmt(e.target.value)} type="number" inputMode="numeric" placeholder="Amount (JMD)" className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm">
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <input value={paidOn} onChange={(e) => setPaidOn(e.target.value)} type="date" max={todayISO()} className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm mb-3 w-full sm:w-auto" />
          <div className="flex items-center gap-3 flex-wrap"><FileRow file={file} setFile={setFile} /><PrimaryBtn busy={busy} onClick={doPayment}>Confirm payment</PrimaryBtn></div>
        </ActionBox>
      )}

      {a.status === "completed" && (
        <div className="bg-emerald-50 text-emerald-800 rounded-xl p-4 text-sm font-semibold mt-2 mb-4">
          Plan paid in full · activation email sent to admin and the code emailed to the member.
          <div className="mt-2 bg-white rounded-lg px-3 py-2 text-slate-900 font-mono text-base tracking-wider inline-block">{a.coupon_code}</div>
        </div>
      )}

      {a.status === "special_case" && (
        <div className="bg-rose-50 text-rose-700 rounded-xl p-4 text-sm font-semibold mt-2 mb-4">
          Flagged for manual review.
          <p className="text-[13px] font-normal mt-1">{a.special_case_reason || "No reason recorded."}</p>
        </div>
      )}

      {a.status === "invitational" && (
        <div className="bg-amber-50 text-amber-700 rounded-xl p-4 text-sm font-semibold mt-2 mb-4">
          Deadline passed with a remaining balance · student rolled over to Varsity Invitational.
        </div>
      )}

      {bundle.payments.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold text-[15px] mb-2">Payments</h3>
          <div className="space-y-1.5">
            {bundle.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-[13px] text-slate-600 border-b border-slate-100 py-2">
                <span className="capitalize">{p.kind} · {p.method} · {p.paid_on}</span>
                <span className="flex items-center gap-3">{p.receipt_url && <ReceiptLink path={p.receipt_url} />}<b className="tabular-nums text-slate-900">{money(p.amount)}</b></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Overlay>
  );
}

function ReceiptLink({ path }) {
  const open = async () => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  return <button onClick={open} className="text-brandblue font-semibold">Receipt</button>;
}
