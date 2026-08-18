import React, { useState, useEffect, useMemo } from "react";
import {
  Users, Smartphone, Wallet, LayoutDashboard, LogOut, Mail, Lock,
  Plus, X, Pencil, Trash2, Lock as LockIcon, Unlock,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const money = (n) => `Rs ${Number(n || 0).toLocaleString()}`;

function initials(name) {
  return (name || "").split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
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

  if (!authChecked) return <div style={{ minHeight: "100vh", background: "#0F1115" }} />;
  if (!session) return <LoginScreen />;

  return (
    <div style={S.app}>
      <GlobalStyle />
      <Sidebar tab={tab} setTab={setTab} email={session.user.email} />
      <main style={S.main}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "customers" && <Customers />}
        {tab === "devices" && <Devices />}
        {tab === "payments" && <Payments />}
      </main>
    </div>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
      * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
      .serif { font-family: 'Fraunces', serif; }
      .mono { font-family: 'JetBrains Mono', monospace; }
      input, select { outline: none; }
      input:focus, select:focus { box-shadow: 0 0 0 2px #F2A93C55; border-color: #F2A93C !important; }
      button { cursor: pointer; }
      ::placeholder { color: #5C6478; }
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
          <span className="serif" style={{ fontSize: 18, color: "#EDEEF2" }}>Northline</span>
        </div>
        <h1 className="serif" style={{ fontSize: 24, color: "#EDEEF2", margin: "0 0 6px" }}>
          {mode === "signIn" ? "Sign in" : "Create account"}
        </h1>
        <p style={{ fontSize: 13.5, color: "#8891A3", margin: "0 0 24px" }}>Installment device admin panel.</p>

        <Field label="Email">
          <div style={S.iconInputWrap}>
            <Mail size={15} color="#5C6478" />
            <input style={S.iconInput} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        </Field>
        <Field label="Password">
          <div style={S.iconInputWrap}>
            <Lock size={15} color="#5C6478" />
            <input type="password" style={S.iconInput} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        </Field>
        {error && <p style={{ fontSize: 12.5, color: "#E5636A", margin: "0 0 12px" }}>{error}</p>}

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

function Sidebar({ tab, setTab, email }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "customers", label: "Customers", icon: Users },
    { id: "devices", label: "Devices", icon: Smartphone },
    { id: "payments", label: "Payments", icon: Wallet },
  ];
  return (
    <aside style={S.sidebar}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
        <div style={S.logoMark}>N</div>
        <span className="serif" style={{ fontSize: 18, color: "#EDEEF2" }}>Northline</span>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((it) => {
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
      <div style={{ marginTop: "auto", paddingTop: 24, borderTop: "1px solid #262B36" }}>
        <p style={{ fontSize: 12, color: "#5C6478", margin: 0 }}>Signed in as</p>
        <p style={{ fontSize: 13, color: "#C7CCD9", margin: "4px 0 0", wordBreak: "break-all" }}>{email}</p>
        <button style={S.logoutBtn} onClick={() => supabase.auth.signOut()}>
          <LogOut size={14} /> Log out
        </button>
      </div>
    </aside>
  );
}

/* ---------------- DASHBOARD ---------------- */

function Dashboard() {
  const [stats, setStats] = useState({ customers: 0, devices: 0, locked: 0, overdue: 0 });
  const [overdueList, setOverdueList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

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

  return (
    <div>
      <PageHeader eyebrow="Overview" title="Dashboard" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Total customers" value={stats.customers} />
        <StatCard label="Total devices" value={stats.devices} />
        <StatCard label="Locked now" value={stats.locked} accent="#E5636A" />
        <StatCard label="Overdue payments" value={stats.overdue} accent="#F2A93C" />
      </div>

      <h3 className="serif" style={{ fontSize: 16, color: "#EDEEF2", margin: "0 0 12px" }}>Overdue this period</h3>
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
                    <span style={{ fontSize: 13.5, color: "#EDEEF2", fontWeight: 500 }}>{c.name}</span>
                  </div>
                </td>
                <td style={S.td} className="mono">{c.phone_number}</td>
                <td style={S.td}>{c.devices?.length || 0}</td>
                <td style={{ ...S.td, textAlign: "right" }}>
                  <button style={S.iconBtn} onClick={() => openEdit(c)} aria-label="Edit"><Pencil size={15} /></button>
                  <button style={{ ...S.iconBtn, marginLeft: 4 }} onClick={() => setConfirmDelete(c)} aria-label="Delete"><Trash2 size={15} color="#E5636A" /></button>
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
    await supabase.from("devices").insert({
      customer_id: customer.id,
      device_model: deviceDraft.device_model.trim(),
      imei: deviceDraft.imei.trim() || null,
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
      <p style={{ fontSize: 13.5, color: "#8891A3", margin: "-16px 0 24px" }} className="mono">{customer.phone_number}</p>

      {loading && <p style={{ color: "#5C6478", fontSize: 13 }}>Loading…</p>}
      {!loading && devices.length === 0 && <p style={{ color: "#5C6478", fontSize: 13 }}>No devices yet.</p>}

      {devices.map((d) => (
        <div key={d.id} style={{ ...S.statCard, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 14.5, color: "#EDEEF2", fontWeight: 500, margin: 0 }}>{d.device_model}</p>
              <p className="mono" style={{ fontSize: 12, color: "#8891A3", margin: "2px 0 0" }}>{d.imei || "no IMEI set"}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...S.badge, background: d.is_locked ? "#3A1416" : "#0F2F2C", color: d.is_locked ? "#E5636A" : "#4FCFC0" }}>
                {d.is_locked ? "Locked" : "Active"}
              </span>
              <button style={S.iconBtn} onClick={() => openEditDevice(d)} aria-label="Edit device"><Pencil size={15} /></button>
              <button style={S.iconBtn} onClick={() => setConfirmDeleteDevice(d)} aria-label="Delete device"><Trash2 size={15} color="#E5636A" /></button>
            </div>
          </div>
          {d.installment_plans?.length > 0 ? (
            d.installment_plans.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, margin: "4px 0" }}>
                <p style={{ fontSize: 12.5, color: "#8891A3", margin: 0 }}>
                  Plan: {money(p.total_amount)} total, {money(p.monthly_amount)}/mo for {p.number_of_months} months, due day {p.due_day} — <span style={{ color: "#C7CCD9" }}>{p.status}</span>
                </p>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button style={S.iconBtn} onClick={() => openEditPlan(p)} aria-label="Edit plan"><Pencil size={13} /></button>
                  <button style={S.iconBtn} onClick={() => setConfirmDeletePlan(p)} aria-label="Delete plan"><Trash2 size={13} color="#E5636A" /></button>
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
          {error && <p style={{ fontSize: 12, color: "#E5636A" }}>{error}</p>}
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
          {error && <p style={{ fontSize: 12, color: "#E5636A" }}>{error}</p>}
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
          {error && <p style={{ fontSize: 12, color: "#E5636A" }}>{error}</p>}
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
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

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
    load();
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
                    <span style={{ ...S.badge, background: d.is_locked ? "#3A1416" : "#0F2F2C", color: d.is_locked ? "#E5636A" : "#4FCFC0" }}>
                      {d.is_locked ? "Locked" : "Active"}
                    </span>
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
                      <button style={S.iconBtn} onClick={() => openEdit(d)} aria-label="Edit"><Pencil size={15} /></button>
                      <button style={S.iconBtn} onClick={() => setConfirmDelete(d)} aria-label="Delete"><Trash2 size={15} color="#E5636A" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
              const color = effectiveStatus === "Paid" ? "#4FCFC0" : effectiveStatus === "Missed" ? "#E5636A" : "#F2A93C";
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
                      <button style={S.iconBtn} onClick={() => setConfirmDelete(p)} aria-label="Delete"><Trash2 size={15} color="#E5636A" /></button>
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
          {error && <p style={{ fontSize: 12, color: "#E5636A" }}>{error}</p>}
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

/* ---------------- SHARED UI ---------------- */

function PageHeader({ eyebrow, title, count, children }) {
  return (
    <header style={{ marginBottom: 28 }}>
      <p style={S.eyebrow}>{eyebrow}</p>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 className="serif" style={S.h1}>
          {title}
          {count != null && <span style={{ color: "#5C6478", fontSize: 22, marginLeft: 10 }}>{count}</span>}
        </h1>
        <div style={{ display: "flex", gap: 10 }}>{children}</div>
      </div>
    </header>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={S.statCard}>
      <p style={{ fontSize: 12, color: "#8891A3", margin: "0 0 6px" }}>{label}</p>
      <p className="serif" style={{ fontSize: 26, color: accent || "#EDEEF2", margin: 0 }}>{value}</p>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12.5, color: "#8891A3", marginBottom: 6 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 12, color: "#E5636A", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}

function Drawer({ title, onClose, children }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 className="serif" style={{ fontSize: 20, color: "#EDEEF2", margin: 0 }}>{title}</h2>
          <button style={S.iconBtn} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.confirmCard} onClick={(e) => e.stopPropagation()}>
        <h3 className="serif" style={{ fontSize: 18, color: "#EDEEF2", margin: "0 0 8px" }}>{title}</h3>
        <p style={{ fontSize: 13.5, color: "#8891A3", margin: "0 0 20px", lineHeight: 1.6 }}>{message}</p>
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
  loginPage: { minHeight: "100vh", background: "#0F1115", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  loginCard: { width: 380, background: "#171A21", border: "1px solid #21242D", borderRadius: 14, padding: "32px 28px" },
  iconInputWrap: { display: "flex", alignItems: "center", gap: 8, background: "#171A21", border: "1px solid #2A2F3A", borderRadius: 8, padding: "9px 12px" },
  iconInput: { background: "transparent", border: "none", color: "#EDEEF2", fontSize: 13.5, width: "100%", outline: "none" },
  logoutBtn: { display: "flex", alignItems: "center", gap: 6, marginTop: 12, background: "transparent", border: "1px solid #2A2F3A", borderRadius: 7, padding: "6px 10px", fontSize: 12.5, color: "#8891A3" },
  app: { display: "flex", minHeight: "100vh", background: "#0F1115", color: "#EDEEF2" },
  sidebar: { width: 208, flexShrink: 0, background: "#12141A", borderRight: "1px solid #21242D", padding: "24px 18px", display: "flex", flexDirection: "column" },
  logoMark: { width: 28, height: 28, borderRadius: 7, background: "#F2A93C", color: "#2C1E06", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 14 },
  navItem: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 7, fontSize: 13.5, color: "#8891A3", cursor: "pointer" },
  navItemActive: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 7, fontSize: 13.5, color: "#EDEEF2", background: "#1C2029", borderLeft: "2px solid #F2A93C", cursor: "pointer" },
  main: { flex: 1, padding: "36px 44px", maxWidth: 1080 },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "#5C6478", margin: "0 0 6px" },
  h1: { fontSize: 30, fontWeight: 500, margin: 0, color: "#EDEEF2" },
  primaryBtn: { display: "flex", alignItems: "center", gap: 7, background: "#F2A93C", color: "#2C1E06", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600 },
  secondaryBtn: { background: "transparent", color: "#C7CCD9", border: "1px solid #2A2F3A", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 500 },
  dangerBtn: { background: "#E5636A", color: "#2C0A0C", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600 },
  statCard: { background: "#171A21", border: "1px solid #21242D", borderRadius: 12, padding: "16px 18px" },
  select: { background: "#171A21", border: "1px solid #2A2F3A", borderRadius: 8, color: "#C7CCD9", fontSize: 13.5, padding: "8px 12px" },
  tableCard: { background: "#141720", border: "1px solid #21242D", borderRadius: 12, overflow: "hidden" },
  th: { textAlign: "left", fontSize: 11.5, letterSpacing: 0.6, textTransform: "uppercase", color: "#5C6478", padding: "13px 16px", borderBottom: "1px solid #21242D", fontWeight: 500 },
  tr: { borderBottom: "1px solid #1B1E27" },
  td: { padding: "13px 16px", verticalAlign: "middle", fontSize: 13.5, color: "#C7CCD9" },
  emptyCell: { padding: "36px 16px", textAlign: "center", color: "#5C6478", fontSize: 13 },
  avatar: { width: 32, height: 32, borderRadius: "50%", background: "#20232C", color: "#C7CCD9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 },
  badge: { fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "inline-block" },
  iconBtn: { background: "transparent", border: "1px solid #2A2F3A", borderRadius: 7, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(6,7,10,0.6)", display: "flex", justifyContent: "flex-end", zIndex: 50 },
  drawer: { width: 380, background: "#12141A", borderLeft: "1px solid #21242D", height: "100%", padding: "28px 26px", overflowY: "auto" },
  input: { width: "100%", background: "#171A21", border: "1px solid #2A2F3A", borderRadius: 8, color: "#EDEEF2", fontSize: 13.5, padding: "9px 12px" },
  confirmCard: { margin: "auto", background: "#171A21", border: "1px solid #2A2F3A", borderRadius: 12, padding: 24, width: 360, alignSelf: "center", marginRight: 40 },
};
