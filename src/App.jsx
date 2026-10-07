import React, { useState, useEffect, useMemo, useRef, useContext, createContext } from "react";
import {
  Smartphone, Wallet, LayoutDashboard, LogOut, Mail, Lock,
  Plus, X, Pencil, Trash2, Lock as LockIcon, Unlock, Bell,
  History, KeyRound, RefreshCw, LayoutGrid, PhoneCall, Mic, PhoneOff, UserCog, ShieldCheck,
  ChevronDown, Settings, HelpCircle, Sliders, Send, Upload, Copy, PhoneIncoming, QrCode, Wifi,
} from "lucide-react";
import QRCode from "qrcode";
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

const BrandingContext = createContext({ name: "Northline", iconUrl: null, reload: () => {} });
const BranchContext = createContext({ branchId: null, branchName: "", isSuperAdmin: false, deviceLicenseLimit: 0, reload: () => {} });

export default function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [deviceSettingsTab, setDeviceSettingsTab] = useState("enroll");
  const [sendMessageDeviceId, setSendMessageDeviceId] = useState(null);
  const [sendMessageTab, setSendMessageTab] = useState("popups");
  const [sendMessageImei, setSendMessageImei] = useState("");
  const [branding, setBranding] = useState({ name: "Northline", iconUrl: null });
  const [profile, setProfile] = useState({ branchId: null, branchName: "", isSuperAdmin: false, deviceLicenseLimit: 0 });
  const [appMode, setAppMode] = useState("branch"); // "branch" | "super"

  async function loadProfile(userId) {
    setProfileChecked(false);
    try {
      const { data: adminRow } = await supabase.from("admin_users").select("branch_id, is_super_admin").eq("id", userId).maybeSingle();
      const isSuperAdmin = !!adminRow?.is_super_admin;
      const branchId = adminRow?.branch_id || null;

      let branchName = "";
      let deviceLicenseLimit = 0;
      if (branchId) {
        const { data: branchRow } = await supabase.from("branches").select("name, device_license_limit").eq("id", branchId).maybeSingle();
        branchName = branchRow?.name || "";
        deviceLicenseLimit = branchRow?.device_license_limit || 0;
      }

      setProfile({ branchId, branchName, isSuperAdmin, deviceLicenseLimit });
      setAppMode(branchId ? "branch" : "super");

      if (branchId) {
        const { data: brandingRow } = await supabase.from("app_branding").select("name, icon_url").eq("branch_id", branchId).maybeSingle();
        if (brandingRow) setBranding({ name: brandingRow.name || "Northline", iconUrl: brandingRow.icon_url || null });
      }
    } finally {
      setProfileChecked(true);
    }
  }

  const loadedUserIdRef = useRef(null);

  function loadProfileOnce(userId) {
    // Supabase's auth listener can fire more than once for the same login — on
    // routine token refreshes, and again from cross-tab sync when another tab
    // open to this app refreshes its session via localStorage. Each extra fire
    // used to restart loadProfile (which resets profileChecked to false first),
    // and if two calls overlapped the page could get stuck showing the loading
    // screen forever even though the data had already loaded. Only load once
    // per distinct signed-in user id, no matter how many times we're told.
    if (loadedUserIdRef.current === userId) return;
    loadedUserIdRef.current = userId;
    loadProfile(userId);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
      if (data.session) loadProfileOnce(data.session.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === "SIGNED_OUT") {
        loadedUserIdRef.current = null;
      } else if (sess) {
        loadProfileOnce(sess.user.id);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.title = branding.name || "Karachi Electronics";
  }, [branding.name]);

  if (!authChecked) return <div style={{ minHeight: "100vh", background: "#F5F6F8" }} />;

  const brandingValue = { ...branding, reload: () => session && loadProfile(session.user.id) };
  if (!session) return <BrandingContext.Provider value={brandingValue}><LoginScreen /></BrandingContext.Provider>;

  if (!profileChecked) return <div style={{ minHeight: "100vh", background: "#F5F6F8" }} />;

  const branchValue = { ...profile, reload: () => loadProfile(session.user.id) };

  if (appMode === "super") {
    return (
      <BranchContext.Provider value={branchValue}>
        <SuperAdminPortal email={session.user.email} canSwitchToBranch={!!profile.branchId} onSwitchToBranch={() => setAppMode("branch")} />
      </BranchContext.Provider>
    );
  }

  return (
    <BrandingContext.Provider value={brandingValue}>
      <BranchContext.Provider value={branchValue}>
        <div style={S.appShell}>
          <GlobalStyle />
          <TopBar email={session.user.email} onSwitchToSuperAdmin={() => setAppMode("super")} setTab={setTab} />
          <div style={S.appBody}>
            <Sidebar tab={tab} setTab={setTab} />
            <main style={S.main}>
              {tab === "dashboard" && <Dashboard setTab={setTab} setDeviceSettingsTab={setDeviceSettingsTab} />}
              {tab === "devices" && (
                <Devices
                  onSendMessage={(deviceId, msgTab, deviceImei) => {
                    setSendMessageDeviceId(deviceId);
                    setSendMessageTab(msgTab || "popups");
                    setSendMessageImei(deviceImei || "");
                    setTab("sendMessage");
                  }}
                />
              )}
              {tab === "deviceSettings" && <DeviceSettingsPage initialTab={deviceSettingsTab} />}
              {tab === "installation" && <InstallationPage />}
              {tab === "sendMessage" && <SendMessagePage initialDeviceId={sendMessageDeviceId} initialTab={sendMessageTab} initialImei={sendMessageImei} />}
              {tab === "generalSettings" && <GeneralSettingsPage />}
              {tab === "roles" && <RolesList />}
              {tab === "accounts" && <AccountManagement />}
            </main>
          </div>
        </div>
      </BranchContext.Provider>
    </BrandingContext.Provider>
  );
}

function BrandLogo({ size = 28 }) {
  const { name, iconUrl } = useContext(BrandingContext);
  if (iconUrl) {
    return <img src={iconUrl} alt={name} style={{ width: size, height: size, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />;
  }
  return <div style={{ ...S.logoMark, width: size, height: size }}>{(name || "N").charAt(0).toUpperCase()}</div>;
}

function TopBar({ email, onSwitchToSuperAdmin, setTab }) {
  const { name } = useContext(BrandingContext);
  const { isSuperAdmin, branchName } = useContext(BranchContext);
  const [tourOpen, setTourOpen] = useState(false);

  const steps = [
    { target: "[data-tour='brand']", title: "Welcome", text: "This quick tour walks you through your branch admin panel." },
    { target: "[data-tour='help']", title: "Help", text: "Click here anytime if you need help." },
    { target: "[data-tour='account']", title: "Your account", text: "Your signed-in email shows here. Sign out anytime with Log out." },
    ...(isSuperAdmin ? [{ target: "[data-tour='switch-super']", title: "Super Admin", text: "You're also a super admin — switch here to manage every branch and its license limit." }] : []),
    { target: "[data-tour='dashboard-stats']", tab: "dashboard", title: "Dashboard", text: "See your license usage, device activity, and overdue payments at a glance." },
    { target: "[data-tour='nav-device-management']", title: "Device Management", text: "Add, lock/unlock, and manage every device here — or use Device Settings to Enroll, Update Expiration, Remove Restriction, and Unenroll." },
    { target: "[data-tour='nav-custom-management']", title: "Custom Management", text: "Send push notifications and pop-ups to devices, and customize your product name, icon, and lock-screen behavior here." },
    { target: "[data-tour='nav-settings-management']", title: "Settings Management", text: "Manage staff roles and invite your team here." },
  ];

  return (
    <header style={S.topbar}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }} data-tour="brand">
        <BrandLogo />
        <span className="serif" style={{ fontSize: 17, color: "#14161C" }}>{name}</span>
        <span style={{ fontSize: 13, color: "#9AA1AE", marginLeft: 4 }}>{branchName ? `Branch: ${branchName}` : "Hi, welcome back"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button style={S.tourBtn} onClick={() => setTourOpen(true)}>New User Tour</button>
        {isSuperAdmin && (
          <button style={S.secondaryBtn} onClick={onSwitchToSuperAdmin} data-tour="switch-super">
            <ShieldCheck size={14} /> Super Admin
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6B7280", fontSize: 13 }} data-tour="help">
          <HelpCircle size={15} />
          Help
        </div>
        <div style={{ width: 1, height: 20, background: "#E6E8EC" }} />
        <span style={{ fontSize: 13, color: "#6B7280" }} data-tour="account">{email}</span>
        <button style={S.logoutBtn} onClick={() => supabase.auth.signOut()}>
          <LogOut size={14} /> Log out
        </button>
      </div>
      {tourOpen && <TourOverlay steps={steps} onNavigate={setTab} onClose={() => setTourOpen(false)} />}
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
  const { name } = useContext(BrandingContext);
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
          <BrandLogo />
          <span className="serif" style={{ fontSize: 18, color: "#14161C" }}>{name}</span>
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
      group: "Device Management", tourKey: "nav-device-management", icon: Smartphone, items: [
        { id: "devices", label: "Devices", icon: Smartphone },
        { id: "deviceSettings", label: "Device Settings", icon: Settings },
        { id: "installation", label: "Installation", icon: QrCode },
      ],
    },
    {
      group: "Custom Management", tourKey: "nav-custom-management", icon: Sliders, items: [
        { id: "sendMessage", label: "Notifications", icon: Send },
        { id: "generalSettings", label: "General Settings", icon: Settings },
      ],
    },
    {
      group: "Settings Management", tourKey: "nav-settings-management", icon: Settings, items: [
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
                <div style={S.navGroupHeader} onClick={() => setOpenGroup(isOpen ? null : it.group)} data-tour={it.tourKey}>
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

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function QuickOpTile({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10, padding: "18px 8px", borderRadius: 10, border: "1px solid #E6E8EC", background: "#fff",
        cursor: "pointer", fontSize: 11.5, color: "#374151", textAlign: "center", lineHeight: 1.3,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid #E6E8EC", display: "flex", alignItems: "center", justifyContent: "center", color: "#9AA1AE", flexShrink: 0 }}>
        <Icon size={17} />
      </div>
      {label}
    </button>
  );
}

function Dashboard({ setTab, setDeviceSettingsTab }) {
  const { branchId, deviceLicenseLimit } = useContext(BranchContext);
  const [devices, setDevices] = useState([]);
  const [removalLog, setRemovalLog] = useState([]);
  const [overdueList, setOverdueList] = useState([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [licenseWarningValue, setLicenseWarningValue] = useState(null);
  const [rangeFrom, setRangeFrom] = useState(daysAgoISO(29));
  const [rangeTo, setRangeTo] = useState(daysAgoISO(0));

  useEffect(() => {
    load();
    supabase.from("app_branding").select("license_warning_value").eq("branch_id", branchId).maybeSingle()
      .then(({ data }) => setLicenseWarningValue(data?.license_warning_value ?? null));
  }, []);

  async function load() {
    setLoading(true);
    const today = daysAgoISO(0);

    const [{ data: devs }, { data: removals }, { data: overdue }, { count: overdueTotal }] = await Promise.all([
      supabase.from("devices").select("id, provisioned_at, last_seen_at, is_locked"),
      supabase.from("device_removal_log").select("removed_at"),
      supabase
        .from("payments")
        .select("id, due_date, amount, status, installment_plans(device_id, devices(device_model, imei))")
        .neq("status", "Paid")
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(10),
      supabase.from("payments").select("*", { count: "exact", head: true }).neq("status", "Paid").lt("due_date", today),
    ]);

    setDevices(devs || []);
    setRemovalLog(removals || []);
    setOverdueList(overdue || []);
    setOverdueCount(overdueTotal || 0);
    setLoading(false);
  }

  const totalLicenses = deviceLicenseLimit;
  const activatedDevices = devices.filter((d) => d.last_seen_at).length;
  const pendingDevices = devices.length - activatedDevices;
  const remainingLicenses = Math.max(totalLicenses - devices.length, 0);
  const activeDevices = devices.length;
  const removedDevices = removalLog.length;

  const yesterday = daysAgoISO(1);
  function inLastNDays(dateStr, n) {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    return d >= daysAgoISO(n - 1) && d <= daysAgoISO(0);
  }
  const activatedYesterday = devices.filter((d) => d.last_seen_at && (d.provisioned_at || "").slice(0, 10) === yesterday).length;
  const activated7d = devices.filter((d) => d.last_seen_at && inLastNDays(d.provisioned_at, 7)).length;
  const activated30d = devices.filter((d) => d.last_seen_at && inLastNDays(d.provisioned_at, 30)).length;

  const chartData = useMemo(() => {
    const start = new Date(rangeFrom);
    const end = new Date(rangeTo);
    const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    const buckets = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      buckets[d.toISOString().slice(0, 10)] = { enrolled: 0, activated: 0, removed: 0 };
    }
    devices.forEach((d) => {
      const key = (d.provisioned_at || "").slice(0, 10);
      if (buckets[key]) {
        buckets[key].enrolled++;
        if (d.last_seen_at) buckets[key].activated++;
      }
    });
    removalLog.forEach((r) => {
      const key = (r.removed_at || "").slice(0, 10);
      if (buckets[key]) buckets[key].removed++;
    });
    return Object.keys(buckets).sort().map((key) => ({ date: key, ...buckets[key] }));
  }, [devices, removalLog, rangeFrom, rangeTo]);

  function exportChart() {
    const header = ["Date", "Enrolled", "Activated", "Removed"];
    const rows = chartData.map((d) => [d.date, d.enrolled, d.activated, d.removed]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "device-state.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function goToDeviceSettings(settingsTab) {
    setDeviceSettingsTab(settingsTab);
    setTab("deviceSettings");
  }

  const licenseWarning = !loading && licenseWarningValue != null && remainingLicenses <= licenseWarningValue;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <span style={{ fontSize: 12, color: "#9AA1AE" }}>Date based on device local time</span>
      </div>

      {licenseWarning && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, background: "#FDEBEC", border: "1px solid #F4B7BC",
          color: "#B0222D", fontSize: 13, borderRadius: 10, padding: "12px 16px", margin: "-16px 0 20px",
        }}>
          <Bell size={16} />
          Only <strong>{remainingLicenses}</strong> of {totalLicenses} device licenses remaining. Add more licenses soon.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 12 }} data-tour="dashboard-stats">
        <StatCard label="Total licenses" value={totalLicenses} />
        <StatCard label="Remaining licenses" value={remainingLicenses} accent={licenseWarning ? "#D6414C" : undefined} />
        <StatCard label="Activated licenses" value={activatedDevices} />
        <StatCard label="Pending licenses" value={pendingDevices} />
        <StatCard label="Active devices" value={activeDevices} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Removed devices" value={removedDevices} />
        <StatCard label="Activated (yesterday)" value={activatedYesterday} />
        <StatCard label="Activated (last 7d)" value={activated7d} />
        <StatCard label="Activated (last 30d)" value={activated30d} />
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 440px", minWidth: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
            <h3 className="serif" style={{ fontSize: 16, color: "#14161C", margin: 0 }}>Device State</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="date" style={{ ...S.input, width: 140, padding: "6px 10px" }} value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              <span style={{ fontSize: 12, color: "#9AA1AE" }}>to</span>
              <input type="date" style={{ ...S.input, width: 140, padding: "6px 10px" }} value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
              <button style={S.secondaryBtn} onClick={exportChart}>Export</button>
            </div>
          </div>
          <GrowthChart
            data={chartData}
            series={[
              { key: "enrolled", label: "Enrolled", color: "#2F6FED" },
              { key: "activated", label: "Activated", color: "#0E9488" },
              { key: "removed", label: "Removed", color: "#F2A93C" },
            ]}
          />
        </div>

        <div style={{ flex: "1 1 300px", minWidth: 260 }}>
          <h3 className="serif" style={{ fontSize: 16, color: "#14161C", margin: "0 0 12px" }}>Quick Operations</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <QuickOpTile icon={Pencil} label="Enroll Device" onClick={() => goToDeviceSettings("enroll")} />
            <QuickOpTile icon={RefreshCw} label="Update Device Expiration" onClick={() => goToDeviceSettings("expire")} />
            <QuickOpTile icon={Unlock} label="Removal" onClick={() => goToDeviceSettings("restriction")} />
            <QuickOpTile icon={KeyRound} label="PIN Unlock" onClick={() => setTab("devices")} />
            <QuickOpTile icon={Trash2} label="Unenroll Device" onClick={() => goToDeviceSettings("unenroll")} />
            <QuickOpTile icon={Smartphone} label="Device Enrollment Data" onClick={() => setTab("devices")} />
          </div>
        </div>
      </div>

      <h3 className="serif" style={{ fontSize: 16, color: "#14161C", margin: "28px 0 12px" }}>Overdue this period</h3>
      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Device", "IMEI", "Due date", "Amount"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={4} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && overdueList.length === 0 && <tr><td colSpan={4} style={S.emptyCell}>Nothing overdue right now.</td></tr>}
            {overdueList.map((p) => (
              <tr key={p.id} style={S.tr}>
                <td style={S.td}>{p.installment_plans?.devices?.device_model || "—"}</td>
                <td style={S.td} className="mono">{p.installment_plans?.devices?.imei || "—"}</td>
                <td style={S.td} className="mono">{p.due_date}</td>
                <td style={S.td}>{money(p.amount)}</td>
              </tr>
            ))}
            {!loading && overdueCount > overdueList.length && (
              <tr><td colSpan={4} style={{ ...S.emptyCell, fontSize: 12 }}>+ {overdueCount - overdueList.length} more overdue payment(s) not shown — see Devices → Installment plans.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- DEVICES ---------------- */

function Devices({ onSendMessage }) {
  const { branchId, deviceLicenseLimit } = useContext(BranchContext);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDraft, setEditDraft] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sending, setSending] = useState(false);
  const [historyDraft, setHistoryDraft] = useState(null);
  const [codeDialog, setCodeDialog] = useState(null);
  const [appsDraft, setAppsDraft] = useState(null);
  const [audioCall, setAudioCall] = useState(null); // { device, status: 'connecting' | 'ringing' | 'connected' | 'failed', errorMsg }
  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [error, setError] = useState("");

  const [addDeviceOpen, setAddDeviceOpen] = useState(false);
  const [addDeviceDraft, setAddDeviceDraft] = useState({ device_model: "", imei: "", device_tag: "" });

  const [plansDraft, setPlansDraft] = useState(null); // { device, plans, loading }
  const [planAddOpen, setPlanAddOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState({ total_amount: "", monthly_amount: "", number_of_months: "", start_date: "", due_day: 30 });
  const [planEditDraft, setPlanEditDraft] = useState(null);
  const [confirmDeletePlan, setConfirmDeletePlan] = useState(null);
  const [planError, setPlanError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [imeiFilter, setImeiFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [enrollFrom, setEnrollFrom] = useState("");
  const [enrollTo, setEnrollTo] = useState("");

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
      .select("*, device_commands(command, issued_at, acknowledged_at)")
      .order("provisioned_at", { ascending: false });
    setDevices(data || []);
    setLoading(false);
  }

  async function addDevice() {
    if (!(addDeviceDraft.device_model || "").trim()) { setError("Enter a device model."); return; }
    if (devices.length >= deviceLicenseLimit) { setError(`Branch license limit reached (${deviceLicenseLimit}). Ask the super admin to raise it.`); return; }
    setError("");
    const unlock_pin = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from("devices").insert({
      device_model: addDeviceDraft.device_model.trim(),
      imei: (addDeviceDraft.imei || "").trim() || null,
      device_tag: (addDeviceDraft.device_tag || "").trim() || null,
      unlock_pin,
      unlock_pin_generated_at: new Date().toISOString(),
      branch_id: branchId,
    });
    setAddDeviceDraft({ device_model: "", imei: "", device_tag: "" });
    setAddDeviceOpen(false);
    load();
  }

  async function openPlans(device) {
    setPlansDraft({ device, plans: [], loading: true });
    const { data } = await supabase
      .from("installment_plans")
      .select("*")
      .eq("device_id", device.id)
      .order("start_date", { ascending: false });
    setPlansDraft({ device, plans: data || [], loading: false });
  }

  async function reloadPlans() {
    if (!plansDraft) return;
    const { data } = await supabase
      .from("installment_plans")
      .select("*")
      .eq("device_id", plansDraft.device.id)
      .order("start_date", { ascending: false });
    setPlansDraft((prev) => (prev ? { ...prev, plans: data || [] } : prev));
  }

  async function addPlan() {
    const total = Number(planDraft.total_amount);
    const monthly = Number(planDraft.monthly_amount);
    const months = Number(planDraft.number_of_months);
    if (!total || !monthly || !months || !planDraft.start_date) { setPlanError("Fill in all plan fields."); return; }
    setPlanError("");

    const { data: plan, error: planErr } = await supabase
      .from("installment_plans")
      .insert({
        device_id: plansDraft.device.id,
        total_amount: total,
        monthly_amount: monthly,
        number_of_months: months,
        start_date: planDraft.start_date,
        due_day: Number(planDraft.due_day) || 30,
      })
      .select()
      .single();

    if (planErr) { setPlanError(planErr.message); return; }

    const rows = [];
    const start = new Date(planDraft.start_date);
    for (let i = 0; i < months; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      rows.push({ plan_id: plan.id, due_date: d.toISOString().slice(0, 10), amount: monthly, status: "Pending" });
    }
    await supabase.from("payments").insert(rows);

    setPlanDraft({ total_amount: "", monthly_amount: "", number_of_months: "", start_date: "", due_day: 30 });
    setPlanAddOpen(false);
    reloadPlans();
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
    setPlanError("");
  }

  async function saveEditPlan() {
    const total = Number(planEditDraft.total_amount);
    const monthly = Number(planEditDraft.monthly_amount);
    const months = Number(planEditDraft.number_of_months);
    if (!total || !monthly || !months || !planEditDraft.start_date) { setPlanError("Fill in all plan fields."); return; }
    await supabase.from("installment_plans").update({
      total_amount: total,
      monthly_amount: monthly,
      number_of_months: months,
      start_date: planEditDraft.start_date,
      due_day: Number(planEditDraft.due_day) || 30,
      status: planEditDraft.status,
    }).eq("id", planEditDraft.id);
    setPlanEditDraft(null);
    reloadPlans();
  }

  async function performDeletePlan(id) {
    await supabase.from("installment_plans").delete().eq("id", id);
    setConfirmDeletePlan(null);
    reloadPlans();
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

  function openEdit(d) { setEditDraft({ id: d.id, device_model: d.device_model || "", imei: d.imei || "", device_tag: d.device_tag || "" }); setError(""); }

  async function saveEdit() {
    if (!editDraft.device_model.trim()) { setError("Enter a device model."); return; }
    await supabase.from("devices").update({
      device_model: editDraft.device_model.trim(),
      imei: editDraft.imei.trim() || null,
      device_tag: editDraft.device_tag.trim() || null,
    }).eq("id", editDraft.id);
    setEditDraft(null);
    load();
  }

  async function performDelete(device) {
    await supabase.from("devices").delete().eq("id", device.id);
    await supabase.from("device_removal_log").insert({ device_model: device.device_model || null, imei: device.imei || null, branch_id: branchId });
    setConfirmDelete(null);
    load();
  }

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (statusFilter === "locked" && !d.is_locked) return false;
      if (statusFilter === "active" && d.is_locked) return false;
      if (statusFilter === "noSim" && !d.sim_missing) return false;
      if (imeiFilter.trim() && !(d.imei || "").toLowerCase().includes(imeiFilter.trim().toLowerCase())) return false;
      if (modelFilter.trim() && !(d.device_model || "").toLowerCase().includes(modelFilter.trim().toLowerCase())) return false;
      if (tagFilter.trim() && !(d.device_tag || "").toLowerCase().includes(tagFilter.trim().toLowerCase())) return false;
      if (enrollFrom && (d.provisioned_at || "").slice(0, 10) < enrollFrom) return false;
      if (enrollTo && (d.provisioned_at || "").slice(0, 10) > enrollTo) return false;
      return true;
    });
  }, [devices, statusFilter, imeiFilter, modelFilter, tagFilter, enrollFrom, enrollTo]);

  const licenseStats = useMemo(() => {
    const activated = devices.filter((d) => d.last_seen_at).length;
    return {
      total: deviceLicenseLimit,
      activated,
      pending: devices.length - activated,
      remaining: Math.max(deviceLicenseLimit - devices.length, 0),
    };
  }, [devices, deviceLicenseLimit]);

  function resetFilters() {
    setStatusFilter("all");
    setImeiFilter("");
    setModelFilter("");
    setTagFilter("");
    setEnrollFrom("");
    setEnrollTo("");
  }

  function exportCsv() {
    const header = ["Device model", "Device tag", "IMEI", "Status", "Enrolled", "Last seen"];
    const rows = filteredDevices.map((d) => [
      d.device_model || "",
      d.device_tag || "",
      d.imei || "",
      d.is_locked ? "Locked" : "Active",
      d.provisioned_at || "",
      d.last_seen_at || "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "devices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader eyebrow="Fleet" title="Devices" count={devices.length}>
        <button style={S.primaryBtn} onClick={() => { setAddDeviceDraft({ device_model: "", imei: "", device_tag: "" }); setError(""); setAddDeviceOpen(true); }}>
          <Plus size={16} /> Add device
        </button>
      </PageHeader>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", margin: "-8px 0 20px", fontSize: 13, color: "#374151" }}>
        <span>Total licenses: <strong>{licenseStats.total}</strong></span>
        <span>Activated: <strong>{licenseStats.activated}</strong></span>
        <span>Pending: <strong>{licenseStats.pending}</strong></span>
        <span>Remaining: <strong>{licenseStats.remaining}</strong></span>
      </div>

      <div style={{ ...S.tableCard, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <select style={{ ...S.select, minWidth: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="locked">Locked</option>
            <option value="active">Active</option>
            <option value="noSim">No SIM</option>
          </select>
          <input style={{ ...S.input, width: 200 }} value={imeiFilter} onChange={(e) => setImeiFilter(e.target.value)} placeholder="IMEI" />
          <input style={{ ...S.input, width: 200 }} value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} placeholder="Device model" />
          <input style={{ ...S.input, width: 200 }} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="Device tag" />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: "#6B7280" }}>Enrolled</span>
          <input style={{ ...S.input, width: 160 }} type="date" value={enrollFrom} onChange={(e) => setEnrollFrom(e.target.value)} />
          <span style={{ fontSize: 12.5, color: "#6B7280" }}>to</span>
          <input style={{ ...S.input, width: 160 }} type="date" value={enrollTo} onChange={(e) => setEnrollTo(e.target.value)} />
          <button style={S.secondaryBtn} onClick={resetFilters}>Reset</button>
          <button style={{ ...S.secondaryBtn, marginLeft: "auto" }} onClick={exportCsv}>Export</button>
        </div>
      </div>

      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Device", "Tag", "IMEI", "Status", "Last seen"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && devices.length === 0 && <tr><td colSpan={5} style={S.emptyCell}>No devices yet.</td></tr>}
            {!loading && devices.length > 0 && filteredDevices.length === 0 && <tr><td colSpan={5} style={S.emptyCell}>No devices match these filters.</td></tr>}
            {filteredDevices.map((d) => {
              const lastCmd = d.device_commands?.sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at))[0];
              const pendingAck = lastCmd && !lastCmd.acknowledged_at;
              const actionBtn = { ...S.secondaryBtn, padding: "6px 12px", fontSize: 12.5 };
              return (
                <React.Fragment key={d.id}>
                  <tr style={{ borderBottom: "none" }}>
                    <td style={S.td}>{d.device_model || d.imei || "—"}</td>
                    <td style={S.td}>{d.device_tag || "—"}</td>
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
                  </tr>
                  <tr style={S.tr}>
                    <td colSpan={5} style={{ ...S.td, background: "#FAFBFC", padding: "10px 16px 14px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {d.is_locked ? (
                          <button style={actionBtn} onClick={() => sendCommand(d, "UNLOCK")}>Unlock</button>
                        ) : (
                          <button style={{ ...S.dangerBtn, padding: "6px 12px", fontSize: 12.5 }} onClick={() => sendCommand(d, "LOCK")}>Lock</button>
                        )}
                        <button style={actionBtn} onClick={() => onSendMessage(d.id)}>Notifications</button>
                        <button style={actionBtn} onClick={() => onSendMessage(d.id, "call", d.imei)}>Push Call</button>
                        <button style={actionBtn} onClick={() => startAudioCall(d)}>Audio Call</button>
                        <button style={actionBtn} onClick={() => showCode(d)}>Unlock Code</button>
                        <button style={actionBtn} onClick={() => resetUnlockCode(d)}>Reset Code</button>
                        <button style={actionBtn} onClick={() => openHistory(d)}>Activity</button>
                        <button style={actionBtn} onClick={() => openApps(d)}>Allowed Apps</button>
                        <button style={actionBtn} onClick={() => openEdit(d)}>Edit</button>
                        <button style={{ ...S.dangerBtn, padding: "6px 12px", fontSize: 12.5 }} onClick={() => setConfirmDelete(d)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {audioCall && (
        <div style={S.overlay}>
          <div style={S.confirmCard}>
            <h3 className="serif" style={{ fontSize: 18, color: "#14161C", margin: "0 0 4px" }}>
              Audio call · {(audioCall.device.device_model || audioCall.device.imei)}
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
        <Drawer title={`Activity · ${(historyDraft.device.device_model || historyDraft.device.imei)}`} onClose={() => setHistoryDraft(null)}>
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
        <Drawer title={`Allowed apps · ${(appsDraft.device.device_model || appsDraft.device.imei)}`} onClose={() => setAppsDraft(null)}>
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
          <Field label="Device tag (optional)"><input style={S.input} value={editDraft.device_tag} onChange={(e) => setEditDraft({ ...editDraft, device_tag: e.target.value })} /></Field>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={S.primaryBtn} onClick={saveEdit}>Save changes</button>
            <button style={S.secondaryBtn} onClick={() => setEditDraft(null)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove device"
          message={`${confirmDelete.device_model || confirmDelete.imei || "This device"} and its installment plans/payment history will be removed. This can't be undone.`}
          onConfirm={() => performDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {addDeviceOpen && (
        <Drawer title="Add device" onClose={() => setAddDeviceOpen(false)}>
          <Field label="Device model"><input style={S.input} value={addDeviceDraft.device_model} onChange={(e) => setAddDeviceDraft({ ...addDeviceDraft, device_model: e.target.value })} placeholder="Samsung Galaxy A15" /></Field>
          <Field label="IMEI (optional)"><input style={S.input} value={addDeviceDraft.imei} onChange={(e) => setAddDeviceDraft({ ...addDeviceDraft, imei: e.target.value })} placeholder="356789104561234" /></Field>
          <Field label="Device tag (optional)"><input style={S.input} value={addDeviceDraft.device_tag} onChange={(e) => setAddDeviceDraft({ ...addDeviceDraft, device_tag: e.target.value })} placeholder="e.g. a short custom label for this device" /></Field>
          {error && <p style={{ fontSize: 12, color: "#D6414C" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={S.primaryBtn} onClick={addDevice}>Add device</button>
            <button style={S.secondaryBtn} onClick={() => setAddDeviceOpen(false)}>Cancel</button>
          </div>
        </Drawer>
      )}

      {plansDraft && (
        <Drawer title={`Installment plans · ${(plansDraft.device.device_model || plansDraft.device.imei)}`} onClose={() => setPlansDraft(null)}>
          {plansDraft.loading && <p style={{ color: "#9AA1AE", fontSize: 13 }}>Loading…</p>}
          {!plansDraft.loading && plansDraft.plans.length === 0 && !planAddOpen && (
            <p style={{ color: "#9AA1AE", fontSize: 13, marginBottom: 16 }}>No installment plans yet.</p>
          )}
          {!plansDraft.loading && plansDraft.plans.map((p) => (
            <div key={p.id} style={{ ...S.statCard, marginBottom: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <p style={{ fontSize: 12.5, color: "#374151", margin: 0, lineHeight: 1.6 }}>
                  {money(p.total_amount)} total, {money(p.monthly_amount)}/mo for {p.number_of_months} months, due day {p.due_day} — <span style={{ color: "#14161C", fontWeight: 500 }}>{p.status}</span>
                </p>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button style={S.iconBtn} onClick={() => openEditPlan(p)} aria-label="Edit plan"><Pencil size={13} /></button>
                  <button style={S.iconBtn} onClick={() => setConfirmDeletePlan(p)} aria-label="Delete plan"><Trash2 size={13} color="#D6414C" /></button>
                </div>
              </div>
            </div>
          ))}

          {!planAddOpen ? (
            <button style={{ ...S.secondaryBtn, marginTop: 4 }} onClick={() => { setPlanDraft({ total_amount: "", monthly_amount: "", number_of_months: "", start_date: "", due_day: 30 }); setPlanError(""); setPlanAddOpen(true); }}>
              <Plus size={14} /> Add installment plan
            </button>
          ) : (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #EEF0F3" }}>
              <Field label="Total amount"><input style={S.input} type="number" value={planDraft.total_amount} onChange={(e) => setPlanDraft({ ...planDraft, total_amount: e.target.value })} placeholder="60000" /></Field>
              <Field label="Monthly amount"><input style={S.input} type="number" value={planDraft.monthly_amount} onChange={(e) => setPlanDraft({ ...planDraft, monthly_amount: e.target.value })} placeholder="5000" /></Field>
              <Field label="Number of months"><input style={S.input} type="number" value={planDraft.number_of_months} onChange={(e) => setPlanDraft({ ...planDraft, number_of_months: e.target.value })} placeholder="12" /></Field>
              <Field label="Start date"><input style={S.input} type="date" value={planDraft.start_date} onChange={(e) => setPlanDraft({ ...planDraft, start_date: e.target.value })} /></Field>
              <Field label="Due day of month"><input style={S.input} type="number" min="1" max="31" value={planDraft.due_day} onChange={(e) => setPlanDraft({ ...planDraft, due_day: e.target.value })} /></Field>
              {planError && <p style={{ fontSize: 12, color: "#D6414C" }}>{planError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button style={S.primaryBtn} onClick={addPlan}>Create plan</button>
                <button style={S.secondaryBtn} onClick={() => setPlanAddOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
        </Drawer>
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
          {planError && <p style={{ fontSize: 12, color: "#D6414C" }}>{planError}</p>}
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

/* ---------------- DEVICE SETTINGS (UI only, wiring later) ---------------- */

function UploadXlsBox() {
  return (
    <Field label="Upload xls">
      <div style={{
        width: 140, height: 100, border: "1px dashed #D5D9E0", borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center", color: "#9AA1AE", cursor: "pointer",
      }}>
        <Plus size={20} />
      </div>
      <p style={{ fontSize: 11, color: "#9AA1AE", margin: "8px 0 0" }}>Tips: Only .xls files can be uploaded.</p>
    </Field>
  );
}

function DeviceSettingsPage({ initialTab }) {
  const { branchId, deviceLicenseLimit } = useContext(BranchContext);
  const [activeTab, setActiveTab] = useState(initialTab || "enroll");
  const [unitType, setUnitType] = useState("single");
  const [imei, setImei] = useState("");
  const [deviceTag, setDeviceTag] = useState("");
  const [expiration, setExpiration] = useState("");
  const [lockOnActivation, setLockOnActivation] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState("");

  const tabs = [
    { id: "enroll", label: "Enroll Device" },
    { id: "expire", label: "Update Device Expiration" },
    { id: "restriction", label: "Remove Phone Restriction" },
    { id: "unenroll", label: "Unenroll Device" },
  ];

  const [expireBusy, setExpireBusy] = useState(false);
  const [expireMsg, setExpireMsg] = useState("");
  const [unenrollBusy, setUnenrollBusy] = useState(false);
  const [unenrollMsg, setUnenrollMsg] = useState("");
  const [unenrollConfirm, setUnenrollConfirm] = useState(null);
  const [restrictionBusy, setRestrictionBusy] = useState(false);
  const [restrictionMsg, setRestrictionMsg] = useState("");

  function switchTab(id) {
    setActiveTab(id);
    setUnitType("single");
    setImei("");
    setDeviceTag("");
    setExpiration("");
    setLockOnActivation(true);
    setEnrollMsg("");
    setExpireMsg("");
    setUnenrollMsg("");
    setUnenrollConfirm(null);
    setRestrictionMsg("");
  }

  async function enrollDevice() {
    const trimmed = imei.trim();
    if (!trimmed) { setEnrollMsg("Enter an IMEI."); return; }
    setEnrolling(true);
    setEnrollMsg("");
    const { count } = await supabase.from("devices").select("*", { count: "exact", head: true });
    if ((count || 0) >= deviceLicenseLimit) {
      setEnrolling(false);
      setEnrollMsg(`Branch license limit reached (${deviceLicenseLimit}). Ask the super admin to raise it.`);
      return;
    }
    const unlock_pin = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabase.from("devices").insert({
      imei: trimmed,
      is_locked: lockOnActivation,
      unlock_pin,
      unlock_pin_generated_at: new Date().toISOString(),
      branch_id: branchId,
    });
    setEnrolling(false);
    if (error) setEnrollMsg(error.message);
    else {
      setEnrollMsg("Device enrolled.");
      setImei("");
    }
  }

  async function searchExpiration() {
    const trimmed = deviceTag.trim();
    if (!trimmed) { setExpireMsg("Enter a device tag or IMEI."); return; }
    setExpireBusy(true);
    setExpireMsg("");
    const { data, error } = await supabase.from("devices").select("id, expires_at").or(`device_tag.eq.${trimmed},imei.eq.${trimmed}`).maybeSingle();
    setExpireBusy(false);
    if (error) { setExpireMsg(error.message); return; }
    if (!data) { setExpireMsg("No device found with that device tag or IMEI."); return; }
    setExpiration(data.expires_at || "");
    setExpireMsg(data.expires_at ? `Current expiration: ${data.expires_at}` : "No expiration set yet for this device.");
  }

  async function submitExpiration() {
    const trimmed = deviceTag.trim();
    if (!trimmed) { setExpireMsg("Enter a device tag or IMEI."); return; }
    if (!expiration) { setExpireMsg("Choose an expiration date."); return; }
    setExpireBusy(true);
    setExpireMsg("");
    const { data, error } = await supabase.from("devices").update({ expires_at: expiration }).or(`device_tag.eq.${trimmed},imei.eq.${trimmed}`).select("id");
    setExpireBusy(false);
    if (error) { setExpireMsg(error.message); return; }
    if (!data || data.length === 0) { setExpireMsg("No device found with that device tag or IMEI."); return; }
    setExpireMsg("Expiration updated.");
  }

  async function findForUnenroll() {
    const trimmed = imei.trim();
    if (!trimmed) { setUnenrollMsg("Enter an IMEI."); return; }
    setUnenrollBusy(true);
    setUnenrollMsg("");
    const { data, error } = await supabase.from("devices").select("id, device_model, imei").eq("imei", trimmed).maybeSingle();
    setUnenrollBusy(false);
    if (error) { setUnenrollMsg(error.message); return; }
    if (!data) { setUnenrollMsg("No device found with that IMEI."); return; }
    setUnenrollConfirm(data);
  }

  async function performUnenroll() {
    await supabase.from("devices").delete().eq("id", unenrollConfirm.id);
    await supabase.from("device_removal_log").insert({ device_model: unenrollConfirm.device_model || null, imei: unenrollConfirm.imei || null, branch_id: branchId });
    setUnenrollConfirm(null);
    setImei("");
    setUnenrollMsg("Device unenrolled — fully removed from the app.");
  }

  async function searchRestriction() {
    const trimmed = deviceTag.trim();
    if (!trimmed) { setRestrictionMsg("Enter a device tag or IMEI."); return; }
    setRestrictionBusy(true);
    setRestrictionMsg("");
    const { data, error } = await supabase.from("devices").select("id, is_locked").or(`device_tag.eq.${trimmed},imei.eq.${trimmed}`).maybeSingle();
    setRestrictionBusy(false);
    if (error) { setRestrictionMsg(error.message); return; }
    if (!data) { setRestrictionMsg("No device found with that device tag or IMEI."); return; }
    setRestrictionMsg(data.is_locked ? "Currently locked." : "Already unlocked.");
  }

  async function submitRestriction() {
    const trimmed = deviceTag.trim();
    if (!trimmed) { setRestrictionMsg("Enter a device tag or IMEI."); return; }
    setRestrictionBusy(true);
    setRestrictionMsg("");
    const { data: device, error: findErr } = await supabase.from("devices").select("id").or(`device_tag.eq.${trimmed},imei.eq.${trimmed}`).maybeSingle();
    if (findErr) { setRestrictionBusy(false); setRestrictionMsg(findErr.message); return; }
    if (!device) { setRestrictionBusy(false); setRestrictionMsg("No device found with that device tag or IMEI."); return; }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("device_commands").insert({ device_id: device.id, command: "UNLOCK", issued_by: user?.email || "admin" });
    await supabase.from("devices").update({ is_locked: false }).eq("id", device.id);
    await supabase.from("device_events").insert({ device_id: device.id, event_type: "UNLOCK", method: "ADMIN" });
    supabase.functions.invoke("notify-devices", { body: { device_ids: [device.id] } }).catch(() => {});

    setRestrictionBusy(false);
    setRestrictionMsg("Unlock command sent.");
    setDeviceTag("");
  }

  const ChooseType = (
    <Field label="Choose Type">
      <div style={{ display: "flex", gap: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}>
          <input type="radio" checked={unitType === "single"} onChange={() => setUnitType("single")} /> Single unit
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}>
          <input type="radio" checked={unitType === "bulk"} onChange={() => setUnitType("bulk")} /> Bulk units
        </label>
      </div>
    </Field>
  );

  const BulkUpload = (
    <>
      <p style={{ fontSize: 12.5, color: "#6B7280", margin: "-6px 0 18px" }}>
        Upload a xls file (<span style={{ color: "#B7791F", cursor: "pointer" }}>Template download</span>)
      </p>
      {activeTab === "enroll" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 360, marginBottom: 18 }}>
          <span style={{ fontSize: 13, color: "#374151" }}>Lock immediately after activation</span>
          <ToggleSwitch checked={lockOnActivation} onChange={setLockOnActivation} />
        </div>
      )}
      <UploadXlsBox />
    </>
  );

  return (
    <div>
      <PageHeader eyebrow="Device Management" title="Device Settings" />
      <p style={{ fontSize: 13, color: "#6B7280", margin: "-20px 0 24px", maxWidth: 560 }}>
        All four tabs are live for single units — Remove Phone Restriction sends an unlock command, Unenroll fully removes the device from the app. Bulk units are still layout only.
      </p>

      <div style={{ ...S.tableCard, padding: 0, maxWidth: 640 }}>
        <div style={{ display: "flex", borderBottom: "1px solid #E6E8EC", flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                flex: "1 1 auto", padding: "12px 10px", fontSize: 12.5, fontWeight: 600, background: "transparent",
                border: "none", borderBottom: activeTab === t.id ? "2px solid #F2A93C" : "2px solid transparent",
                color: activeTab === t.id ? "#14161C" : "#9AA1AE", whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {activeTab === "enroll" && (
            <>
              <Field label="IMEI"><input style={S.input} value={imei} onChange={(e) => setImei(e.target.value)} placeholder="Please enter IMEI (eg: 000111222333444)" /></Field>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 360, margin: "6px 0 4px" }}>
                <span style={{ fontSize: 13, color: "#374151" }}>Lock immediately after activation</span>
                <ToggleSwitch checked={lockOnActivation} onChange={setLockOnActivation} />
              </div>
            </>
          )}

          {activeTab === "restriction" && (
            <Field label="Device Tag"><input style={S.input} value={deviceTag} onChange={(e) => setDeviceTag(e.target.value)} placeholder="Please enter device tag or enrolled IMEI" /></Field>
          )}

          {(activeTab === "expire" || activeTab === "unenroll") && (
            <>
              {ChooseType}

              {unitType === "bulk" ? (
                BulkUpload
              ) : (
                <>
                  {activeTab === "expire" && (
                    <>
                      <Field label="Device Tag"><input style={S.input} value={deviceTag} onChange={(e) => setDeviceTag(e.target.value)} placeholder="Please enter device tag or enrolled IMEI" /></Field>
                      <Field label="Expiration"><input style={S.input} type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} /></Field>
                    </>
                  )}
                  {activeTab === "unenroll" && (
                    <Field label="IMEI"><input style={S.input} value={imei} onChange={(e) => setImei(e.target.value)} placeholder="Please enter enrolled IMEI (eg: 000111222333444)" /></Field>
                  )}
                </>
              )}
            </>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            {activeTab === "enroll" && (
              <button style={{ ...S.primaryBtn, opacity: enrolling ? 0.7 : 1 }} onClick={enrollDevice} disabled={enrolling}>
                {enrolling ? "Submitting…" : "Submit"}
              </button>
            )}

            {activeTab === "expire" && unitType === "single" && (
              <>
                <button style={{ ...S.primaryBtn, opacity: expireBusy ? 0.7 : 1 }} onClick={submitExpiration} disabled={expireBusy}>
                  {expireBusy ? "Submitting…" : "Submit"}
                </button>
                <button style={S.secondaryBtn} onClick={searchExpiration} disabled={expireBusy}>Search</button>
              </>
            )}
            {activeTab === "expire" && unitType === "bulk" && <button style={S.primaryBtn}>Submit</button>}

            {activeTab === "restriction" && (
              <>
                <button style={{ ...S.primaryBtn, opacity: restrictionBusy ? 0.7 : 1 }} onClick={submitRestriction} disabled={restrictionBusy}>
                  {restrictionBusy ? "Submitting…" : "Submit"}
                </button>
                <button style={S.secondaryBtn} onClick={searchRestriction} disabled={restrictionBusy}>Search</button>
              </>
            )}

            {activeTab === "unenroll" && unitType === "single" && (
              <button style={{ ...S.primaryBtn, opacity: unenrollBusy ? 0.7 : 1 }} onClick={findForUnenroll} disabled={unenrollBusy}>
                {unenrollBusy ? "Checking…" : "Submit"}
              </button>
            )}
            {activeTab === "unenroll" && unitType === "bulk" && <button style={S.primaryBtn}>Submit</button>}
          </div>

          {activeTab === "enroll" && enrollMsg && (
            <p style={{ fontSize: 12, color: enrollMsg === "Device enrolled." ? "#1E8E5A" : "#D6414C", margin: "10px 0 0" }}>{enrollMsg}</p>
          )}
          {activeTab === "expire" && expireMsg && (
            <p style={{ fontSize: 12, color: expireMsg === "Expiration updated." ? "#1E8E5A" : "#D6414C", margin: "10px 0 0" }}>{expireMsg}</p>
          )}
          {activeTab === "unenroll" && unenrollMsg && (
            <p style={{ fontSize: 12, color: unenrollMsg.startsWith("Device unenrolled") ? "#1E8E5A" : "#D6414C", margin: "10px 0 0" }}>{unenrollMsg}</p>
          )}
          {activeTab === "restriction" && restrictionMsg && (
            <p style={{ fontSize: 12, color: restrictionMsg === "Unlock command sent." ? "#1E8E5A" : "#6B7280", margin: "10px 0 0" }}>{restrictionMsg}</p>
          )}
        </div>
      </div>

      {unenrollConfirm && (
        <ConfirmDialog
          title="Unenroll device"
          message={`${unenrollConfirm.device_model || unenrollConfirm.imei} will be completely removed from the app — device, installment plans and payment history. This can't be undone.`}
          onConfirm={performUnenroll}
          onCancel={() => setUnenrollConfirm(null)}
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
      .select("*, installment_plans(devices(device_model, imei))")
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
          <thead><tr>{["Device", "IMEI", "Due date", "Amount", "Status", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} style={S.emptyCell}>No payments match this filter.</td></tr>}
            {filtered.map((p) => {
              const effectiveStatus = p.status === "Pending" && p.due_date < today ? "Missed" : p.status;
              const color = effectiveStatus === "Paid" ? "#0E9488" : effectiveStatus === "Missed" ? "#D6414C" : "#F2A93C";
              return (
                <tr key={p.id} style={S.tr}>
                  <td style={S.td}>{p.installment_plans?.devices?.device_model || "—"}</td>
                  <td style={S.td} className="mono">{p.installment_plans?.devices?.imei || "—"}</td>
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

/* ---------------- INSTALLATION (QR provisioning) ---------------- */

function InstallationPage() {
  const { branchId } = useContext(BranchContext);
  const [apkUrl, setApkUrl] = useState("");
  const [packageName, setPackageName] = useState("");
  const [adminReceiver, setAdminReceiver] = useState("");
  const [checksum, setChecksum] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!branchId) return;
    supabase
      .from("app_provisioning")
      .select("*")
      .eq("branch_id", branchId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setApkUrl(data.apk_url || "");
          setPackageName(data.package_name || "");
          setAdminReceiver(data.admin_receiver || "");
          setChecksum(data.signature_checksum || "");
          setWifiSsid(data.wifi_ssid || "");
          setWifiPassword(data.wifi_password || "");
        }
        setLoading(false);
      });
  }, [branchId]);

  useEffect(() => {
    if (!packageName.trim() || !adminReceiver.trim() || !checksum.trim() || !apkUrl.trim()) { setQrDataUrl(""); return; }
    const payload = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": `${packageName.trim()}/${adminReceiver.trim()}`,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": checksum.trim(),
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": apkUrl.trim(),
      "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": true,
      "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
    };
    if (wifiSsid.trim()) {
      payload["android.app.extra.PROVISIONING_WIFI_SSID"] = wifiSsid.trim();
      payload["android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE"] = wifiPassword ? "WPA" : "NONE";
      if (wifiPassword) payload["android.app.extra.PROVISIONING_WIFI_PASSWORD"] = wifiPassword;
    }
    let cancelled = false;
    QRCode.toDataURL(JSON.stringify(payload), { width: 280, margin: 1 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(""); });
    return () => { cancelled = true; };
  }, [packageName, adminReceiver, checksum, apkUrl, wifiSsid, wifiPassword]);

  async function save() {
    setSaving(true);
    setSaveMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("app_provisioning").upsert({
      branch_id: branchId,
      apk_url: apkUrl.trim(),
      package_name: packageName.trim(),
      admin_receiver: adminReceiver.trim(),
      signature_checksum: checksum.trim(),
      wifi_ssid: wifiSsid.trim() || null,
      wifi_password: wifiPassword || null,
      updated_at: new Date().toISOString(),
      updated_by: user?.email || "admin",
    }, { onConflict: "branch_id" });
    setSaving(false);
    setSaveMsg(error ? error.message : "Saved.");
  }

  const steps = [
    { title: "Reset or unbox the phone", text: "Factory reset it (Settings → System → Reset options → Erase all data) or use a brand-new phone that hasn't been set up yet." },
    { title: "Open the QR scanner", text: "On the first \"Welcome\" screen — before choosing Wi-Fi or signing in — tap anywhere on the screen 6 times in a row. This opens the camera for QR code setup." },
    { title: "Connect to Wi-Fi if asked", text: "If it asks for Wi-Fi first, connect to the shop's network — or just scan the QR code below, since it carries the Wi-Fi details too (if you filled them in on the left)." },
    { title: "Scan this QR code", text: "Point the phone's camera at the QR code on this page and scan it." },
    { title: "Let it set up automatically", text: "The phone downloads \"KE Setup\" (the bootstrap app), installs it as device owner, then it downloads and installs the main Lock app in the background. Don't interrupt this — it can take a minute or two." },
    { title: "Enroll it in this panel", text: "Before handing the phone over, go to Device Management → Device Settings → Enroll Device and add this phone's IMEI, model and tag so it shows up in the Devices list." },
  ];

  return (
    <div>
      <PageHeader eyebrow="Device Management" title="Installation" />
      <p style={{ fontSize: 13, color: "#6B7280", margin: "-20px 0 24px", maxWidth: 620 }}>
        Scan this QR code on a factory-reset phone to automatically install the lock app and set it as device owner — the same bootstrap APK flow used for every new device.
      </p>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ ...S.tableCard, padding: 24, flex: "1 1 420px", minWidth: 320 }}>
          <h3 className="serif" style={{ fontSize: 17, color: "#14161C", margin: "0 0 6px" }}>Shop Wi-Fi (optional)</h3>
          <p style={{ fontSize: 12.5, color: "#6B7280", margin: "0 0 16px", lineHeight: 1.6 }}>
            If filled in, the phone connects to this network automatically during setup — no need to type it on the phone.
          </p>
          <Field label="Wi-Fi network name (SSID)">
            <input style={S.input} value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="e.g. KarachiElectronics-Shop" />
          </Field>
          <Field label="Wi-Fi password">
            <input style={S.input} value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="Leave blank for an open network" />
          </Field>

          <button type="button" onClick={() => setShowAdvanced((v) => !v)} style={{ background: "none", border: "none", color: "#F2A93C", fontSize: 12.5, fontWeight: 600, padding: 0, margin: "4px 0 16px", cursor: "pointer" }}>
            {showAdvanced ? "Hide advanced settings" : "Show advanced settings"}
          </button>

          {showAdvanced && (
            <>
              <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: "-8px 0 14px" }}>
                These come from the current bootstrap app build. Only change them if the Android app team gives you new values after a new build.
              </p>
              <Field label="APK download URL">
                <input style={S.input} className="mono" value={apkUrl} onChange={(e) => setApkUrl(e.target.value)} />
              </Field>
              <Field label="Package name">
                <input style={S.input} className="mono" value={packageName} onChange={(e) => setPackageName(e.target.value)} />
              </Field>
              <Field label="Device admin receiver">
                <input style={S.input} className="mono" value={adminReceiver} onChange={(e) => setAdminReceiver(e.target.value)} />
              </Field>
              <Field label="Signing certificate checksum">
                <input style={S.input} className="mono" value={checksum} onChange={(e) => setChecksum(e.target.value)} />
              </Field>
            </>
          )}

          <button style={{ ...S.primaryBtn, marginTop: 8, opacity: saving ? 0.7 : 1 }} onClick={save} disabled={saving || loading}>
            {saving ? "Saving…" : "Save"}
          </button>
          {saveMsg && <p style={{ fontSize: 12.5, color: saveMsg === "Saved." ? "#0E9488" : "#D6414C", margin: "10px 0 0" }}>{saveMsg}</p>}
        </div>

        <div style={{ flex: "0 0 260px", textAlign: "center" }}>
          <div style={{ ...S.tableCard, padding: 20 }}>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Device provisioning QR code" style={{ width: "100%", height: "auto", borderRadius: 8 }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", color: "#9AA1AE", fontSize: 12.5, textAlign: "center", padding: 16 }}>
                {loading ? "Loading…" : "Fill in the fields to generate the QR code."}
              </div>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: "10px 0 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Wifi size={12} /> Scan during first-time setup only.
          </p>
        </div>
      </div>

      <div style={{ ...S.tableCard, padding: 24, marginTop: 24 }}>
        <h3 className="serif" style={{ fontSize: 17, color: "#14161C", margin: "0 0 16px" }}>Step-by-step: setting up a new phone</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: "0 0 28px", height: 28, borderRadius: "50%", background: "#F2A93C", color: "#2C1E06", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                {i + 1}
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: 13.5, margin: "0 0 2px", color: "#14161C" }}>{s.title}</p>
                <p style={{ fontSize: 12.5, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- WHITELISTED NUMBERS ---------------- */

/* ---------------- SEND MESSAGE (UI only, wiring later) ---------------- */

function SendMessagePage({ initialDeviceId, initialTab, initialImei }) {
  const [activeTab, setActiveTab] = useState(initialTab || "popups");
  const [sendType, setSendType] = useState("single");
  const [deviceTag, setDeviceTag] = useState(initialDeviceId || "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [callImei, setCallImei] = useState(initialImei || "");
  const [callText, setCallText] = useState("");
  const [callAudioFile, setCallAudioFile] = useState(null);
  const [deviceOptions, setDeviceOptions] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok: bool, text: string }

  useEffect(() => {
    supabase
      .from("devices")
      .select("id, device_model, imei")
      .order("device_model", { ascending: true })
      .then(({ data }) => setDeviceOptions(data || []));
  }, []);

  async function submitMessage() {
    setResult(null);
    if (!deviceTag) { setResult({ ok: false, text: "Choose a device." }); return; }
    if (!title.trim()) { setResult({ ok: false, text: "Enter a title." }); return; }
    if (!content.trim()) { setResult({ ok: false, text: "Enter content." }); return; }

    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("device_commands").insert({
      device_id: deviceTag,
      command: activeTab === "popups" ? "POPUP" : "NOTIFY",
      title: title.trim(),
      message: content.trim(),
      issued_by: user?.email || "admin",
    });
    await supabase.functions.invoke("notify-devices", { body: { device_ids: [deviceTag] } }).catch(() => {});
    setSending(false);
    setResult({ ok: true, text: "Sent — the phone will pick it up within a couple of seconds, whether it's locked or unlocked." });
    setTitle("");
    setContent("");
  }

  async function submitCall() {
    setResult(null);
    if (!callImei.trim()) { setResult({ ok: false, text: "Enter the device IMEI." }); return; }
    if (!callText.trim() && !callAudioFile) { setResult({ ok: false, text: "Write a message or upload an audio file." }); return; }

    setSending(true);
    const { data: device, error: lookupErr } = await supabase
      .from("devices")
      .select("id")
      .eq("imei", callImei.trim())
      .maybeSingle();
    if (lookupErr || !device) {
      setSending(false);
      setResult({ ok: false, text: "No device found with that IMEI." });
      return;
    }

    let audioUrl = null;
    if (callAudioFile) {
      const ext = (callAudioFile.name.split(".").pop() || "amr").toLowerCase();
      const path = `call-${device.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("call-audio").upload(path, callAudioFile, { upsert: true });
      if (upErr) {
        setSending(false);
        setResult({ ok: false, text: upErr.message });
        return;
      }
      const { data: pub } = supabase.storage.from("call-audio").getPublicUrl(path);
      audioUrl = pub.publicUrl;
    }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("device_commands").insert({
      device_id: device.id,
      command: "PUSH_CALL",
      message: callText.trim() || null,
      audio_url: audioUrl,
      issued_by: user?.email || "admin",
    });
    await supabase.functions.invoke("notify-devices", { body: { device_ids: [device.id] } }).catch(() => {});
    setSending(false);
    setResult({ ok: true, text: "Call sent — the phone will pick it up within a couple of seconds." });
    setCallText("");
    setCallAudioFile(null);
  }

  const tabs = [
    { id: "popups", label: "Pop-ups" },
    { id: "push", label: "Push" },
    { id: "call", label: "Simulated Push Call" },
  ];

  const tabCopy = {
    popups: { title: "Pop-ups", desc: "The pop-up window will appear in the phone. You can set Title and content." },
    push: { title: "Push", desc: "Sending off notification messages." },
    call: { title: "Simulated Push Call", desc: "Shows a simulated incoming call on the phone by IMEI. If you upload an audio file it plays on accept; otherwise your written message is read out loud." },
  };

  return (
    <div>
      <PageHeader eyebrow="Custom Management" title="Notifications" />
      <p style={{ fontSize: 13, color: "#6B7280", margin: "-20px 0 24px", maxWidth: 560 }}>
        All three are live — they reach the device within seconds, whether it's locked or unlocked.
      </p>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ ...S.tableCard, padding: 0, flex: "1 1 480px", minWidth: 320 }}>
          <div style={{ display: "flex", borderBottom: "1px solid #E6E8EC" }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setResult(null); }}
                style={{
                  flex: 1, padding: "12px 10px", fontSize: 13, fontWeight: 600, background: "transparent",
                  border: "none", borderBottom: activeTab === t.id ? "2px solid #F2A93C" : "2px solid transparent",
                  color: activeTab === t.id ? "#14161C" : "#9AA1AE",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 24 }}>
            <h3 className="serif" style={{ fontSize: 17, color: "#14161C", margin: "0 0 6px" }}>{tabCopy[activeTab].title}</h3>
            <p style={{ fontSize: 12.5, color: "#6B7280", margin: "0 0 20px", lineHeight: 1.6 }}>{tabCopy[activeTab].desc}</p>

            {activeTab !== "call" ? (
              <>
                <Field label="Choose type">
                  <div style={{ display: "flex", gap: 20 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}>
                      <input type="radio" checked={sendType === "single"} onChange={() => setSendType("single")} /> Single unit
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}>
                      <input type="radio" checked={sendType === "bulk"} onChange={() => setSendType("bulk")} /> Bulk units
                    </label>
                  </div>
                </Field>
                <Field label="Device Tag">
                  <select style={{ ...S.select, width: "100%" }} value={deviceTag} onChange={(e) => setDeviceTag(e.target.value)}>
                    <option value="">Select a device…</option>
                    {deviceOptions.map((d) => (
                      <option key={d.id} value={d.id}>{d.device_model}{d.imei ? ` — ${d.imei}` : ""}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Message Template">
                  <button type="button" style={{ ...S.iconBtn, borderRadius: "50%" }} aria-label="Add template"><Plus size={15} /></button>
                </Field>
                <Field label="Title">
                  <input style={S.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
                </Field>
                <Field label="Content">
                  <div style={{ position: "relative" }}>
                    <textarea
                      style={{ ...S.input, minHeight: 110, resize: "vertical", fontFamily: "inherit" }}
                      value={content}
                      maxLength={500}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Content"
                    />
                    <span style={{ position: "absolute", right: 10, bottom: 8, fontSize: 11, color: "#9AA1AE" }}>{content.length}/500</span>
                  </div>
                </Field>
              </>
            ) : (
              <>
                <Field label="Device IMEI">
                  <input style={S.input} className="mono" value={callImei} onChange={(e) => setCallImei(e.target.value)} placeholder="Enter the device's IMEI" />
                </Field>
                <Field label="Message to speak">
                  <textarea
                    style={{ ...S.input, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
                    value={callText}
                    onChange={(e) => setCallText(e.target.value)}
                    placeholder="e.g. This is a reminder from Karachi Electronics. Your installment payment is overdue."
                  />
                </Field>
                <Field label="Or upload audio">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ ...S.secondaryBtn, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <Upload size={14} /> {callAudioFile ? "Change file" : "Choose file"}
                      <input
                        type="file"
                        accept="audio/*"
                        style={{ display: "none" }}
                        onChange={(e) => setCallAudioFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    {callAudioFile && <span style={{ fontSize: 12.5, color: "#374151" }}>{callAudioFile.name}</span>}
                  </div>
                  <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: "6px 0 0" }}>If both are filled, the audio plays instead of the spoken message.</p>
                </Field>
              </>
            )}

            {activeTab !== "call" ? (
              <button style={{ ...S.primaryBtn, marginTop: 8, opacity: sending ? 0.7 : 1 }} onClick={submitMessage} disabled={sending}>
                <Send size={15} /> {sending ? "Sending…" : "Submit"}
              </button>
            ) : (
              <button style={{ ...S.primaryBtn, marginTop: 8, opacity: sending ? 0.7 : 1 }} onClick={submitCall} disabled={sending}>
                <Send size={15} /> {sending ? "Sending…" : "Submit"}
              </button>
            )}
            {result && (
              <p style={{ fontSize: 12.5, color: result.ok ? "#0E9488" : "#D6414C", margin: "10px 0 0" }}>{result.text}</p>
            )}
          </div>
        </div>

        <PhonePreview variant={activeTab} title={title} content={content} number={callImei} />
      </div>
    </div>
  );
}

function PhonePreview({ variant, title, content, number }) {
  const timeLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <div style={{ flex: "0 0 220px" }}>
      <div style={{ width: 220, height: 460, borderRadius: 30, background: "#0B0E14", border: "8px solid #14161C", position: "relative", overflow: "hidden", boxShadow: "0 16px 32px rgba(20,22,28,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px 0", color: "#EDEEF2", fontSize: 11, fontWeight: 500 }}>
          <span>{timeLabel}</span>
          <span>●●●</span>
        </div>

        {variant === "popups" && (
          <div style={{ position: "absolute", top: "36%", left: 16, right: 16, background: "#FFFFFF", borderRadius: 14, padding: 18, textAlign: "center", boxShadow: "0 8px 20px rgba(0,0,0,0.3)" }}>
            <p style={{ fontWeight: 700, fontSize: 13.5, margin: "0 0 6px", color: "#14161C" }}>{title || "Title"}</p>
            <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 16px", lineHeight: 1.5 }}>{content || "Content"}</p>
            <button style={{ ...S.primaryBtn, width: "100%", justifyContent: "center" }}>Get feedback</button>
          </div>
        )}

        {variant === "push" && (
          <div style={{ margin: "10px 10px 0", background: "rgba(245,246,248,0.97)", borderRadius: 12, padding: 12 }}>
            <p style={{ fontSize: 10.5, color: "#6B7280", margin: "0 0 3px", fontWeight: 600 }}>SecurityPlugin · now</p>
            <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0, color: "#14161C" }}>{title || "Title"}</p>
            <p style={{ fontSize: 11.5, color: "#374151", margin: "2px 0 0" }}>{content || "Content"}</p>
          </div>
        )}

        {variant === "call" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", height: "86%", padding: "28px 0 24px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#2A2F3A", margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PhoneIncoming size={26} color="#9AA1AE" />
              </div>
              <p style={{ color: "#FFFFFF", fontSize: 17, fontWeight: 600, margin: 0 }}>{number || "112233445566"}</p>
              <p style={{ color: "#9AA1AE", fontSize: 11.5, margin: "4px 0 0" }}>Incoming call</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", width: "68%" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#D6414C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PhoneOff size={18} color="#fff" />
              </div>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#0E9488", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PhoneCall size={18} color="#fff" />
              </div>
            </div>
          </div>
        )}
      </div>
      <p style={{ textAlign: "center", fontSize: 11.5, color: "#9AA1AE", marginTop: 10 }}>Live preview</p>
    </div>
  );
}

/* ---------------- GENERAL SETTINGS (UI only, wiring later) ---------------- */

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        width: 38, height: 22, borderRadius: 11, border: "none", padding: 2,
        background: checked ? "#0E9488" : "#D8DCE3", display: "flex", alignItems: "center",
        justifyContent: checked ? "flex-end" : "flex-start", cursor: "pointer", flexShrink: 0,
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.25)", display: "block" }} />
    </button>
  );
}

function SettingsCard({ title, description, toggle, checked, onToggle, children }) {
  return (
    <div style={{ ...S.tableCard, padding: 22, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h3 className="serif" style={{ fontSize: 15.5, color: "#14161C", margin: "0 0 4px" }}>{title}</h3>
          {description && <p style={{ fontSize: 12.5, color: "#6B7280", margin: 0, lineHeight: 1.6, maxWidth: 620 }}>{description}</p>}
        </div>
        {toggle && <ToggleSwitch checked={checked} onChange={onToggle} />}
      </div>
      {children && <div style={{ marginTop: 18 }}>{children}</div>}
    </div>
  );
}

function AppVersionCard() {
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [versionCode, setVersionCode] = useState("");
  const [versionName, setVersionName] = useState("");
  const [apkFile, setApkFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const fileInputRef = useRef(null);

  async function loadCurrent() {
    const { data } = await supabase.from("app_version").select("*").eq("id", 1).maybeSingle();
    setCurrent(data || null);
    if (data) {
      setVersionCode(String(data.version_code));
      setVersionName(data.version_name || "");
    }
    setLoading(false);
  }
  useEffect(() => { loadCurrent(); }, []);

  async function save() {
    setMsg(null);
    const code = Number(versionCode);
    if (!versionCode.trim() || !Number.isInteger(code) || code <= 0) {
      setMsg({ ok: false, text: "Enter the version code as a whole number (it must match the APK's versionCode)." });
      return;
    }
    if (!apkFile && !current?.apk_url) {
      setMsg({ ok: false, text: "Choose the signed release APK to upload." });
      return;
    }
    setSaving(true);
    let apkUrl = current?.apk_url;
    if (apkFile) {
      const path = `karachi-electronics-lockapp-v${code}.apk`;
      const { error: upErr } = await supabase.storage.from("releases").upload(path, apkFile, {
        upsert: false,
        contentType: "application/vnd.android.package-archive",
      });
      if (upErr) {
        setSaving(false);
        setMsg({
          ok: false,
          text: /already exists|duplicate/i.test(upErr.message)
            ? `An APK for version code ${code} is already uploaded. Use a new version code — re-using a filename can serve a stale file.`
            : upErr.message,
        });
        return;
      }
      apkUrl = supabase.storage.from("releases").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("app_version").upsert({
      id: 1,
      version_code: code,
      version_name: versionName.trim() || null,
      apk_url: apkUrl,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "Saved — phones will update on their next check-in." });
    setApkFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadCurrent();
  }

  return (
    <SettingsCard title="App version" description="Phones update the lock app by themselves when the version code below is higher than the one they run. Applies to every branch.">
      <div style={{ background: "#F5F6F8", border: "1px solid #E6E8EC", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#6B7280" }}>
        {loading ? "Loading…" : current
          ? <>Live version: <strong style={{ color: "#14161C" }}>{current.version_name ? `${current.version_name} ` : ""}(code {current.version_code})</strong></>
          : "No version published yet."}
      </div>
      <Field label="Version code">
        <input style={S.input} className="mono" inputMode="numeric" value={versionCode} onChange={(e) => setVersionCode(e.target.value)} placeholder="e.g. 2" />
        <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: "6px 0 0" }}>Must exactly match the versionCode baked into the APK. Phones only update when this is higher than what they run.</p>
      </Field>
      <Field label="Version name (optional)">
        <input style={S.input} value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="e.g. 1.1" />
      </Field>
      <Field label="APK file">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input ref={fileInputRef} type="file" accept=".apk,application/vnd.android.package-archive" style={{ display: "none" }} onChange={(e) => setApkFile(e.target.files?.[0] || null)} />
          <button type="button" style={{ ...S.secondaryBtn, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> {apkFile ? "Change file" : "Choose APK"}
          </button>
          {apkFile && <span style={{ fontSize: 12.5, color: "#374151" }}>{apkFile.name} ({(apkFile.size / 1024 / 1024).toFixed(1)} MB)</span>}
        </div>
        <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: "6px 0 0" }}>Uploaded under a new filename (karachi-electronics-lockapp-v&lt;code&gt;.apk) each time. Leave empty to only change the name.</p>
      </Field>
      <button style={{ ...S.primaryBtn, opacity: saving ? 0.7 : 1 }} onClick={save} disabled={saving || loading}>
        {saving ? "Uploading & saving…" : "Save"}
      </button>
      {msg && <p style={{ fontSize: 12.5, color: msg.ok ? "#0E9488" : "#D6414C", margin: "10px 0 0" }}>{msg.text}</p>}
    </SettingsCard>
  );
}

function GeneralSettingsPage() {
  const { branchId, deviceLicenseLimit, isSuperAdmin } = useContext(BranchContext);
  const branding = useContext(BrandingContext);
  const [name, setName] = useState(branding.name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconMsg, setIconMsg] = useState("");
  const iconInputRef = useRef(null);

  useEffect(() => { setName(branding.name || ""); }, [branding.name]);

  const [deviceCount, setDeviceCount] = useState(null);
  const [warningValue, setWarningValue] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [savingLicense, setSavingLicense] = useState(false);
  const [licenseMsg, setLicenseMsg] = useState("");

  useEffect(() => {
    supabase.from("devices").select("*", { count: "exact", head: true })
      .then(({ count }) => setDeviceCount(count || 0));
    supabase.from("app_branding").select("license_warning_value, license_notify_email").eq("branch_id", branchId).maybeSingle()
      .then(({ data }) => {
        setWarningValue(data?.license_warning_value != null ? String(data.license_warning_value) : "");
        setNotifyEmail(data?.license_notify_email || "");
      });
  }, []);

  const remainingLicenses = deviceCount == null ? null : deviceLicenseLimit - deviceCount;
  const warningNum = warningValue === "" ? null : Number(warningValue);
  const licenseWarningActive = remainingLicenses != null && warningNum != null && remainingLicenses <= warningNum;

  async function saveLicenseSettings() {
    setSavingLicense(true);
    setLicenseMsg("");
    const { error } = await supabase.from("app_branding").update({
      license_warning_value: warningValue === "" ? null : Number(warningValue),
      license_notify_email: notifyEmail.trim() || null,
    }).eq("branch_id", branchId);
    setSavingLicense(false);
    setLicenseMsg(error ? error.message : "Saved.");
  }

  const [outgoingNumbers, setOutgoingNumbers] = useState("");
  const [savingOutgoing, setSavingOutgoing] = useState(false);
  const [outgoingMsg, setOutgoingMsg] = useState("");

  useEffect(() => {
    supabase.from("whitelisted_numbers").select("phone_number").order("created_at", { ascending: true })
      .then(({ data }) => setOutgoingNumbers((data || []).map((r) => r.phone_number).join(", ")));
  }, []);

  async function saveOutgoingNumbers() {
    const list = [...new Set(outgoingNumbers.split(",").map((n) => n.trim()).filter(Boolean))];
    setSavingOutgoing(true);
    setOutgoingMsg("");
    const { error: delErr } = await supabase.from("whitelisted_numbers").delete().not("id", "is", null);
    if (delErr) {
      setSavingOutgoing(false);
      setOutgoingMsg(delErr.message);
      return;
    }
    if (list.length) {
      const { error: insErr } = await supabase.from("whitelisted_numbers").insert(list.map((n) => ({ label: n, phone_number: n, branch_id: branchId })));
      if (insErr) {
        setSavingOutgoing(false);
        setOutgoingMsg(insErr.message);
        return;
      }
    }
    setOutgoingNumbers(list.join(", "));
    setSavingOutgoing(false);
    setOutgoingMsg("Saved.");
  }

  const [appsEnabled, setAppsEnabled] = useState(false);
  const [appsList, setAppsList] = useState("");
  const [savingApps, setSavingApps] = useState(false);
  const [appsMsg, setAppsMsg] = useState("");

  useEffect(() => {
    supabase.from("app_branding").select("whitelisted_apps_enabled, whitelisted_apps").eq("branch_id", branchId).maybeSingle()
      .then(({ data }) => {
        setAppsEnabled(!!data?.whitelisted_apps_enabled);
        setAppsList(data?.whitelisted_apps || "");
      });
  }, []);

  async function saveWhitelistedApps() {
    const list = [...new Set(appsList.split(",").map((p) => p.trim()).filter(Boolean))];
    setSavingApps(true);
    setAppsMsg("");
    const { error } = await supabase.from("app_branding").update({
      whitelisted_apps_enabled: appsEnabled,
      whitelisted_apps: list.join(","),
    }).eq("branch_id", branchId);
    setSavingApps(false);
    if (error) setAppsMsg(error.message);
    else {
      setAppsList(list.join(", "));
      setAppsMsg("Saved.");
    }
  }

  const [lockscreenWatermark, setLockscreenWatermark] = useState(false);
  const [savingLockscreenWatermark, setSavingLockscreenWatermark] = useState(false);
  const [lockscreenWatermarkMsg, setLockscreenWatermarkMsg] = useState("");

  const [simWatermarkEnabled, setSimWatermarkEnabled] = useState(false);
  const [simWatermarkText, setSimWatermarkText] = useState("");
  const [savingSimWatermark, setSavingSimWatermark] = useState(false);
  const [simWatermarkMsg, setSimWatermarkMsg] = useState("");

  useEffect(() => {
    supabase.from("app_branding")
      .select("watermark_lockscreen_enabled, watermark_sim_removed_enabled, watermark_sim_removed_text")
      .eq("branch_id", branchId).maybeSingle()
      .then(({ data }) => {
        setLockscreenWatermark(!!data?.watermark_lockscreen_enabled);
        setSimWatermarkEnabled(!!data?.watermark_sim_removed_enabled);
        setSimWatermarkText(data?.watermark_sim_removed_text || "");
      });
  }, []);

  async function saveLockscreenWatermark(val) {
    setLockscreenWatermark(val);
    setSavingLockscreenWatermark(true);
    setLockscreenWatermarkMsg("");
    const { error } = await supabase.from("app_branding").update({ watermark_lockscreen_enabled: val }).eq("branch_id", branchId);
    setSavingLockscreenWatermark(false);
    setLockscreenWatermarkMsg(error ? error.message : "Saved.");
  }

  async function saveSimWatermark() {
    setSavingSimWatermark(true);
    setSimWatermarkMsg("");
    const { error } = await supabase.from("app_branding").update({
      watermark_sim_removed_enabled: simWatermarkEnabled,
      watermark_sim_removed_text: simWatermarkText.trim() || null,
    }).eq("branch_id", branchId);
    setSavingSimWatermark(false);
    setSimWatermarkMsg(error ? error.message : "Saved.");
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavingName(true);
    setNameMsg("");
    const { error } = await supabase.from("app_branding").update({ name: trimmed }).eq("branch_id", branchId);
    setSavingName(false);
    if (error) setNameMsg(error.message);
    else {
      setNameMsg("Saved.");
      branding.reload();
    }
  }

  async function onIconChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024) {
      setIconMsg("File too large — max 50KB.");
      if (iconInputRef.current) iconInputRef.current.value = "";
      return;
    }
    setUploadingIcon(true);
    setIconMsg("");
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `icon-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    if (upErr) {
      setUploadingIcon(false);
      setIconMsg(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
    const { error: updErr } = await supabase.from("app_branding").update({ icon_url: pub.publicUrl }).eq("branch_id", branchId);
    setUploadingIcon(false);
    if (updErr) setIconMsg(updErr.message);
    else {
      setIconMsg("Icon updated.");
      branding.reload();
    }
    if (iconInputRef.current) iconInputRef.current.value = "";
  }

  const [t, setToggles] = useState({
    forceUpgrade: false, allowReminders: false, whitelistedAppsOn: false,
    watermarkLockscreen: false, watermarkSimRemoved: false, antiUninstall: false,
    everyBoot: false, simSwap: false, simRemoved: false, offlineDays: false,
    priorLock: false, afterLockRemoval: false, activation: false,
  });
  const setOne = (key) => (val) => setToggles((prev) => ({ ...prev, [key]: val }));

  return (
    <div>
      <PageHeader eyebrow="Custom Management" title="General Settings" />
      <p style={{ fontSize: 13, color: "#6B7280", margin: "-20px 0 24px", maxWidth: 560 }}>
        Product name and icon below are live. The rest of this page is layout only for now — not wired up or saved yet.
      </p>

      <div style={{ maxWidth: 640 }}>
        <SettingsCard title="Product name and icon" description="Product name and icon configured below will show to the end user if they open the app.">
          <Field label="Name">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={S.input} maxLength={50} placeholder="Karachi Electronics" value={name} onChange={(e) => setName(e.target.value)} />
              <button type="button" style={{ ...S.primaryBtn, flexShrink: 0, opacity: savingName ? 0.7 : 1 }} onClick={saveName} disabled={savingName}>
                {savingName ? "Saving…" : "Save"}
              </button>
            </div>
            {nameMsg && <p style={{ fontSize: 11.5, color: nameMsg === "Saved." ? "#1E8E5A" : "#D6414C", margin: "6px 0 0" }}>{nameMsg}</p>}
          </Field>
          <Field label="Icon">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BrandLogo size={40} />
              <input ref={iconInputRef} type="file" accept="image/png" style={{ display: "none" }} onChange={onIconChosen} />
              <button
                type="button"
                style={{ ...S.secondaryBtn, display: "inline-flex", alignItems: "center", gap: 6, opacity: uploadingIcon ? 0.7 : 1 }}
                onClick={() => iconInputRef.current?.click()}
                disabled={uploadingIcon}
              >
                <Upload size={14} /> {uploadingIcon ? "Uploading…" : "Upload icon"}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: "8px 0 0" }}>PNG only, up to 512×512, max 50KB.</p>
            {iconMsg && <p style={{ fontSize: 11.5, color: iconMsg === "Icon updated." ? "#1E8E5A" : "#D6414C", margin: "4px 0 0" }}>{iconMsg}</p>}
          </Field>
        </SettingsCard>

        {isSuperAdmin && <AppVersionCard />}

        <SettingsCard title="Available remaining amount warning value" description={`This installation is licensed for ${deviceLicenseLimit} devices. When the remaining amount drops to or below the value set here, a warning banner shows on the Dashboard.`}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", background: licenseWarningActive ? "#FDEBEC" : "#F5F6F8",
            border: `1px solid ${licenseWarningActive ? "#F4B7BC" : "#E6E8EC"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13,
          }}>
            <span style={{ color: "#6B7280" }}>Used</span>
            <strong style={{ color: licenseWarningActive ? "#B0222D" : "#14161C" }}>
              {deviceCount == null ? "…" : `${deviceCount} / ${deviceLicenseLimit}`}
              {remainingLicenses != null && ` (${Math.max(remainingLicenses, 0)} remaining)`}
            </strong>
          </div>
          <Field label="Remaining license warning value">
            <input style={S.input} type="number" min="0" placeholder="3" value={warningValue} onChange={(e) => setWarningValue(e.target.value)} />
          </Field>
          <Field label="Notify recipients">
            <input style={S.input} placeholder="you@karachielectronics.pk" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} />
            <p style={{ fontSize: 11.5, color: "#9AA1AE", margin: "6px 0 0" }}>Saved for now — email sending isn't wired up yet, only the Dashboard banner is live.</p>
          </Field>
          <button type="button" style={{ ...S.primaryBtn, opacity: savingLicense ? 0.7 : 1 }} onClick={saveLicenseSettings} disabled={savingLicense}>
            {savingLicense ? "Saving…" : "Save"}
          </button>
          {licenseMsg && <p style={{ fontSize: 11.5, color: licenseMsg === "Saved." ? "#1E8E5A" : "#D6414C", margin: "8px 0 0" }}>{licenseMsg}</p>}
        </SettingsCard>

        <SettingsCard
          title="Force upgrade to latest version"
          description="When the app is activated, if it finds the device has an upgradeable security version, it will force the device to upgrade to the latest version."
          toggle checked={t.forceUpgrade} onToggle={setOne("forceUpgrade")}
        />

        <SettingsCard
          title="Remind device users to upgrade to a higher and more secure OS version"
          description="When a new security version is available, the customer is proactively reminded to upgrade. It is not mandatory."
          toggle checked={t.allowReminders} onToggle={setOne("allowReminders")}
        />

        <SettingsCard title="Outgoing whitelisted phone numbers" description="The customer can make outgoing calls with the numbers listed below — this is what shows as call buttons on a locked phone. Numbers only, separated by commas.">
          <textarea
            style={{ ...S.input, minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
            placeholder="e.g. 03001234567,03211234567"
            value={outgoingNumbers}
            onChange={(e) => setOutgoingNumbers(e.target.value)}
          />
          <button type="button" style={{ ...S.primaryBtn, marginTop: 10, opacity: savingOutgoing ? 0.7 : 1 }} onClick={saveOutgoingNumbers} disabled={savingOutgoing}>
            {savingOutgoing ? "Saving…" : "Save"}
          </button>
          {outgoingMsg && <p style={{ fontSize: 11.5, color: outgoingMsg === "Saved." ? "#1E8E5A" : "#D6414C", margin: "8px 0 0" }}>{outgoingMsg}</p>}
        </SettingsCard>

        <SettingsCard title="Incoming whitelisted phone numbers" description="The customer can receive calls from the numbers listed below. Numbers only, separated by commas.">
          <textarea style={{ ...S.input, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} placeholder="e.g. 03001234567,03211234567" />
        </SettingsCard>

        <SettingsCard
          title="Whitelisted Apps"
          description="List the package names of mobile apps that customers are allowed to use when their phone is locked."
          toggle checked={appsEnabled} onToggle={(val) => { setAppsEnabled(val); }}
        >
          {appsEnabled && (
            <Field label="Whitelisted apps">
              <textarea
                style={{ ...S.input, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
                placeholder="e.g. com.whatsapp,com.google.android.dialer"
                value={appsList}
                onChange={(e) => setAppsList(e.target.value)}
              />
            </Field>
          )}
          <button type="button" style={{ ...S.primaryBtn, opacity: savingApps ? 0.7 : 1 }} onClick={saveWhitelistedApps} disabled={savingApps}>
            {savingApps ? "Saving…" : "Save"}
          </button>
          {appsMsg && <p style={{ fontSize: 11.5, color: appsMsg === "Saved." ? "#1E8E5A" : "#D6414C", margin: "8px 0 0" }}>{appsMsg}</p>}
        </SettingsCard>

        <SettingsCard title="Disconnection Auto-lock" description="When the device stays offline beyond the set time limit, it will automatically trigger an offline screen lock, released once the customer reconnects.">
          <Field label="Device on monthly repayment (hours)"><input style={S.input} type="number" placeholder="840" /></Field>
          <Field label="Device on bi-weekly repayment (hours)"><input style={S.input} type="number" placeholder="336" /></Field>
          <Field label="Device on weekly repayment (hours)"><input style={S.input} type="number" placeholder="168" /></Field>
          <Field label="Device on daily repayment (hours)"><input style={S.input} type="number" placeholder="24" /></Field>
        </SettingsCard>

        <SettingsCard
          title="Watermark on the lockscreen"
          description="Once the device is activated, the lockscreen will display watermark information. This feature helps prevent resale."
          toggle checked={lockscreenWatermark} onToggle={saveLockscreenWatermark}
        >
          {(savingLockscreenWatermark || lockscreenWatermarkMsg) && (
            <p style={{ fontSize: 11.5, color: lockscreenWatermarkMsg === "Saved." ? "#1E8E5A" : "#D6414C", margin: 0 }}>
              {savingLockscreenWatermark ? "Saving…" : lockscreenWatermarkMsg}
            </p>
          )}
        </SettingsCard>

        <SettingsCard
          title="Launcher watermark of SIM removed"
          description="A watermark that changes color automatically is placed on the launcher once all SIMs are removed. Helps prevent resale."
          toggle checked={simWatermarkEnabled} onToggle={setSimWatermarkEnabled}
        >
          {simWatermarkEnabled && (
            <Field label="Watermark text">
              <textarea
                style={{ ...S.input, minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
                maxLength={100}
                placeholder="This device is property of Karachi Electronics, purchased on installments."
                value={simWatermarkText}
                onChange={(e) => setSimWatermarkText(e.target.value)}
              />
            </Field>
          )}
          <button type="button" style={{ ...S.primaryBtn, opacity: savingSimWatermark ? 0.7 : 1 }} onClick={saveSimWatermark} disabled={savingSimWatermark}>
            {savingSimWatermark ? "Saving…" : "Save"}
          </button>
          {simWatermarkMsg && <p style={{ fontSize: 11.5, color: simWatermarkMsg === "Saved." ? "#1E8E5A" : "#D6414C", margin: "8px 0 0" }}>{simWatermarkMsg}</p>}
        </SettingsCard>

        <SettingsCard
          title="Message of offline beyond X Days"
          description="Display a notification message when the customer is offline beyond some days."
          toggle checked={t.offlineDays} onToggle={setOne("offlineDays")}
        >
          {t.offlineDays && (
            <>
              <Field label="Title"><input style={S.input} maxLength={80} placeholder="Mobile Locking Indication" /></Field>
              <Field label="Content"><textarea style={{ ...S.input, minHeight: 80, resize: "vertical", fontFamily: "inherit" }} maxLength={500} placeholder="This device is purchased on installments from Karachi Electronics…" /></Field>
              <Field label="Effective time">
                <select style={{ ...S.select, width: "100%" }} defaultValue="7">
                  <option value="1">Offline beyond 1 day</option>
                  <option value="3">Offline beyond 3 days</option>
                  <option value="7">Offline beyond 7 days</option>
                  <option value="14">Offline beyond 14 days</option>
                  <option value="30">Offline beyond 30 days</option>
                </select>
              </Field>
              <Field label="Type">
                <div style={{ display: "flex", gap: 20 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}><input type="radio" name="offlineType" defaultChecked /> Dismissable</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}><input type="radio" name="offlineType" /> Non-dismissable</label>
                </div>
              </Field>
            </>
          )}
        </SettingsCard>

        <SettingsCard
          title="Message after lock removal"
          description="Display a notification message after the device is unlocked and removed from the installment program."
          toggle checked={t.afterLockRemoval} onToggle={setOne("afterLockRemoval")}
        >
          {t.afterLockRemoval && (
            <>
              <Field label="Title"><input style={S.input} maxLength={80} placeholder="Congratulations" /></Field>
              <Field label="Content"><textarea style={{ ...S.input, minHeight: 80, resize: "vertical", fontFamily: "inherit" }} maxLength={500} placeholder="You have fully repaid the loan. The device will no longer be restricted." /></Field>
              <Field label="Type">
                <div style={{ display: "flex", gap: 20 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}><input type="radio" name="afterLockType" /> Dismissable</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}><input type="radio" name="afterLockType" defaultChecked /> Non-dismissable</label>
                </div>
              </Field>
            </>
          )}
        </SettingsCard>

        <SettingsCard title="Message of activation" description="Display a notification message when the lock is activated." toggle checked={t.activation} onToggle={setOne("activation")} />

        <button style={{ ...S.primaryBtn, marginTop: 8 }}>Submit</button>
      </div>
    </div>
  );
}

/* ---------------- ROLES ---------------- */

function RolesList() {
  const { branchId } = useContext(BranchContext);
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
      await supabase.from("roles").insert({ name: draft.name.trim(), created_by: user?.email || "admin", branch_id: branchId });
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
  const { branchId } = useContext(BranchContext);
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
      body: { name: draft.name.trim(), email: draft.email.trim(), role: draft.role.trim(), invited_by: user?.email || "admin", branch_id: branchId },
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

/* ---------------- SUPER ADMIN ---------------- */

function SuperAdminSidebar({ saTab, setSaTab }) {
  const nav = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "branches", label: "Branches", icon: Smartphone },
  ];
  return (
    <aside style={S.sidebar}>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {nav.map((it) => {
          const Icon = it.icon;
          const active = saTab === it.id;
          return (
            <div key={it.id} style={active ? S.navItemActive : S.navItem} onClick={() => setSaTab(it.id)} data-tour={`sa-nav-${it.id}`}>
              <Icon size={16} />
              <span>{it.label}</span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function SuperAdminOverview({ branches, deviceCounts, loading }) {
  const totalBranches = branches.length;
  const totalCapacity = branches.reduce((sum, b) => sum + (b.device_license_limit || 0), 0);
  const totalUsed = branches.reduce((sum, b) => sum + (deviceCounts[b.id] || 0), 0);
  const totalRemaining = Math.max(totalCapacity - totalUsed, 0);

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Overview" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Branches" value={totalBranches} />
        <StatCard label="Total license capacity" value={totalCapacity} />
        <StatCard label="Devices used (all branches)" value={totalUsed} />
        <StatCard label="Remaining (all branches)" value={totalRemaining} />
      </div>

      <h3 className="serif" style={{ fontSize: 16, color: "#14161C", margin: "0 0 12px" }}>Branches at a glance</h3>
      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Branch", "License limit", "Used", "Remaining"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={4} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && branches.length === 0 && <tr><td colSpan={4} style={S.emptyCell}>No branches yet.</td></tr>}
            {branches.map((b) => {
              const used = deviceCounts[b.id] || 0;
              const remaining = Math.max(b.device_license_limit - used, 0);
              return (
                <tr key={b.id} style={S.tr}>
                  <td style={S.td}>{b.name}</td>
                  <td style={S.td}>{b.device_license_limit}</td>
                  <td style={S.td}>{used}</td>
                  <td style={S.td}>{remaining}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BranchDetail({ branch, usedCount, onBack }) {
  const [devices, setDevices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [branch.id]);

  async function load() {
    setLoading(true);
    const [{ data: deviceRows }, { data: staffRows }] = await Promise.all([
      supabase.from("devices").select("*").eq("branch_id", branch.id).order("provisioned_at", { ascending: false }),
      supabase.from("admin_users").select("*").eq("branch_id", branch.id).order("invited_at", { ascending: false }),
    ]);
    setDevices(deviceRows || []);
    setStaff(staffRows || []);
    setLoading(false);
  }

  const activated = devices.filter((d) => d.last_seen_at).length;
  const pending = devices.length - activated;
  const remaining = Math.max(branch.device_license_limit - devices.length, 0);

  return (
    <div>
      <button style={{ ...S.secondaryBtn, marginBottom: 20 }} onClick={onBack}>&larr; Back to branches</button>
      <PageHeader eyebrow="Super Admin · Branch" title={branch.name} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="License limit" value={branch.device_license_limit} />
        <StatCard label="Used" value={devices.length} />
        <StatCard label="Remaining" value={remaining} />
        <StatCard label="Activated" value={activated} />
        <StatCard label="Pending" value={pending} />
      </div>

      <h3 className="serif" style={{ fontSize: 16, color: "#14161C", margin: "0 0 12px" }}>Devices</h3>
      <div style={{ ...S.tableCard, marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Device", "Tag", "IMEI", "Status", "Last seen"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && devices.length === 0 && <tr><td colSpan={5} style={S.emptyCell}>No devices yet.</td></tr>}
            {devices.map((d) => (
              <tr key={d.id} style={S.tr}>
                <td style={S.td}>{d.device_model || d.imei || "—"}</td>
                <td style={S.td}>{d.device_tag || "—"}</td>
                <td style={S.td} className="mono">{d.imei || "—"}</td>
                <td style={S.td}>
                  <span style={{ ...S.badge, background: d.is_locked ? "#FCEBEC" : "#E5F8F2", color: d.is_locked ? "#D6414C" : "#0E9488" }}>
                    {d.is_locked ? "Locked" : "Active"}
                  </span>
                  {d.sim_missing && <span style={{ ...S.badge, background: "#FBF0DC", color: "#AD6A0C", marginLeft: 6 }}>No SIM</span>}
                </td>
                <td style={S.td} className="mono">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleDateString() : "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="serif" style={{ fontSize: 16, color: "#14161C", margin: "0 0 12px" }}>Staff</h3>
      <div style={S.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Name", "Email", "Role", "Status"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={4} style={S.emptyCell}>Loading…</td></tr>}
            {!loading && staff.length === 0 && <tr><td colSpan={4} style={S.emptyCell}>No staff yet.</td></tr>}
            {staff.map((u) => (
              <tr key={u.id} style={S.tr}>
                <td style={S.td}>{u.name}</td>
                <td style={S.td} className="mono">{u.email}</td>
                <td style={S.td}>{u.role}</td>
                <td style={S.td}><span style={{ ...S.badge, background: "#E5F8F2", color: "#0E9488" }}>{u.status || "Invited"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SuperAdminPortal({ email, canSwitchToBranch, onSwitchToBranch }) {
  const [saTab, setSaTab] = useState("overview");
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branches, setBranches] = useState([]);
  const [deviceCounts, setDeviceCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", limit: "", adminName: "", adminEmail: "" });
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [editLimit, setEditLimit] = useState(null); // { id, value }
  const [savingLimit, setSavingLimit] = useState(false);
  const [editName, setEditName] = useState(null); // { id, value }
  const [savingName, setSavingName] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const tourSteps = [
    { target: "[data-tour='sa-brand']", title: "Welcome", text: "This is the Super Admin panel — manage every branch and its device license limit from here." },
    ...(canSwitchToBranch ? [{ target: "[data-tour='sa-switch-branch']", title: "My Branch", text: "Switch back to your own branch's dashboard anytime from here." }] : []),
    { target: "[data-tour='sa-nav-overview']", tab: "overview", title: "Overview", text: "See combined stats across every branch — total license capacity, devices used, and remaining." },
    { target: "[data-tour='sa-nav-branches']", tab: "branches", title: "Branches", text: "Create new branches, rename them, and set their device license limits here." },
    { target: "[data-tour='sa-add-branch']", tab: "branches", title: "Add a branch", text: "Click here to create a new branch — it also invites that branch's first admin by email." },
    { target: "[data-tour='sa-branches-table']", tab: "branches", title: "View a branch", text: "Click View on any branch to see its devices and staff without leaving the Super Admin panel." },
  ];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: branchRows }, { data: deviceRows }] = await Promise.all([
      supabase.from("branches").select("*").order("created_at", { ascending: false }),
      supabase.from("devices").select("branch_id"),
    ]);
    setBranches(branchRows || []);
    const counts = {};
    (deviceRows || []).forEach((d) => { counts[d.branch_id] = (counts[d.branch_id] || 0) + 1; });
    setDeviceCounts(counts);
    setLoading(false);
  }

  function openAdd() { setDraft({ name: "", limit: "", adminName: "", adminEmail: "" }); setErrors({}); setDrawerOpen(true); }

  async function createBranch() {
    const e = {};
    if (!draft.name.trim()) e.name = "Enter a branch name.";
    if (!draft.limit || Number(draft.limit) <= 0) e.limit = "Enter a device license limit.";
    if (!draft.adminName.trim()) e.adminName = "Enter the branch admin's name.";
    if (!draft.adminEmail.trim()) e.adminEmail = "Enter the branch admin's email.";
    setErrors(e);
    if (Object.keys(e).length) return;

    setCreating(true);
    const { data: branch, error: branchErr } = await supabase
      .from("branches")
      .insert({ name: draft.name.trim(), device_license_limit: Number(draft.limit) })
      .select()
      .single();
    if (branchErr) { setCreating(false); setErrors({ form: branchErr.message }); return; }

    const { error: brandingErr } = await supabase.from("app_branding").insert({ branch_id: branch.id, name: draft.name.trim() });
    if (brandingErr) { setCreating(false); setErrors({ form: brandingErr.message }); return; }

    const { data: inviteData, error: inviteErr } = await supabase.functions.invoke("invite-admin-user", {
      body: { name: draft.adminName.trim(), email: draft.adminEmail.trim(), role: "Owner", invited_by: email, branch_id: branch.id },
    });
    setCreating(false);
    if (inviteErr || !inviteData?.success) {
      setErrors({ form: inviteData?.reason || "Branch created, but inviting the admin failed. Add them from Settings → Account Management once you switch into that branch." });
      setDrawerOpen(false);
      load();
      return;
    }
    setDrawerOpen(false);
    load();
  }

  async function saveLimit() {
    if (!editLimit || !editLimit.value || Number(editLimit.value) < 0) return;
    setSavingLimit(true);
    await supabase.from("branches").update({ device_license_limit: Number(editLimit.value) }).eq("id", editLimit.id);
    setSavingLimit(false);
    setEditLimit(null);
    load();
  }

  async function saveName() {
    if (!editName || !editName.value.trim()) return;
    setSavingName(true);
    await supabase.from("branches").update({ name: editName.value.trim() }).eq("id", editName.id);
    setSavingName(false);
    setEditName(null);
    load();
  }

  return (
    <div style={S.appShell}>
      <GlobalStyle />
      <header style={S.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} data-tour="sa-brand">
          <div style={S.logoMark}>S</div>
          <span className="serif" style={{ fontSize: 17, color: "#14161C" }}>Super Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button style={S.tourBtn} onClick={() => setTourOpen(true)}>New User Tour</button>
          {canSwitchToBranch && (
            <button style={S.secondaryBtn} onClick={onSwitchToBranch} data-tour="sa-switch-branch">
              <Smartphone size={14} /> My Branch
            </button>
          )}
          <span style={{ fontSize: 13, color: "#6B7280" }}>{email}</span>
          <button style={S.logoutBtn} onClick={() => supabase.auth.signOut()}>
            <LogOut size={14} /> Log out
          </button>
        </div>
      </header>
      {tourOpen && <TourOverlay steps={tourSteps} onNavigate={(t) => { setSaTab(t); setSelectedBranch(null); }} onClose={() => setTourOpen(false)} />}

      <div style={S.appBody}>
        <SuperAdminSidebar saTab={saTab} setSaTab={(t) => { setSaTab(t); setSelectedBranch(null); }} />
        <main style={S.main}>
          {saTab === "overview" && <SuperAdminOverview branches={branches} deviceCounts={deviceCounts} loading={loading} />}

          {saTab === "branches" && selectedBranch && (
            <BranchDetail branch={selectedBranch} usedCount={deviceCounts[selectedBranch.id] || 0} onBack={() => setSelectedBranch(null)} />
          )}

          {saTab === "branches" && !selectedBranch && (
            <>
              <PageHeader eyebrow="Super Admin" title="Branches" count={branches.length}>
                <button style={S.primaryBtn} onClick={openAdd} data-tour="sa-add-branch"><Plus size={16} /> Add branch</button>
              </PageHeader>
              <p style={{ fontSize: 13, color: "#6B7280", margin: "-20px 0 24px", maxWidth: 560 }}>
                Each branch is an independent vendor installation — its own devices, staff and settings. Set how many device licenses a branch is allowed to use.
              </p>

              <div style={S.tableCard} data-tour="sa-branches-table">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Branch", "License limit", "Used", "Remaining", "", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {loading && <tr><td colSpan={6} style={S.emptyCell}>Loading…</td></tr>}
                    {!loading && branches.length === 0 && <tr><td colSpan={6} style={S.emptyCell}>No branches yet.</td></tr>}
                    {branches.map((b) => {
                      const used = deviceCounts[b.id] || 0;
                      const remaining = Math.max(b.device_license_limit - used, 0);
                      const editing = editLimit?.id === b.id;
                      const editingName = editName?.id === b.id;
                      return (
                        <tr key={b.id} style={S.tr}>
                          <td style={S.td}>
                            {editingName ? (
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <input
                                  style={{ ...S.input, width: 160, padding: "6px 10px" }}
                                  value={editName.value}
                                  onChange={(e) => setEditName({ ...editName, value: e.target.value })}
                                />
                                <button style={{ ...S.primaryBtn, padding: "6px 10px", fontSize: 12 }} onClick={saveName} disabled={savingName}>Save</button>
                                <button style={{ ...S.secondaryBtn, padding: "6px 10px", fontSize: 12 }} onClick={() => setEditName(null)}>Cancel</button>
                              </div>
                            ) : (
                              <span style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setEditName({ id: b.id, value: b.name })}>
                                {b.name} <Pencil size={12} color="#9AA1AE" />
                              </span>
                            )}
                          </td>
                          <td style={S.td}>
                            {editing ? (
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <input
                                  style={{ ...S.input, width: 90, padding: "6px 10px" }}
                                  type="number"
                                  min="0"
                                  value={editLimit.value}
                                  onChange={(e) => setEditLimit({ ...editLimit, value: e.target.value })}
                                />
                                <button style={{ ...S.primaryBtn, padding: "6px 10px", fontSize: 12 }} onClick={saveLimit} disabled={savingLimit}>Save</button>
                                <button style={{ ...S.secondaryBtn, padding: "6px 10px", fontSize: 12 }} onClick={() => setEditLimit(null)}>Cancel</button>
                              </div>
                            ) : (
                              <span style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setEditLimit({ id: b.id, value: String(b.device_license_limit) })}>
                                {b.device_license_limit} <Pencil size={12} color="#9AA1AE" />
                              </span>
                            )}
                          </td>
                          <td style={S.td}>{used}</td>
                          <td style={S.td}>{remaining}</td>
                          <td style={S.td} className="mono">{new Date(b.created_at).toLocaleDateString()}</td>
                          <td style={{ ...S.td, textAlign: "right" }}>
                            <button style={{ ...S.secondaryBtn, padding: "6px 12px", fontSize: 12.5 }} onClick={() => setSelectedBranch(b)}>View</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>

      {drawerOpen && (
        <Drawer title="Add branch" onClose={() => setDrawerOpen(false)}>
          <Field label="Branch name" error={errors.name}><input style={S.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Lahore Mobiles" /></Field>
          <Field label="Device license limit" error={errors.limit}><input style={S.input} type="number" min="1" value={draft.limit} onChange={(e) => setDraft({ ...draft, limit: e.target.value })} placeholder="e.g. 200" /></Field>
          <Field label="Branch admin name" error={errors.adminName}><input style={S.input} value={draft.adminName} onChange={(e) => setDraft({ ...draft, adminName: e.target.value })} placeholder="Jordan Lee" /></Field>
          <Field label="Branch admin email" error={errors.adminEmail}><input style={S.input} value={draft.adminEmail} onChange={(e) => setDraft({ ...draft, adminEmail: e.target.value })} placeholder="owner@branch.com" /></Field>
          {errors.form && <p style={{ fontSize: 12, color: "#D6414C", margin: "0 0 12px" }}>{errors.form}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={{ ...S.primaryBtn, opacity: creating ? 0.7 : 1 }} onClick={createBranch} disabled={creating}>
              {creating ? "Creating…" : "Create branch"}
            </button>
            <button style={S.secondaryBtn} onClick={() => setDrawerOpen(false)}>Cancel</button>
          </div>
        </Drawer>
      )}
    </div>
  );
}

/* ---------------- GUIDED TOUR ---------------- */

function TourOverlay({ steps, onNavigate, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = steps[i];

  useEffect(() => {
    if (step?.tab && onNavigate) onNavigate(step.tab);
    const t = setTimeout(() => {
      const el = step ? document.querySelector(step.target) : null;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "instant" });
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  if (!step) return null;

  const cardWidth = 300;
  const pad = 8;
  let top = rect ? rect.bottom + 14 : window.innerHeight / 2 - 80;
  let left = rect ? Math.min(Math.max(rect.left, 16), window.innerWidth - cardWidth - 16) : window.innerWidth / 2 - cardWidth / 2;
  if (rect && top + 170 > window.innerHeight) top = Math.max(rect.top - 170, 16);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
      <div
        style={{
          position: "fixed",
          top: rect ? rect.top - pad : 0,
          left: rect ? rect.left - pad : 0,
          width: rect ? rect.width + pad * 2 : "100vw",
          height: rect ? rect.height + pad * 2 : "100vh",
          borderRadius: rect ? 8 : 0,
          boxShadow: rect ? "0 0 0 2px #F2A93C, 0 0 0 4000px rgba(20,22,28,0.55)" : "0 0 0 4000px rgba(20,22,28,0.55)",
          transition: "top 0.2s, left 0.2s, width 0.2s, height 0.2s",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed", top, left, width: cardWidth, background: "#fff", borderRadius: 10, padding: 18,
          boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
        }}
      >
        <h3 className="serif" style={{ fontSize: 15.5, color: "#14161C", margin: "0 0 8px" }}>{step.title}</h3>
        <p style={{ fontSize: 12.5, color: "#6B7280", margin: "0 0 14px", lineHeight: 1.6 }}>{step.text}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#9AA1AE" }}>{i + 1}/{steps.length}</span>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#6B7280", cursor: "pointer" }} onClick={onClose}>Skip</span>
            <button style={S.primaryBtn} onClick={() => (i + 1 < steps.length ? setI(i + 1) : onClose())}>
              {i + 1 < steps.length ? "Next" : "Got it"}
            </button>
          </div>
        </div>
      </div>
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

function GrowthChart({ data, series }) {
  if (!data.length) return null;
  const width = 700, height = 200, padL = 10, padR = 10, padT = 10, padB = 24;
  const innerW = width - padL - padR, innerH = height - padT - padB;

  series = series || [
    { key: "enrolled", label: "Enrolled", color: "#F2A93C" },
    { key: "locked", label: "Locked", color: "#D6414C" },
    { key: "unlocked", label: "Unlocked", color: "#0E9488" },
  ];
  const maxVal = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)));

  const xFor = (i) => padL + (data.length === 1 ? 0 : (i / (data.length - 1)) * innerW);
  const yFor = (v) => padT + innerH - (v / maxVal) * innerH;
  const lineFor = (key) => data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)},${yFor(d[key] || 0).toFixed(1)}`).join(" ");

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
  tourBtn: { background: "#FBF1E1", color: "#8A5A10", border: "1px solid #F2D9A8", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
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
