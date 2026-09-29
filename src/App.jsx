import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Users, Smartphone, Wallet, LayoutDashboard, LogOut, Mail, Lock,
  Plus, X, Pencil, Trash2, Lock as LockIcon, Unlock, Bell, Phone,
  History, KeyRound, RefreshCw, LayoutGrid, PhoneCall, Mic, PhoneOff, UserCog, ShieldCheck,
  ChevronDown, Settings, HelpCircle, Sliders, Send,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const money = (n) => `Rs ${Number(n || 0).toLocaleString()}`;

function initials(name) {
  return (name || "").split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
}

function formatEventTime(iso) {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

function formatRelativeTime(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!authChecked) return <div style={{ minHeight: "100vh", background: "#F5F6F8" }} />;
  if (!session) return <LoginScreen />;

  return (
    <div style={S.appShell}>
      <GlobalStyle />
      <TopBar email={session.user.email} />
      <div style={S.appBody}>
        <Sidebar tab={tab} setTab={setTab} />
        <main style={S.main}>
          {tab === "dashboard" && <Dashboard />}
          {tab === "customers" && <Customers />}
          {tab === "devices" && <Devices />}
          {tab === "sendMessage" && <SendMessagePage />}
          {tab === "payments" && <Payments />}
          {tab === "numbers" && <WhitelistedNumbers />}
          {tab === "roles" && <RolesList />}
          {tab === "accounts" && <AccountManagement />}
        </main>
      </div>
    </div>
  );
}

function TopBar({ email }) {
  return (
    <header style={S.topbar}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={S.logoMark}>N</div>
        <span className="serif" style={{ fontSize: 17, color: "#14161C" }}>Northline Portal</span>
        <span style={{ fontSize: 13, color: "#9AA1AE", marginLeft: 4 }}>Hi, welcome back</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6B7280", fontSize: 13 }}>
          <HelpCircle size={15} />
          Help
        </div>
        <div style={{ width: 1, height: 20, background: "#E6E8EC" }} />
        <span style={{ fontSize: 13, color: "#6B7280" }}>{email}</span>
        <button style={S.logoutBtn} onClick={() => supabase.auth.signOut()}>
          <LogOut size={14} /> Log out
        </button>
      </div>
    </header>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
      * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
      html, body { margin: 0; padding: 0; background: #F5F6F8; color-scheme: light; }
      #root { min-height: 100vh; }
      .serif { font-family: 'Fraunces', serif; }
      .mono { font-family: 'JetBrains Mono', monospace; }
      input, select { outline: none; }
      input:focus, select:focus { box-shadow: 0 0 0 2px #F2A93C55; border-color: #F2A93C !important; }
      button { cursor: pointer; }
      ::placeholder { color: #9AA1AE; }
    `}</style>
  );
}

/* ---------------- AUTH ---------------- */

function LoginScreen() {
  const [mode, setMode] = useState("signIn");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (!emailOk) return setError("Enter a valid email.");
    if (!form.password || form.password.length < 6) return setError("Password must be at least 6 characters.");
    setError("");
    setBusy(true);
    const fn = mode === "signIn" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error: err } = await fn.call(supabase.auth, { email: form.email.trim(), password: form.password });
    if (err) setError(err.message);
    else if (mode === "signUp") setError("Check your inbox to confirm your email, then sign in.");
    setBusy(false);
  }

  return (
    <div style={S.loginPage}>
      <GlobalStyle />
      <div style={S.loginCard}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={S.logoMark}>N</div>
          <span className="serif" style={{ fontSize: 18, color: "#14161C" }}>Northline</span>
        </div>
        <h1 className="serif" style={{ fontSize: 24, color: "#14161C", margin: "0 0 6px" }}>
          {mode === "signIn" ? "Sign in" : "Create account"}
        </h1>
        <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 24px" }}>Installment device admin panel.</p>

        <Field label="Email">
          <div style={S.iconInputWrap}>
            <Mail size={15} color="#9AA1AE" />
            <input style={S.iconInput} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        </Field>
        <Field label="Password">
          <div style={S.iconInputWrap}>
            <Lock size={15} color="#9AA1AE" />
            <input type="password" style={S.iconInput} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        </Field>
        {error && <p style={{ fontSize: 12.5, color: "#D6414C", margin: "0 0 12px" }}>{error}</p>}

        <button style={{ ...S.primaryBtn, width: "100%", justifyContent: "center", marginTop: 6, opacity: busy ? 0.7 : 1 }} onClick={submit} disabled={busy}>
          {busy ? "Please wait…" : mode === "signIn" ? "Sign in" : "Sign up"}
        </button>
        <button style={{ ...S.secondaryBtn, width: "100%", justifyContent: "center", marginTop: 10 }} onClick={() => { setMode(mode === "signIn" ? "signUp" : "signIn"); setError(""); }}>
          {mode === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- SIDEBAR ---------------- */

function Sidebar({ tab, setTab }) {
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      group: "Customer Management", icon: Users, items: [
        { id: "customers", label: "Customers", icon: Users },
      ],
    },
    {
      group: "Device Management", icon: Smartphone, items: [
        { id: "devices", label: "Devices", icon: Smartphone },
        { id: "numbers", label: "Whitelisted Numbers", icon: Phone },
      ],
    },
    {
      group: "Custom Management", icon: Sliders, items: [
        { id: "sendMessage", label: "Send Message", icon: Send },
      ],
    },
    { id: "payments", label: "Payments", icon: Wallet },
    {
      group: "Settings Management", icon: Settings, items: [
        { id: "roles", label: "Role List", icon: ShieldCheck },
        { id: "accounts", label: "Account Management", icon: UserCog },
      ],
    },
  ];

  const activeGroup = nav.find((it) => it.items?.some((sub) => sub.id === tab))?.group;
  const [openGroup, setOpenGroup] = useState(activeGroup || "Device Management");

  return (
    <aside style={S.sidebar}>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {nav.map((it) => {
          if (it.items) {
            const isOpen = openGroup === it.group;
            const GroupIcon = it.icon;
            return (
              <div key={it.group}>
                <div style={S.navGroupHeader} onClick={() => setOpenGroup(isOpen ? null : it.group)}>
                  <GroupIcon size={15} />
                  <span style={{ flex: 1 }}>{it.group}</span>
                  <ChevronDown size={14} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </div>
                {isOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 4 }}>
                    {it.items.map((sub) => {
                      const SubIcon = sub.icon;
                      const active = tab === sub.id;
                      return (
                        <div key={sub.id} style={active ? S.navSubItemActive : S.navSubItem} onClick={() => setTab(sub.id)}>
                          <SubIcon size={14} />
                          <span>{sub.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <div key={it.id} style={active ? S.navItemActive : S.navItem} onClick={() => setTab(it.id)}>
              <Icon size={16} />
              <span>{it.label}</span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/* ---------------- DASHBOARD ---------------- */

function Dashboard() {
  const [stats, setStats] = useState({ customers: 0, devices: 0, locked: 0, overdue: 0 });
  const [overdueList, setOverdueList] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); loadChartData(); }, []);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const [{ count: customerCount }, { count: deviceCount }, { count: lockedCount }] = await Promise.all([
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("devices").select("*", { count: "exact", head: true }),
      supabase.from("devices").select("*", { count: "exact", head: true }).eq("is_locked", true),
    ]);

    const { data: overdue } = await supabase
      .from("payments")
      .select("id, due_date, amount, status, installment_plans(device_id, devices(device_model, customers(name)))")
      .neq("status", "Paid")
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(10);

    setStats({
      customers: customerCount || 0,
      devices: deviceCount || 0,
      locked: lockedCount || 0,
      overdue: (overdue || []).length,
    });
    setOverdueList(overdue || []);
    setLoading(false);
  }

  async function loadChartData() {
    const days = 30;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const startISO = start.toISOString().slice(0, 10);

    const [{ data: devs }, { data: events }] = await Promise.all([
      supabase.from("devices").select("provisioned_at").gte("provisioned_at", startISO),
      supabase.from("device_events").select("event_type, occurred_at").gte("occurred_at", startISO),
    ]);

    const buckets = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      buckets[d.toISOString().slice(0, 10)] = { enrolled: 0, locked: 0, unlocked: 0 };
    }
    (devs || []).forEach((d) => {
      const key = (d.provisioned_at || "").slice(0, 10);
      if (buckets[key]) buckets[key].enrolled++;
    });
    (events || []).forEach((e) => {
      const key = (e.occurred_at || "").slice(0, 10);
      if (!buckets[key]) return;
      if (e.event_type === "LOCK") buckets[key].locked++;
      else if (e.event_type === "UNLOCK") buckets[key].unlocked++;
    });
    setChartData(Object.keys(buckets).sort().map((key) => ({ date: key, ...buckets[key] })));
  }

  return (
    <div>
      <PageHeader eyebrow="Overview" title="Dashboard" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Total customers" value={stats.customers} />
        <StatCard label="Total devices" value={stats.devices} />
        <StatCard label="Locked now" value={stats.locked} accent="#D6414C" />
        <StatCard label="Overdue payments" value={stats.overdue} accent="#F2A93C" />
      </div>

      <h3 className="serif" style={{ fontSize: 16, color: "#14161C", margin: "0 0 12px" }}>Activity — last 30 days</h3>
      <GrowthChart data={chartData} />

      <h3 className="serif" style={{ fontSize: 16, color: "#14161C", margin: "28px 0 12px" }}>Overdue this period</h3>
      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Customer", "Device", "Due date", "Amount"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={4} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && overdueList.length === 0 && <tr><td colSpan={4} style={S.emptyCell}>Nothing overdue right now.</td></tr>}
            {overdueList.map((p) => (
              <tr key={p.id} style={S.tr}>
                <td style={S.td}>{p.installment_plans?.devices?.customers?.name || "—"}</td>
                <td style={S.td}>{p.installment_plans?.devices?.device_model || "—"}</td>
                <td style={S.td} className="mono">{p.due_date}</td>
                <td style={S.td}>{money(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- CUSTOMERS ---------------- */

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState(emptyCustomer());
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selected, setSelected] = useState(null);

  function emptyCustomer() { return { id: null, name: "", phone_number: "", cnic: "", address: "" }; }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("customers").select("*, devices(id)").order("created_at", { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  }

  function openAdd() { setDraft(emptyCustomer()); setErrors({}); setDrawerOpen(true); }
  function openEdit(c) { setDraft({ ...c }); setErrors({}); setDrawerOpen(true); }

  async function save() {
    const e = {};
    if (!draft.name.trim()) e.name = "Enter a name.";
    if (!draft.phone_number.trim()) e.phone_number = "Enter a phone number.";
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = { name: draft.name.trim(), phone_number: draft.phone_number.trim(), cnic: draft.cnic || null, address: draft.address || null };
    if (draft.id == null) await supabase.from("customers").insert(payload);
    else await supabase.from("customers").update(payload).eq("id", draft.id);
    setDrawerOpen(false);
    load();
  }

  async function performDelete(id) {
    await supabase.from("customers").delete().eq("id", id);
    setConfirmDelete(null);
    load();
  }

  if (selected) return <CustomerDetail customer={selected} onBack={() => { setSelected(null); load(); }} />;

  return (
    <div>
      <PageHeader eyebrow="Directory" title="Customers" count={customers.length}>
        <button style={S.primaryBtn} onClick={openAdd}><Plus size={16} /> Add customer</button>
      </PageHeader>

      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Customer", "Phone", "Devices", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={4} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && customers.length === 0 && <tr><td colSpan={4} style={S.emptyCell}>No customers yet.</td></tr>}
            {customers.map((c) => (
              <tr key={c.id} style={S.tr}>
                <td style={{ ...S.td, cursor: "pointer" }} onClick={() => setSelected(c)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={S.avatar}>{initials(c.name)}</div>
                    <span style={{ fontSize: 13.5, color: "#14161C", fontWeight: 500 }}>{c.name}</span>
                  </div>
                </td>
                <td style={S.td} className="mono">{c.phone_number}</td>
                <td style={S.td}>{c.devices?.length || 0}</td>
                <td style={{ ...S.td, textAlign: "right" }}>
                  <button style={S.iconBtn} onClick={() => openEdit(c)} aria-label="Edit"><Pencil size={15} /></button>
                  <button style={{ ...S.iconBtn, marginLeft: 4 }} onClick={() => setConfirmDelete(c)} aria-label="Delete"><Trash2 size={15} color="#D6414C" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <Drawer title={draft.id == null ? "Add customer" : "Edit customer"} onClose={() => setDrawerOpen(false)}>
          <Field label="Full name" error={errors.name}><input style={S.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Jordan Lee" /></Field>
          <Field label="Phone number" error={errors.phone_number}><input style={S.input} value={draft.phone_number} onChange={(e) => setDraft({ ...draft, phone_number: e.target.value })} placeholder="0300-1234567" /></Field>
          <Field label="CNIC (optional)"><input style={S.input} value={draft.cnic} onChange={(e) => setDraft({ ...draft, cnic: e.target.value })} placeholder="42101-1234567-1" /></Field>
          <Field label="Address (optional)"><input style={S.input} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="Street, city" /></Field>
          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <button style={S.primaryBtn} onClick={save}>{draft.id == null ? "Add customer" : "Save changes"}</button>
            <button style={S.secondaryBtn} onClick={() => setDrawerOpen(false)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove customer"
          message={`${confirmDelete.name} and their devices/payment history will be removed. This can't be undone.`}
          onConfirm={() => performDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function CustomerDetail({ customer, onBack }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deviceDrawer, setDeviceDrawer] = useState(false);
  const [deviceEditDraft, setDeviceEditDraft] = useState(null);
  const [confirmDeleteDevice, setConfirmDeleteDevice] = useState(null);
  const [planDrawerFor, setPlanDrawerFor] = useState(null);
  const [planEditDraft, setPlanEditDraft] = useState(null);
  const [confirmDeletePlan, setConfirmDeletePlan] = useState(null);
  const [deviceDraft, setDeviceDraft] = useState({ device_model: "", imei: "" });
  const [planDraft, setPlanDraft] = useState({ total_amount: "", monthly_amount: "", number_of_months: "", start_date: "", due_day: 30 });
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("devices")
      .select("*, installment_plans(*)")
      .eq("customer_id", customer.id)
      .order("provisioned_at", { ascending: false });
    setDevices(data || []);
    setLoading(false);
  }

  async function addDevice() {
    if (!deviceDraft.device_model.trim()) { setError("Enter a device model."); return; }
    setError("");
    const unlock_pin = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from("devices").insert({
      customer_id: customer.id,
      device_model: deviceDraft.device_model.trim(),
      imei: deviceDraft.imei.trim() || null,
      unlock_pin,
      unlock_pin_generated_at: new Date().toISOString(),
    });
    setDeviceDraft({ device_model: "", imei: "" });
    setDeviceDrawer(false);
    load();
  }

  async function addPlan(deviceId) {
    const total = Number(planDraft.total_amount);
    const monthly = Number(planDraft.monthly_amount);
    const months = Number(planDraft.number_of_months);
    if (!total || !monthly || !months || !planDraft.start_date) { setError("Fill in all plan fields."); return; }
    setError("");

    const { data: plan, error: planErr } = await supabase
      .from("installment_plans")
      .insert({
        device_id: deviceId,
        total_amount: total,
        monthly_amount: monthly,
        number_of_months: months,
        start_date: planDraft.start_date,
        due_day: Number(planDraft.due_day) || 30,
      })
      .select()
      .single();

    if (planErr) { setError(planErr.message); return; }

    const rows = [];
    const start = new Date(planDraft.start_date);
    for (let i = 0; i < months; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      rows.push({ plan_id: plan.id, due_date: d.toISOString().slice(0, 10), amount: monthly, status: "Pending" });
    }
    await supabase.from("payments").insert(rows);

    setPlanDraft({ total_amount: "", monthly_amount: "", number_of_months: "", start_date: "", due_day: 30 });
    setPlanDrawerFor(null);
    load();
  }

  function openEditDevice(d) { setDeviceEditDraft({ id: d.id, device_model: d.device_model, imei: d.imei || "" }); setError(""); }

  async function saveEditDevice() {
    if (!deviceEditDraft.device_model.trim()) { setError("Enter a device model."); return; }
    await supabase.from("devices").update({
      device_model: deviceEditDraft.device_model.trim(),
      imei: deviceEditDraft.imei.trim() || null,
    }).eq("id", deviceEditDraft.id);
    setDeviceEditDraft(null);
    load();
  }

  async function performDeleteDevice(id) {
    await supabase.from("devices").delete().eq("id", id);
    setConfirmDeleteDevice(null);
    load();
  }

  function openEditPlan(p) {
    setPlanEditDraft({
      id: p.id,
      total_amount: p.total_amount,
      monthly_amount: p.monthly_amount,
      number_of_months: p.number_of_months,
      start_date: p.start_date,
      due_day: p.due_day,
      status: p.status,
    });
    setError("");
  }

  async function saveEditPlan() {
    const total = Number(planEditDraft.total_amount);
    const monthly = Number(planEditDraft.monthly_amount);
    const months = Number(planEditDraft.number_of_months);
    if (!total || !monthly || !months || !planEditDraft.start_date) { setError("Fill in all plan fields."); return; }
    await supabase.from("installment_plans").update({
      total_amount: total,
      monthly_amount: monthly,
      number_of_months: months,
      start_date: planEditDraft.start_date,
      due_day: Number(planEditDraft.due_day) || 30,
      status: planEditDraft.status,
    }).eq("id", planEditDraft.id);
    setPlanEditDraft(null);
    load();
  }

  async function performDeletePlan(id) {
    await supabase.from("installment_plans").delete().eq("id", id);
    setConfirmDeletePlan(null);
    load();
  }

  return (
    <div>
      <button style={{ ...S.secondaryBtn, marginBottom: 20 }} onClick={onBack}>&larr; Back to customers</button>
      <PageHeader eyebrow="Customer" title={customer.name}>
        <button style={S.primaryBtn} onClick={() => setDeviceDrawer(true)}><Plus size={16} /> Add device</button>
      </PageHeader>
      <p style={{ fontSize: 13.5, color: "#6B7280", margin: "-16px 0 24px" }} className="mono">{customer.phone_number}</p>

      {loading && <p style={{ color: "#9AA1AE", fontSize: 13 }}>Loading…</p>}
      {!loading && devices.length === 0 && <p style={{ color: "#9AA1AE", fontSize: 13 }}>No devices yet.</p>}

      {devices.map((d) => (
        <div key={d.id} style={{ ...S.statCard, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 14.5, color: "#14161C", fontWeight: 500, margin: 0 }}>{d.device_model}</p>
              <p className="mono" style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0" }}>{d.imei || "no IMEI set"}</p>
              {d.sim_missing && d.sim_status_updated_at && (
                <p style={{ fontSize: 11.5, color: "#AD6A0C", margin: "4px 0 0" }}>SIM missing since {formatRelativeTime(d.sim_status_updated_at)}</p>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...S.badge, background: d.is_locked ? "#FCEBEC" : "#E5F8F2", color: d.is_locked ? "#D6414C" : "#0E9488" }}>
                {d.is_locked ? "Locked" : "Active"}
              </span>
              {d.sim_missing && (
                <span style={{ ...S.badge, background: "#FBF0DC", color: "#AD6A0C" }}>No SIM</span>
              )}
              <button style={S.iconBtn} onClick={() => openEditDevice(d)} aria-label="Edit device"><Pencil size={15} /></button>
              <button style={S.iconBtn} onClick={() => setConfirmDeleteDevice(d)} aria-label="Delete device"><Trash2 size={15} color="#D6414C" /></button>
            </div>
          </div>
          {d.installment_plans?.length > 0 ? (
            d.installment_plans.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, margin: "4px 0" }}>
                <p style={{ fontSize: 12.5, color: "#6B7280", margin: 0 }}>
                  Plan: {money(p.total_amount)} total, {money(p.monthly_amount)}/mo for {p.number_of_months} months, due day {p.due_day} — <span style={{ color: "#374151" }}>{p.status}</span>
                </p>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button style={S.iconBtn} onClick={() => openEditPlan(p)} aria-label="Edit plan"><Pencil size={13} /></button>
                  <button style={S.iconBtn} onClick={() => setConfirmDeletePlan(p)} aria-label="Delete plan"><Trash2 size={13} color="#D6414C" /></button>
                </div>
              </div>
            ))
          ) : (
            <button style={{ ...S.secondaryBtn, marginTop: 6, fontSize: 12.5, padding: "6px 12px" }} onClick={() => setPlanDrawerFor(d.id)}>
              + Add installment plan
            </button>
          )}
        </div>
      ))}

      {deviceDrawer && (
        <Drawer title="Add device" onClose={() => setDeviceDrawer(false)}>
          <Field label="Device model"><input style={S.input} value={deviceDraft.device_model} onChange={(e) => setDeviceDraft({ ...deviceDraft, device_model: e.target.value })} placeholder="Samsung Galaxy A15" /></Field>
          <Field label="IMEI (optional)"><input style={S.input} value={deviceDraft.imei} onChange={(e) => setDeviceDraft({ ...deviceDraft, imei: e.target.value })} placeholder="356789104561234" /></Field>
          {error && <p style={{ fontSize: 12, color: "#D6414C" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={S.primaryBtn} onClick={addDevice}>Add device</button>
            <button style={S.secondaryBtn} onClick={() => setDeviceDrawer(false)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {planDrawerFor && (
        <Drawer title="Add installment plan" onClose={() => setPlanDrawerFor(null)}>
          <Field label="Total amount"><input style={S.input} type="number" value={planDraft.total_amount} onChange={(e) => setPlanDraft({ ...planDraft, total_amount: e.target.value })} placeholder="60000" /></Field>
          <Field label="Monthly amount"><input style={S.input} type="number" value={planDraft.monthly_amount} onChange={(e) => setPlanDraft({ ...planDraft, monthly_amount: e.target.value })} placeholder="5000" /></Field>
          <Field label="Number of months"><input style={S.input} type="number" value={planDraft.number_of_months} onChange={(e) => setPlanDraft({ ...planDraft, number_of_months: e.target.value })} placeholder="12" /></Field>
          <Field label="Start date"><input style={S.input} type="date" value={planDraft.start_date} onChange={(e) => setPlanDraft({ ...planDraft, start_date: e.target.value })} /></Field>
          <Field label="Due day of month"><input style={S.input} type="number" min="1" max="31" value={planDraft.due_day} onChange={(e) => setPlanDraft({ ...planDraft, due_day: e.target.value })} /></Field>
          {error && <p style={{ fontSize: 12, color: "#D6414C" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={S.primaryBtn} onClick={() => addPlan(planDrawerFor)}>Create plan</button>
            <button style={S.secondaryBtn} onClick={() => setPlanDrawerFor(null)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {deviceEditDraft && (
        <Drawer title="Edit device" onClose={() => setDeviceEditDraft(null)}>
          <Field label="Device model" error={error}><input style={S.input} value={deviceEditDraft.device_model} onChange={(e) => setDeviceEditDraft({ ...deviceEditDraft, device_model: e.target.value })} /></Field>
          <Field label="IMEI (optional)"><input style={S.input} value={deviceEditDraft.imei} onChange={(e) => setDeviceEditDraft({ ...deviceEditDraft, imei: e.target.value })} /></Field>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={S.primaryBtn} onClick={saveEditDevice}>Save changes</button>
            <button style={S.secondaryBtn} onClick={() => setDeviceEditDraft(null)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {confirmDeleteDevice && (
        <ConfirmDialog
          title="Remove device"
          message={`${confirmDeleteDevice.device_model} and its installment plans/payment history will be removed. This can't be undone.`}
          onConfirm={() => performDeleteDevice(confirmDeleteDevice.id)}
          onCancel={() => setConfirmDeleteDevice(null)}
        />
      )}

      {planEditDraft && (
        <Drawer title="Edit installment plan" onClose={() => setPlanEditDraft(null)}>
          <Field label="Total amount"><input style={S.input} type="number" value={planEditDraft.total_amount} onChange={(e) => setPlanEditDraft({ ...planEditDraft, total_amount: e.target.value })} /></Field>
          <Field label="Monthly amount"><input style={S.input} type="number" value={planEditDraft.monthly_amount} onChange={(e) => setPlanEditDraft({ ...planEditDraft, monthly_amount: e.target.value })} /></Field>
          <Field label="Number of months"><input style={S.input} type="number" value={planEditDraft.number_of_months} onChange={(e) => setPlanEditDraft({ ...planEditDraft, number_of_months: e.target.value })} /></Field>
          <Field label="Start date"><input style={S.input} type="date" value={planEditDraft.start_date} onChange={(e) => setPlanEditDraft({ ...planEditDraft, start_date: e.target.value })} /></Field>
          <Field label="Due day of month"><input style={S.input} type="number" min="1" max="31" value={planEditDraft.due_day} onChange={(e) => setPlanEditDraft({ ...planEditDraft, due_day: e.target.value })} /></Field>
          <Field label="Status">
            <select style={{ ...S.select, width: "100%" }} value={planEditDraft.status} onChange={(e) => setPlanEditDraft({ ...planEditDraft, status: e.target.value })}>
              {["Active", "Completed", "Defaulted"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {error && <p style={{ fontSize: 12, color: "#D6414C" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={S.primaryBtn} onClick={saveEditPlan}>Save changes</button>
            <button style={S.secondaryBtn} onClick={() => setPlanEditDraft(null)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {confirmDeletePlan && (
        <ConfirmDialog
          title="Remove installment plan"
          message="This plan and its scheduled payments will be removed. This can't be undone."
          onConfirm={() => performDeletePlan(confirmDeletePlan.id)}
          onCancel={() => setConfirmDeletePlan(null)}
        />
      )}
    </div>
  );
}

/* ---------------- DEVICES ---------------- */

function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDraft, setEditDraft] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notifyDraft, setNotifyDraft] = useState(null);
  const [sending, setSending] = useState(false);
  const [historyDraft, setHistoryDraft] = useState(null);
  const [codeDialog, setCodeDialog] = useState(null);
  const [appsDraft, setAppsDraft] = useState(null);
  const [callDraft, setCallDraft] = useState(null);
  const [audioCall, setAudioCall] = useState(null); // { device, status: 'connecting' | 'ringing' | 'connected' | 'failed', errorMsg }
  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("device_events_feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "device_events" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    return () => {
      if (pcRef.current) pcRef.current.close();
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("devices")
      .select("*, customers(name), device_commands(command, issued_at, acknowledged_at)")
      .order("provisioned_at", { ascending: false });
    setDevices(data || []);
    setLoading(false);
  }

  async function sendCommand(device, command) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("device_commands").insert({ device_id: device.id, command, issued_by: user?.email || "admin" });
    await supabase.from("devices").update({ is_locked: command === "LOCK" }).eq("id", device.id);

    await supabase.from("device_events").insert({
      device_id: device.id,
      event_type: command === "LOCK" ? "LOCK" : "UNLOCK",
      method: "ADMIN",
    });

    supabase.functions.invoke("notify-devices", { body: { device_ids: [device.id] } }).catch(() => {});

    load();
  }

  function showCode(device) {
    if (!device.unlock_pin) { setCodeDialog({ code: "—", note: "No code set for this device yet." }); return; }
    setCodeDialog({ code: device.unlock_pin, note: null });
  }

  async function resetUnlockCode(device) {
    const newPin = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from("devices").update({
      unlock_pin: newPin,
      unlock_pin_generated_at: new Date().toISOString(),
    }).eq("id", device.id);
    setCodeDialog({ code: newPin, note: "Old code is no longer valid. Give this new one to the customer." });
    load();
  }

  async function openHistory(device) {
    setHistoryDraft({ device, events: [], loading: true });
    const { data } = await supabase
      .from("device_events")
      .select("*")
      .eq("device_id", device.id)
      .order("occurred_at", { ascending: false });
    setHistoryDraft({ device, events: data || [], loading: false });
  }

  async function openApps(device) {
    setAppsDraft({ device, apps: [], loading: true, filter: "" });
    const { data } = await supabase
      .from("device_apps")
      .select("*")
      .eq("device_id", device.id)
      .order("app_name", { ascending: true });
    setAppsDraft({ device, apps: data || [], loading: false, filter: "" });
  }

  async function toggleAppWhitelist(app, checked) {
    setAppsDraft((prev) => (prev ? { ...prev, apps: prev.apps.map((a) => (a.id === app.id ? { ...a, is_whitelisted: checked } : a)) } : prev));
    await supabase.from("device_apps").update({ is_whitelisted: checked }).eq("id", app.id);
  }

  function openNotify(d) { setNotifyDraft({ device: d, message: "" }); setError(""); }

  async function sendNotify() {
    if (!notifyDraft.message.trim()) { setError("Enter a message."); return; }
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("device_commands").insert({
      device_id: notifyDraft.device.id,
      command: "NOTIFY",
      message: notifyDraft.message.trim(),
      issued_by: user?.email || "admin",
    });
    await supabase.functions.invoke("notify-devices", { body: { device_ids: [notifyDraft.device.id] } }).catch(() => {});
    setSending(false);
    setNotifyDraft(null);
    load();
  }

  function openPushCall(d) { setCallDraft({ device: d, caller_number: "", message: "" }); setError(""); }

  async function sendPushCall() {
    if (!callDraft.caller_number.trim()) { setError("Enter a caller number."); return; }
    if (!callDraft.message.trim()) { setError("Enter a message to speak."); return; }
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("device_commands").insert({
      device_id: callDraft.device.id,
      command: "PUSH_CALL",
      caller_number: callDraft.caller_number.trim(),
      message: callDraft.message.trim(),
      issued_by: user?.email || "admin",
    });
    await supabase.functions.invoke("notify-devices", { body: { device_ids: [callDraft.device.id] } }).catch(() => {});
    setSending(false);
    setCallDraft(null);
    load();
  }

  function endAudioCall() {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach((t) => t.stop()); localStreamRef.current = null; }
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    setAudioCall(null);
  }

  async function startAudioCall(device) {
    setAudioCall({ device, status: "connecting" });

    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setAudioCall({ device, status: "failed", errorMsg: "Microphone access denied or unavailable." });
      return;
    }
    localStreamRef.current = localStream;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcRef.current = pc;
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setAudioCall((prev) => (prev ? { ...prev, status: "connected" } : prev));
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setAudioCall((prev) => (prev ? { ...prev, status: "failed", errorMsg: "Call disconnected." } : prev));
      }
    };

    const sessionId = crypto.randomUUID();
    const channel = supabase.channel(`call:${sessionId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: "broadcast",
          event: "ice-admin",
          payload: {
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            candidate: event.candidate.candidate,
          },
        });
      }
    };

    channel
      .on("broadcast", { event: "ready" }, async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({ type: "broadcast", event: "offer", payload: { sdp: offer.sdp } });
        setAudioCall((prev) => (prev ? { ...prev, status: "ringing" } : prev));
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
      })
      .on("broadcast", { event: "ice-phone" }, async ({ payload }) => {
        try {
          await pc.addIceCandidate({ sdpMid: payload.sdpMid, sdpMLineIndex: payload.sdpMLineIndex, candidate: payload.candidate });
        } catch (e) {}
      })
      .subscribe();

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("device_commands").insert({
      device_id: device.id,
      command: "AUDIO_CALL",
      call_session_id: sessionId,
      issued_by: user?.email || "admin",
    });
    supabase.functions.invoke("notify-devices", { body: { device_ids: [device.id] } }).catch(() => {});
  }

  function openEdit(d) { setEditDraft({ id: d.id, device_model: d.device_model, imei: d.imei || "" }); setError(""); }

  async function saveEdit() {
    if (!editDraft.device_model.trim()) { setError("Enter a device model."); return; }
    await supabase.from("devices").update({
      device_model: editDraft.device_model.trim(),
      imei: editDraft.imei.trim() || null,
    }).eq("id", editDraft.id);
    setEditDraft(null);
    load();
  }

  async function performDelete(id) {
    await supabase.from("devices").delete().eq("id", id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div>
      <PageHeader eyebrow="Fleet" title="Devices" count={devices.length} />
      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Customer", "Device", "IMEI", "Status", "Last seen", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && devices.length === 0 && <tr><td colSpan={6} style={S.emptyCell}>No devices yet.</td></tr>}
            {devices.map((d) => {
              const lastCmd = d.device_commands?.sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at))[0];
              const pendingAck = lastCmd && !lastCmd.acknowledged_at;
              return (
                <tr key={d.id} style={S.tr}>
                  <td style={S.td}>{d.customers?.name || "—"}</td>
                  <td style={S.td}>{d.device_model}</td>
                  <td style={S.td} className="mono">{d.imei || "—"}</td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: d.is_locked ? "#FCEBEC" : "#E5F8F2", color: d.is_locked ? "#D6414C" : "#0E9488" }}>
                      {d.is_locked ? "Locked" : "Active"}
                    </span>
                    {d.sim_missing && (
                      <span style={{ ...S.badge, background: "#FBF0DC", color: "#AD6A0C", marginLeft: 6 }}>No SIM</span>
                    )}
                    {pendingAck && <span style={{ fontSize: 11, color: "#F2A93C", marginLeft: 8 }}>pending ack</span>}
                  </td>
                  <td style={S.td} className="mono">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleDateString() : "never"}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {d.is_locked ? (
                        <button style={{ ...S.secondaryBtn, padding: "6px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => sendCommand(d, "UNLOCK")}>
                          <Unlock size={13} /> Unlock
                        </button>
                      ) : (
                        <button style={{ ...S.dangerBtn, padding: "6px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => sendCommand(d, "LOCK")}>
                          <LockIcon size={13} /> Lock
                        </button>
                      )}
                      <button style={S.iconBtn} onClick={() => openNotify(d)} aria-label="Send notification"><Bell size={15} /></button>
                      <button style={S.iconBtn} onClick={() => openPushCall(d)} aria-label="Push call"><PhoneCall size={15} /></button>
                      <button style={S.iconBtn} onClick={() => startAudioCall(d)} aria-label="Audio call"><Mic size={15} /></button>
                      <button style={S.iconBtn} onClick={() => showCode(d)} aria-label="Show unlock code"><KeyRound size={15} /></button>
                      <button style={S.iconBtn} onClick={() => resetUnlockCode(d)} aria-label="Reset unlock code"><RefreshCw size={15} /></button>
                      <button style={S.iconBtn} onClick={() => openHistory(d)} aria-label="Activity history"><History size={15} /></button>
                      <button style={S.iconBtn} onClick={() => openApps(d)} aria-label="Allowed apps"><LayoutGrid size={15} /></button>
                      <button style={S.iconBtn} onClick={() => openEdit(d)} aria-label="Edit"><Pencil size={15} /></button>
                      <button style={S.iconBtn} onClick={() => setConfirmDelete(d)} aria-label="Delete"><Trash2 size={15} color="#D6414C" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {notifyDraft && (
        <Drawer title={`Notify ${notifyDraft.device.customers?.name || notifyDraft.device.device_model}`} onClose={() => setNotifyDraft(null)}>
          <Field label="Message" error={error}>
            <textarea
              style={{ ...S.input, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
              value={notifyDraft.message}
              onChange={(e) => setNotifyDraft({ ...notifyDraft, message: e.target.value })}
              placeholder="e.g. Your payment of Rs 10,000 is due tomorrow."
            />
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={{ ...S.primaryBtn, opacity: sending ? 0.7 : 1 }} onClick={sendNotify} disabled={sending}>
              {sending ? "Sending…" : "Send notification"}
            </button>
            <button style={S.secondaryBtn} onClick={() => setNotifyDraft(null)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {callDraft && (
        <Drawer title={`Push call · ${callDraft.device.customers?.name || callDraft.device.device_model}`} onClose={() => setCallDraft(null)}>
          <p style={{ fontSize: 12.5, color: "#6B7280", margin: "-8px 0 20px", lineHeight: 1.6 }}>
            Shows a simulated incoming call on the phone. On Answer, the message below is spoken aloud via on-device text-to-speech — not a real phone call.
          </p>
          <Field label="Caller number to display" error={error === "Enter a caller number." ? error : undefined}>
            <input
              style={S.input}
              value={callDraft.caller_number}
              onChange={(e) => setCallDraft({ ...callDraft, caller_number: e.target.value })}
              placeholder="021-1122334"
            />
          </Field>
          <Field label="Message to speak" error={error === "Enter a message to speak." ? error : undefined}>
            <textarea
              style={{ ...S.input, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
              value={callDraft.message}
              onChange={(e) => setCallDraft({ ...callDraft, message: e.target.value })}
              placeholder="e.g. This is a reminder from Karachi Electronics. Your installment payment is overdue. Please visit or call the store to clear your due amount."
            />
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={{ ...S.primaryBtn, opacity: sending ? 0.7 : 1 }} onClick={sendPushCall} disabled={sending}>
              {sending ? "Sending…" : "Push call"}
            </button>
            <button style={S.secondaryBtn} onClick={() => setCallDraft(null)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {audioCall && (
        <div style={S.overlay}>
          <div style={S.confirmCard}>
            <h3 className="serif" style={{ fontSize: 18, color: "#14161C", margin: "0 0 4px" }}>
              Audio call · {audioCall.device.customers?.name || audioCall.device.device_model}
            </h3>
            <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 20px" }}>
              {audioCall.status === "connecting" && "Ringing the phone…"}
              {audioCall.status === "ringing" && "Waiting for the phone to pick up…"}
              {audioCall.status === "connected" && "Connected — live call in progress."}
              {audioCall.status === "failed" && (audioCall.errorMsg || "Call failed.")}
            </p>
            <button style={S.dangerBtn} onClick={endAudioCall}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PhoneOff size={14} /> End call</span>
            </button>
          </div>
          <audio ref={remoteAudioRef} autoPlay />
        </div>
      )}

      {historyDraft && (
        <Drawer title={`Activity · ${historyDraft.device.customers?.name || historyDraft.device.device_model}`} onClose={() => setHistoryDraft(null)}>
          {historyDraft.loading && <p style={{ color: "#9AA1AE", fontSize: 13 }}>Loading…</p>}
          {!historyDraft.loading && historyDraft.events.length === 0 && (
            <p style={{ color: "#9AA1AE", fontSize: 13 }}>No activity yet.</p>
          )}
          {!historyDraft.loading && historyDraft.events.map((ev) => (
            <div key={ev.id} style={{ padding: "10px 0", borderBottom: "1px solid #EEF0F3" }}>
              <p style={{ fontSize: 13.5, color: "#14161C", margin: 0 }}>
                {ev.event_type === "LOCK" ? "Locked" : "Unlocked"} via {ev.method === "PIN_CODE" ? "code" : "admin"}
              </p>
              <p className="mono" style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0" }}>{formatEventTime(ev.occurred_at)}</p>
            </div>
          ))}
        </Drawer>
      )}

      {appsDraft && (
        <Drawer title={`Allowed apps · ${appsDraft.device.customers?.name || appsDraft.device.device_model}`} onClose={() => setAppsDraft(null)}>
          {appsDraft.loading && <p style={{ color: "#9AA1AE", fontSize: 13 }}>Loading…</p>}
          {!appsDraft.loading && appsDraft.apps.length === 0 && (
            <p style={{ color: "#9AA1AE", fontSize: 13 }}>No apps reported yet — this phone hasn't checked in.</p>
          )}
          {!appsDraft.loading && appsDraft.apps.length > 0 && (
            <>
              {appsDraft.apps.length > 15 && (
                <input
                  style={{ ...S.input, marginBottom: 14 }}
                  placeholder="Search apps…"
                  value={appsDraft.filter}
                  onChange={(e) => setAppsDraft({ ...appsDraft, filter: e.target.value })}
                />
              )}
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                {appsDraft.apps
                  .filter((app) => app.app_name.toLowerCase().includes(appsDraft.filter.toLowerCase()))
                  .map((app) => (
                    <label key={app.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #EEF0F3", cursor: "pointer" }}>
                      <input type="checkbox" checked={app.is_whitelisted} onChange={(e) => toggleAppWhitelist(app, e.target.checked)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, color: "#14161C", margin: 0 }}>{app.app_name}</p>
                        <p className="mono" style={{ fontSize: 11, color: "#9AA1AE", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.package_name}</p>
                      </div>
                    </label>
                  ))}
              </div>
            </>
          )}
        </Drawer>
      )}

      {codeDialog && (
        <CodeDialog code={codeDialog.code} note={codeDialog.note} onClose={() => setCodeDialog(null)} />
      )}

      {editDraft && (
        <Drawer title="Edit device" onClose={() => setEditDraft(null)}>
          <Field label="Device model" error={error}><input style={S.input} value={editDraft.device_model} onChange={(e) => setEditDraft({ ...editDraft, device_model: e.target.value })} /></Field>
          <Field label="IMEI (optional)"><input style={S.input} value={editDraft.imei} onChange={(e) => setEditDraft({ ...editDraft, imei: e.target.value })} /></Field>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={S.primaryBtn} onClick={saveEdit}>Save changes</button>
            <button style={S.secondaryBtn} onClick={() => setEditDraft(null)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove device"
          message={`${confirmDelete.device_model} and its installment plans/payment history will be removed. This can't be undone.`}
          onConfirm={() => performDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/* ---------------- PAYMENTS ---------------- */

function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [editDraft, setEditDraft] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*, installment_plans(devices(device_model, customers(name)))")
      .order("due_date", { ascending: false });
    setPayments(data || []);
    setLoading(false);
  }

  async function markPaid(id) {
    await supabase.from("payments").update({ status: "Paid", paid_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  function openEdit(p) { setEditDraft({ id: p.id, amount: p.amount, due_date: p.due_date, status: p.status }); setError(""); }

  async function saveEdit() {
    const amt = Number(editDraft.amount);
    if (!amt || !editDraft.due_date) { setError("Enter amount and due date."); return; }
    const payload = { amount: amt, due_date: editDraft.due_date, status: editDraft.status };
    payload.paid_at = editDraft.status === "Paid" ? new Date().toISOString() : null;
    await supabase.from("payments").update(payload).eq("id", editDraft.id);
    setEditDraft(null);
    load();
  }

  async function performDelete(id) {
    await supabase.from("payments").delete().eq("id", id);
    setConfirmDelete(null);
    load();
  }

  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const effectiveStatus = p.status === "Pending" && p.due_date < today ? "Missed" : p.status;
      return statusFilter === "All" || effectiveStatus === statusFilter;
    });
  }, [payments, statusFilter, today]);

  return (
    <div>
      <PageHeader eyebrow="Ledger" title="Payments" count={payments.length}>
        <select style={S.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {["All", "Pending", "Paid", "Missed"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </PageHeader>

      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Customer", "Device", "Due date", "Amount", "Status", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} style={S.emptyCell}>No payments match this filter.</td></tr>}
            {filtered.map((p) => {
              const effectiveStatus = p.status === "Pending" && p.due_date < today ? "Missed" : p.status;
              const color = effectiveStatus === "Paid" ? "#0E9488" : effectiveStatus === "Missed" ? "#D6414C" : "#F2A93C";
              return (
                <tr key={p.id} style={S.tr}>
                  <td style={S.td}>{p.installment_plans?.devices?.customers?.name || "—"}</td>
                  <td style={S.td}>{p.installment_plans?.devices?.device_model || "—"}</td>
                  <td style={S.td} className="mono">{p.due_date}</td>
                  <td style={S.td}>{money(p.amount)}</td>
                  <td style={S.td}><span style={{ fontSize: 13, color }}>{effectiveStatus}</span></td>
                  <td style={{ ...S.td, textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {effectiveStatus !== "Paid" && (
                        <button style={{ ...S.secondaryBtn, padding: "6px 12px", fontSize: 12.5 }} onClick={() => markPaid(p.id)}>Mark paid</button>
                      )}
                      <button style={S.iconBtn} onClick={() => openEdit(p)} aria-label="Edit"><Pencil size={15} /></button>
                      <button style={S.iconBtn} onClick={() => setConfirmDelete(p)} aria-label="Delete"><Trash2 size={15} color="#D6414C" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editDraft && (
        <Drawer title="Edit payment" onClose={() => setEditDraft(null)}>
          <Field label="Amount"><input style={S.input} type="number" value={editDraft.amount} onChange={(e) => setEditDraft({ ...editDraft, amount: e.target.value })} /></Field>
          <Field label="Due date"><input style={S.input} type="date" value={editDraft.due_date} onChange={(e) => setEditDraft({ ...editDraft, due_date: e.target.value })} /></Field>
          <Field label="Status">
            <select style={{ ...S.select, width: "100%" }} value={editDraft.status} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value })}>
              {["Pending", "Paid", "Missed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {error && <p style={{ fontSize: 12, color: "#D6414C" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={S.primaryBtn} onClick={saveEdit}>Save changes</button>
            <button style={S.secondaryBtn} onClick={() => setEditDraft(null)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove payment"
          message="This payment record will be permanently removed. This can't be undone."
          onConfirm={() => performDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/* ---------------- WHITELISTED NUMBERS ---------------- */

function WhitelistedNumbers() {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState(emptyNumber());
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  function emptyNumber() { return { id: null, label: "", phone_number: "" }; }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("whitelisted_numbers").select("*").order("created_at", { ascending: false });
    setNumbers(data || []);
    setLoading(false);
  }

  function openAdd() { setDraft(emptyNumber()); setErrors({}); setDrawerOpen(true); }
  function openEdit(n) { setDraft({ ...n }); setErrors({}); setDrawerOpen(true); }

  async function save() {
    const e = {};
    if (!draft.label.trim()) e.label = "Enter a label.";
    if (!draft.phone_number.trim()) e.phone_number = "Enter a phone number.";
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = { label: draft.label.trim(), phone_number: draft.phone_number.trim() };
    if (draft.id == null) await supabase.from("whitelisted_numbers").insert(payload);
    else await supabase.from("whitelisted_numbers").update(payload).eq("id", draft.id);
    setDrawerOpen(false);
    load();
  }

  async function performDelete(id) {
    await supabase.from("whitelisted_numbers").delete().eq("id", id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div>
      <PageHeader eyebrow="Config" title="Whitelisted Numbers" count={numbers.length}>
        <button style={S.primaryBtn} onClick={openAdd}><Plus size={16} /> Add number</button>
      </PageHeader>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "-20px 0 24px", maxWidth: 520 }}>
        Locked phones show a "Call {"{label}"}" button for each number below — these are the only numbers a locked customer can reach.
      </p>

      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Label", "Phone number", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={3} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && numbers.length === 0 && <tr><td colSpan={3} style={S.emptyCell}>No whitelisted numbers yet.</td></tr>}
            {numbers.map((n) => (
              <tr key={n.id} style={S.tr}>
                <td style={S.td}>{n.label}</td>
                <td style={S.td} className="mono">{n.phone_number}</td>
                <td style={{ ...S.td, textAlign: "right" }}>
                  <button style={S.iconBtn} onClick={() => openEdit(n)} aria-label="Edit"><Pencil size={15} /></button>
                  <button style={{ ...S.iconBtn, marginLeft: 4 }} onClick={() => setConfirmDelete(n)} aria-label="Delete"><Trash2 size={15} color="#D6414C" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <Drawer title={draft.id == null ? "Add number" : "Edit number"} onClose={() => setDrawerOpen(false)}>
          <Field label="Label" error={errors.label}><input style={S.input} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Karachi Electronics - Gulshan Branch" /></Field>
          <Field label="Phone number" error={errors.phone_number}><input style={S.input} value={draft.phone_number} onChange={(e) => setDraft({ ...draft, phone_number: e.target.value })} placeholder="02112345678" /></Field>
          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <button style={S.primaryBtn} onClick={save}>{draft.id == null ? "Add number" : "Save changes"}</button>
            <button style={S.secondaryBtn} onClick={() => setDrawerOpen(false)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove number"
          message={`${confirmDelete.label} will be removed from the whitelist. Locked customers will no longer be able to call it. This can't be undone.`}
          onConfirm={() => performDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/* ---------------- SEND MESSAGE (UI only, wiring later) ---------------- */

function SendMessagePage() {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div>
      <PageHeader eyebrow="Custom Management" title="Send Message" />
      <p style={{ fontSize: 13, color: "#6B7280", margin: "-20px 0 24px", maxWidth: 560 }}>
        Send a one-off message to a customer's device. Layout only for now — sending isn't wired up yet.
      </p>

      <div style={{ ...S.tableCard, padding: "24px 26px", maxWidth: 480 }}>
        <Field label="Device / Customer">
          <select style={{ ...S.select, width: "100%" }} value={recipient} onChange={(e) => setRecipient(e.target.value)}>
            <option value="">Select a device…</option>
          </select>
        </Field>
        <Field label="Message">
          <textarea
            style={{ ...S.input, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type the message to send…"
          />
        </Field>
        <button style={S.primaryBtn}><Send size={15} /> Send message</button>
      </div>
    </div>
  );
}

/* ---------------- ROLES ---------------- */

function RolesList() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState({ id: null, name: "" });
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("roles").select("*").order("created_at", { ascending: true });
    setRoles(data || []);
    setLoading(false);
  }

  function openAdd() { setDraft({ id: null, name: "" }); setErrors({}); setDrawerOpen(true); }
  function openEdit(r) { setDraft({ id: r.id, name: r.name }); setErrors({}); setDrawerOpen(true); }

  async function save() {
    if (!draft.name.trim()) { setErrors({ name: "Enter a role name." }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (draft.id == null) {
      await supabase.from("roles").insert({ name: draft.name.trim(), created_by: user?.email || "admin" });
    } else {
      await supabase.from("roles").update({ name: draft.name.trim() }).eq("id", draft.id);
    }
    setDrawerOpen(false);
    load();
  }

  async function performDelete(id) {
    await supabase.from("roles").delete().eq("id", id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Role List" count={roles.length}>
        <button style={S.primaryBtn} onClick={openAdd}><Plus size={16} /> Create role</button>
      </PageHeader>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "-20px 0 24px", maxWidth: 560 }}>
        Permissions per role aren't wired up yet — roles exist here so they can be assigned when inviting staff in Account Management.
      </p>

      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Role", "Permissions", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={3} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && roles.length === 0 && <tr><td colSpan={3} style={S.emptyCell}>No roles yet.</td></tr>}
            {roles.map((r) => (
              <tr key={r.id} style={S.tr}>
                <td style={S.td}>{r.name}</td>
                <td style={S.td}>
                  <span style={{ ...S.badge, background: "#EEF0F4", color: "#6B7280" }}>{(r.permissions || []).length} permissions</span>
                </td>
                <td style={{ ...S.td, textAlign: "right" }}>
                  <button style={S.iconBtn} onClick={() => openEdit(r)} aria-label="Edit"><Pencil size={15} /></button>
                  <button style={{ ...S.iconBtn, marginLeft: 4 }} onClick={() => setConfirmDelete(r)} aria-label="Delete"><Trash2 size={15} color="#D6414C" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <Drawer title={draft.id == null ? "Create role" : "Edit role"} onClose={() => setDrawerOpen(false)}>
          <Field label="Role name" error={errors.name}><input style={S.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Branch Manager" /></Field>
          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <button style={S.primaryBtn} onClick={save}>{draft.id == null ? "Create role" : "Save changes"}</button>
            <button style={S.secondaryBtn} onClick={() => setDrawerOpen(false)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove role"
          message={`${confirmDelete.name} will be removed. Staff already invited with this role keep their current access.`}
          onConfirm={() => performDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/* ---------------- ACCOUNT MANAGEMENT ---------------- */

function AccountManagement() {
  const [users, setUsers] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", role: "" });
  const [errors, setErrors] = useState({});
  const [inviting, setInviting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { load(); loadRoleOptions(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("admin_users").select("*").order("invited_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  async function loadRoleOptions() {
    const { data } = await supabase.from("roles").select("name").order("name", { ascending: true });
    setRoleOptions((data || []).map((r) => r.name));
  }

  function openInvite() { setDraft({ name: "", email: "", role: roleOptions[0] || "" }); setErrors({}); setDrawerOpen(true); }

  async function sendInvite() {
    const e = {};
    if (!draft.name.trim()) e.name = "Enter a name.";
    if (!draft.email.trim()) e.email = "Enter an email.";
    if (!draft.role.trim()) e.role = "Enter a role.";
    setErrors(e);
    if (Object.keys(e).length) return;

    setInviting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.functions.invoke("invite-admin-user", {
      body: { name: draft.name.trim(), email: draft.email.trim(), role: draft.role.trim(), invited_by: user?.email || "admin" },
    });
    setInviting(false);
    if (error || !data?.success) {
      setErrors({ form: data?.reason || "Could not send invite. Try again." });
      return;
    }
    setDrawerOpen(false);
    load();
  }

  async function performDelete(u) {
    const { data } = await supabase.functions.invoke("remove-admin-user", { body: { id: u.id } }).catch(() => ({ data: null }));
    if (!data?.success) return;
    setConfirmDelete(null);
    load();
  }

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Account Management" count={users.length}>
        <button style={S.primaryBtn} onClick={openInvite}><Plus size={16} /> Invite user</button>
      </PageHeader>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "-20px 0 24px", maxWidth: 520 }}>
        Invited staff get an email with a link to set their password and sign in to this admin panel.
      </p>

      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Name", "Email", "Role", "Status", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan={5} style={S.emptyCell}>No accounts yet.</td></tr>}
            {users.map((u) => (
              <tr key={u.id} style={S.tr}>
                <td style={S.td}>{u.name}</td>
                <td style={S.td} className="mono">{u.email}</td>
                <td style={S.td}>{u.role}</td>
                <td style={S.td}>
                  <span style={{ ...S.badge, background: "#E5F8F2", color: "#0E9488" }}>{u.status || "Invited"}</span>
                </td>
                <td style={{ ...S.td, textAlign: "right" }}>
                  <button style={S.iconBtn} onClick={() => setConfirmDelete(u)} aria-label="Remove"><Trash2 size={15} color="#D6414C" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <Drawer title="Invite user" onClose={() => setDrawerOpen(false)}>
          <Field label="Name" error={errors.name}><input style={S.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Jordan Lee" /></Field>
          <Field label="Email" error={errors.email}><input style={S.input} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="staff@karachielectronics.pk" /></Field>
          <Field label="Role" error={errors.role}>
            {roleOptions.length > 0 ? (
              <select style={{ ...S.select, width: "100%" }} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <p style={{ fontSize: 12.5, color: "#9AA1AE", margin: 0 }}>No roles created yet — add one in Role List first.</p>
            )}
          </Field>
          {errors.form && <p style={{ fontSize: 12, color: "#D6414C", margin: "0 0 12px" }}>{errors.form}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={{ ...S.primaryBtn, opacity: inviting ? 0.7 : 1 }} onClick={sendInvite} disabled={inviting}>
              {inviting ? "Sending…" : "Send invite"}
            </button>
            <button style={S.secondaryBtn} onClick={() => setDrawerOpen(false)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove account"
          message={`${confirmDelete.name} (${confirmDelete.email}) will lose access to this admin panel immediately. This can't be undone.`}
          onConfirm={() => performDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/* ---------------- SHARED UI ---------------- */

function PageHeader({ eyebrow, title, count, children }) {
  return (
    <header style={{ marginBottom: 28 }}>
      <p style={S.eyebrow}>{eyebrow}</p>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 className="serif" style={S.h1}>
          {title}
          {count != null && <span style={{ color: "#9AA1AE", fontSize: 22, marginLeft: 10 }}>{count}</span>}
        </h1>
        <div style={{ display: "flex", gap: 10 }}>{children}</div>
      </div>
    </header>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={S.statCard}>
      <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 6px" }}>{label}</p>
      <p className="serif" style={{ fontSize: 26, color: accent || "#14161C", margin: 0 }}>{value}</p>
    </div>
  );
}

function GrowthChart({ data }) {
  if (!data.length) return null;
  const width = 700, height = 200, padL = 10, padR = 10, padT = 10, padB = 24;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.enrolled, d.locked, d.unlocked]));

  const xFor = (i) => padL + (data.length === 1 ? 0 : (i / (data.length - 1)) * innerW);
  const yFor = (v) => padT + innerH - (v / maxVal) * innerH;
  const lineFor = (key) => data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)},${yFor(d[key]).toFixed(1)}`).join(" ");

  const series = [
    { key: "enrolled", label: "Enrolled", color: "#F2A93C" },
    { key: "locked", label: "Locked", color: "#D6414C" },
    { key: "unlocked", label: "Unlocked", color: "#0E9488" },
  ];
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ ...S.tableCard, padding: "18px 20px 10px" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        {series.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
            {s.label}
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {series.map((s) => (
          <path key={s.key} d={lineFor(s.key)} fill="none" stroke={s.color} strokeWidth="2" />
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d.date} x={xFor(i)} y={height - 4} fontSize="9" fill="#9AA1AE" textAnchor="middle">
              {d.date.slice(5)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12.5, color: "#6B7280", marginBottom: 6 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 12, color: "#D6414C", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}

function Drawer({ title, onClose, children }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 className="serif" style={{ fontSize: 20, color: "#14161C", margin: 0 }}>{title}</h2>
          <button style={S.iconBtn} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CodeDialog({ code, note, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.confirmCard} onClick={(e) => e.stopPropagation()}>
        <h3 className="serif" style={{ fontSize: 18, color: "#14161C", margin: "0 0 8px" }}>Unlock code</h3>
        <p className="mono" style={{ fontSize: 32, letterSpacing: 4, color: "#F2A93C", margin: "8px 0 16px" }}>{code}</p>
        {note && <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 20px", lineHeight: 1.6 }}>{note}</p>}
        <button style={S.primaryBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.confirmCard} onClick={(e) => e.stopPropagation()}>
        <h3 className="serif" style={{ fontSize: 18, color: "#14161C", margin: "0 0 8px" }}>{title}</h3>
        <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 20px", lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.dangerBtn} onClick={onConfirm}>Confirm</button>
          <button style={S.secondaryBtn} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */

const S = {
  loginPage: { minHeight: "100vh", background: "#F5F6F8", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  loginCard: { width: 380, background: "#FFFFFF", border: "1px solid #E6E8EC", borderRadius: 14, padding: "32px 28px" },
  iconInputWrap: { display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #D8DCE3", borderRadius: 8, padding: "9px 12px" },
  iconInput: { background: "transparent", border: "none", color: "#14161C", fontSize: 13.5, width: "100%", outline: "none" },
  logoutBtn: { display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid #D8DCE3", borderRadius: 7, padding: "6px 10px", fontSize: 12.5, color: "#6B7280" },
  appShell: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "#F5F6F8", color: "#14161C" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, flexShrink: 0, background: "#FFFFFF", borderBottom: "1px solid #E6E8EC", padding: "0 24px" },
  appBody: { display: "flex", flex: 1, minHeight: 0 },
  sidebar: { width: 224, flexShrink: 0, background: "#FFFFFF", borderRight: "1px solid #E6E8EC", padding: "20px 14px" },
  logoMark: { width: 28, height: 28, borderRadius: 7, background: "#F2A93C", color: "#2C1E06", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 14, flexShrink: 0 },
  navItem: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 7, fontSize: 13.5, color: "#6B7280", cursor: "pointer" },
  navItemActive: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 7, fontSize: 13.5, color: "#14161C", background: "#FBF1E1", borderLeft: "2px solid #F2A93C", cursor: "pointer" },
  navGroupHeader: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: "#6B7280", cursor: "pointer" },
  navSubItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 8px 28px", borderRadius: 7, fontSize: 13, color: "#6B7280", cursor: "pointer" },
  navSubItemActive: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 8px 28px", borderRadius: 7, fontSize: 13, color: "#14161C", background: "#FBF1E1", borderLeft: "2px solid #F2A93C", cursor: "pointer" },
  main: { flex: 1, padding: "36px 44px", maxWidth: 1080, overflowY: "auto" },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "#9AA1AE", margin: "0 0 6px" },
  h1: { fontSize: 30, fontWeight: 500, margin: 0, color: "#14161C" },
  primaryBtn: { display: "flex", alignItems: "center", gap: 7, background: "#F2A93C", color: "#2C1E06", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600 },
  secondaryBtn: { background: "transparent", color: "#374151", border: "1px solid #D8DCE3", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 500 },
  dangerBtn: { background: "#E5636A", color: "#2C0A0C", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600 },
  statCard: { background: "#FFFFFF", border: "1px solid #E6E8EC", borderRadius: 12, padding: "16px 18px" },
  select: { background: "#FFFFFF", border: "1px solid #D8DCE3", borderRadius: 8, color: "#374151", fontSize: 13.5, padding: "8px 12px" },
  tableCard: { background: "#FFFFFF", border: "1px solid #E6E8EC", borderRadius: 12, overflow: "hidden" },
  th: { textAlign: "left", fontSize: 11.5, letterSpacing: 0.6, textTransform: "uppercase", color: "#9AA1AE", padding: "13px 16px", borderBottom: "1px solid #E6E8EC", fontWeight: 500 },
  tr: { borderBottom: "1px solid #EEF0F3" },
  td: { padding: "13px 16px", verticalAlign: "middle", fontSize: 13.5, color: "#374151" },
  emptyCell: { padding: "36px 16px", textAlign: "center", color: "#9AA1AE", fontSize: 13 },
  avatar: { width: 32, height: 32, borderRadius: "50%", background: "#EEF0F4", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 },
  badge: { fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "inline-block" },
  iconBtn: { background: "transparent", border: "1px solid #D8DCE3", borderRadius: 7, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(17,24,39,0.4)", display: "flex", justifyContent: "flex-end", zIndex: 50 },
  drawer: { width: 380, background: "#FFFFFF", borderLeft: "1px solid #E6E8EC", height: "100%", padding: "28px 26px", overflowY: "auto" },
  input: { width: "100%", background: "#FFFFFF", border: "1px solid #D8DCE3", borderRadius: 8, color: "#14161C", fontSize: 13.5, padding: "9px 12px" },
  confirmCard: { margin: "auto", background: "#FFFFFF", border: "1px solid #D8DCE3", borderRadius: 12, padding: 24, width: 360, alignSelf: "center", marginRight: 40 },
};
