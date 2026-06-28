import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  addDoc, serverTimestamp, query, orderBy, updateDoc
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ========== CONSTANTS ==========
const APP_NAME = "المركز الاستشاري للمحاسبة";
const STATUSES = ["قيد الانتظار", "جاري العمل", "بانتظار العميل", "قيد المراجعة", "تم الإنجاز"];
const PRIORITIES = ["عالية", "متوسطة", "منخفضة"];
const DEFAULT_TAGS = ["ضرائب عامة", "ضرائب قيمة مضافة", "سفر", "مجلس مدينة", "تأمينات", "ميزانيات", "إقرارات"];
const TAG_COLORS = ["#60A5FA", "#34D399", "#A78BFA", "#F59E0B", "#F472B6", "#2DD4BF", "#FB923C", "#EF4444", "#22C55E", "#818CF8"];

const STATUS_COLOR = {
  "قيد الانتظار": "#60A5FA", "جاري العمل": "#F59E0B",
  "بانتظار العميل": "#F472B6", "قيد المراجعة": "#A78BFA", "تم الإنجاز": "#34D399",
};
const STATUS_BG = {
  "قيد الانتظار": "#1E3A5F", "جاري العمل": "#3B2A0E",
  "بانتظار العميل": "#3B1A2E", "قيد المراجعة": "#2D2060", "تم الإنجاز": "#1E4D3A",
};
const PRI_COLOR = { "عالية": "#EF4444", "متوسطة": "#F59E0B", "منخفضة": "#22C55E" };
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const DAYS_AR = ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];

function daysDiff(due) {
  if (!due) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(due); d.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}
function urgencyInfo(due) {
  const diff = daysDiff(due);
  if (diff === null) return null;
  if (diff < 0) return { label: "متأخرة", color: "#EF4444" };
  if (diff <= 3) return { label: `${diff} أيام`, color: "#F59E0B" };
  return null;
}

const s = {
  wrap: { minHeight: "100vh", background: "#0A0F1E", fontFamily: "'Cairo','Tajawal',sans-serif", direction: "rtl", color: "#E2E8F0" },
  header: { background: "#0F172A", borderBottom: "1px solid #1E3A5F", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  btnP: { background: "#2563EB", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13 },
  btnG: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13 },
  btnR: { background: "#2D1B1B", color: "#EF4444", border: "1px solid #EF444433", padding: "6px 12px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 12 },
  card: { background: "#0F172A", border: "1px solid #1E3A5F", borderRadius: 12, padding: 16 },
  input: { background: "#111827", border: "1px solid #1E3A5F", color: "#E2E8F0", padding: "9px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, width: "100%", outline: "none" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 },
  modal: { background: "#111827", border: "1px solid #1E3A5F", borderRadius: 16, padding: 24, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" },
};

const TABS = [
  { key: "dashboard", label: "📊 الإحصائيات" },
  { key: "board", label: "📋 المهام" },
  { key: "employees", label: "👥 الموظفون" },
  { key: "clients", label: "🏢 العملاء" },
  { key: "payments", label: "💰 المدفوعات" },
  { key: "activity", label: "📜 سجل النشاط" },
  { key: "calendar", label: "📅 التقويم" },
  { key: "reports", label: "📈 التقارير" },
];

// ========== LOGIN ==========
function LoginScreen({ onLogin, employees }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleLogin() {
    const emp = employees.find(e => e.username === username && e.password === password);
    if (emp) { onLogin(emp); setError(""); }
    else setError("اسم المستخدم أو كلمة السر غلط");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0F1E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ background: "#0F172A", border: "1px solid #1E3A5F", borderRadius: 16, padding: 32, width: 340 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#F1F5F9" }}>{APP_NAME}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>سجل دخول للمتابعة</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={s.input} placeholder="اسم المستخدم" value={username} onChange={e => setUsername(e.target.value)} />
          <input style={s.input} type="password" placeholder="كلمة السر" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
          {error && <div style={{ color: "#EF4444", fontSize: 12, textAlign: "center" }}>{error}</div>}
          <button style={{ ...s.btnP, padding: "10px", fontSize: 14 }} onClick={handleLogin}>دخول</button>
        </div>
      </div>
    </div>
  );
}

// ========== MAIN APP ==========
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [comments, setComments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tags, setTags] = useState(DEFAULT_TAGS);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [filterEmp, setFilterEmp] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [sortBy, setSortBy] = useState("due");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [newTag, setNewTag] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const fileInputRef = useRef(null);
  const storage = getStorage();

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "employees"), snap => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }));
    unsubs.push(onSnapshot(collection(db, "tasks"), snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "clients"), snap => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "payments"), snap => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(query(collection(db, "activity"), orderBy("time", "desc")), snap => setActivityLog(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "comments"), snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "tags"), snap => {
      if (snap.docs.length > 0) setTags(snap.docs.map(d => d.data().name));
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    if (!loading && employees.length === 0) {
      setDoc(doc(db, "employees", "admin"), { name: "المدير", username: "admin", password: "admin123", role: "admin", color: "#2563EB", photo: "" });
    }
  }, [loading, employees]);

  // إشعارات للمستخدم الحالي
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(query(collection(db, "notifications"), orderBy("time", "desc")), snap => {
      const myNotifs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(n => n.userId === currentUser.id || n.userId === "all");
      setNotifications(myNotifs);
    });
    return () => unsub();
  }, [currentUser]);

  async function logActivity(action, details) {
    await addDoc(collection(db, "activity"), { user: currentUser?.name || "مجهول", action, details, time: serverTimestamp() });
  }

  async function sendNotification(userId, message) {
    await addDoc(collection(db, "notifications"), { userId, message, read: false, time: serverTimestamp() });
  }

  async function markNotifRead(id) {
    await updateDoc(doc(db, "notifications", id), { read: true });
  }

  // ========== TASKS ==========
  async function saveTask() {
    if (!form.title?.trim()) return;
    const t = {
      title: form.title, empId: form.empId || "", clientId: form.clientId || "",
      status: form.status || "قيد الانتظار", priority: form.priority || "متوسطة",
      due: form.due || "", notes: form.notes || "", tags: form.tags || [],
      updatedBy: currentUser?.name, updatedAt: serverTimestamp()
    };
    if (form.id) {
      await updateDoc(doc(db, "tasks", form.id), t);
      await logActivity("تعديل مهمة", form.title);
      if (form.empId && form.empId !== currentUser?.id) await sendNotification(form.empId, `تم تعديل مهمتك: ${form.title}`);
    } else {
      await addDoc(collection(db, "tasks"), { ...t, createdBy: currentUser?.name, createdAt: serverTimestamp() });
      await logActivity("إضافة مهمة", form.title);
      if (form.empId && form.empId !== currentUser?.id) await sendNotification(form.empId, `تم تعيين مهمة جديدة لك: ${form.title}`);
    }
    setModal(null);
  }

  async function deleteTask(id, title) {
    await deleteDoc(doc(db, "tasks", id));
    await logActivity("حذف مهمة", title);
  }

  async function moveTask(id, status, title, empId) {
    await updateDoc(doc(db, "tasks", id), { status, updatedBy: currentUser?.name, updatedAt: serverTimestamp() });
    await logActivity("تغيير حالة", `${title} ← ${status}`);
    if (empId && empId !== currentUser?.id) await sendNotification(empId, `تم تغيير حالة مهمتك "${title}" إلى ${status}`);
  }

  async function transferTask(taskId, newEmpId, title) {
    const emp = employees.find(e => e.id === newEmpId);
    await updateDoc(doc(db, "tasks", taskId), { empId: newEmpId, updatedBy: currentUser?.name, updatedAt: serverTimestamp() });
    await logActivity("نقل مهمة", `${title} ← ${emp?.name}`);
    await sendNotification(newEmpId, `تم نقل مهمة إليك: ${title}`);
    setModal(null);
  }

  // ========== EMPLOYEES ==========
  async function saveEmp() {
    if (!form.name?.trim() || !form.username?.trim() || !form.password?.trim()) return;
    const e = { name: form.name, username: form.username, password: form.password, role: form.role || "employee", color: form.color || "#60A5FA", photo: form.photo || "" };
    if (form.id) {
      await updateDoc(doc(db, "employees", form.id), e);
      await logActivity("تعديل موظف", form.name);
    } else {
      await addDoc(collection(db, "employees"), e);
      await logActivity("إضافة موظف", form.name);
    }
    setModal(null);
  }

  async function deleteEmp(id, name) {
    await deleteDoc(doc(db, "employees", id));
    await logActivity("حذف موظف", name);
  }

  // ========== PROFILE ==========
  async function saveProfile() {
    if (!profileForm.name?.trim()) return;
    await updateDoc(doc(db, "employees", currentUser.id), {
      name: profileForm.name,
      password: profileForm.password || currentUser.password,
      photo: profileForm.photo || currentUser.photo || ""
    });
    setCurrentUser({ ...currentUser, name: profileForm.name, password: profileForm.password || currentUser.password, photo: profileForm.photo || currentUser.photo });
    setProfileModal(false);
  }

  async function uploadPhoto(file, type, id) {
    const storageRef = ref(storage, `${type}/${id}_${Date.now()}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  }

  // ========== CLIENTS ==========
  async function saveClient() {
    if (!form.name?.trim()) return;
    const c = { name: form.name, phone: form.phone || "", email: form.email || "", notes: form.notes || "" };
    if (form.id) {
      await updateDoc(doc(db, "clients", form.id), c);
      await logActivity("تعديل عميل", form.name);
    } else {
      await addDoc(collection(db, "clients"), c);
      await logActivity("إضافة عميل", form.name);
    }
    setModal(null);
  }

  async function deleteClient(id, name) {
    await deleteDoc(doc(db, "clients", id));
    await logActivity("حذف عميل", name);
  }

  // ========== PAYMENTS ==========
  async function savePayment() {
    if (!form.clientId || !form.amount) return;
    const p = {
      clientId: form.clientId, amount: parseFloat(form.amount),
      type: form.type || "كاش", status: form.status || "مدفوع",
      date: form.date || new Date().toISOString().split("T")[0],
      notes: form.notes || "", createdBy: currentUser?.name, createdAt: serverTimestamp()
    };
    if (form.id) {
      await updateDoc(doc(db, "payments", form.id), p);
    } else {
      await addDoc(collection(db, "payments"), p);
      await logActivity("إضافة مدفوعة", `${getClient(form.clientId)?.name} - ${form.amount} ج.م`);
    }
    setModal(null);
  }

  async function deletePayment(id) {
    await deleteDoc(doc(db, "payments", id));
  }

  // ========== COMMENTS ==========
  async function addComment(taskId, taskTitle, empId) {
    if (!newComment.trim()) return;
    await addDoc(collection(db, "comments"), { taskId, text: newComment, user: currentUser?.name, time: serverTimestamp() });
    if (empId && empId !== currentUser?.id) await sendNotification(empId, `تعليق جديد على مهمتك: ${taskTitle}`);
    setNewComment("");
  }

  // ========== TAGS ==========
  async function addNewTag() {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;
    await addDoc(collection(db, "tags"), { name: newTag.trim() });
    setNewTag("");
  }

  // ========== HELPERS ==========
  const getEmp = id => employees.find(e => e.id === id);
  const getClient = id => clients.find(c => c.id === id);
  const alerts = tasks.filter(t => t.status !== "تم الإنجاز" && t.due && daysDiff(t.due) <= 3);
  const unreadNotifs = notifications.filter(n => !n.read).length;

  const sortedClients = useMemo(() => {
    return [...clients]
      .filter(c => c.name?.includes(clientSearch))
      .sort((a, b) => a.name?.localeCompare(b.name, "ar"));
  }, [clients, clientSearch]);

  const filtered = useMemo(() => {
    let t = tasks;
    if (!isAdmin) t = t.filter(x => x.empId === currentUser?.id || true);
    if (filterEmp !== "all") t = t.filter(x => x.empId === filterEmp);
    if (filterTag !== "all") t = t.filter(x => x.tags && x.tags.includes(filterTag));
    if (search.trim()) t = t.filter(x => x.title?.includes(search.trim()));
    if (sortBy === "due") t = [...t].sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);
    if (sortBy === "priority") {
      const order = { "عالية": 0, "متوسطة": 1, "منخفضة": 2 };
      t = [...t].sort((a, b) => (order[a.priority] || 0) - (order[b.priority] || 0));
    }
    return t;
  }, [tasks, filterEmp, filterTag, search, sortBy, isAdmin, currentUser]);

  const byStatus = st => filtered.filter(t => t.status === st);

  function toggleTag(tag) {
    const tgs = form.tags || [];
    setForm({ ...form, tags: tgs.includes(tag) ? tgs.filter(t => t !== tag) : [...tgs, tag] });
  }

  function getCalendarDays() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return { days, year, month };
  }

  function getTasksForDay(year, month, day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return tasks.filter(t => t.due === dateStr);
  }

  function exportCSV() {
    const rows = [["العميل", "المبلغ", "النوع", "الحالة", "التاريخ", "ملاحظات"]];
    payments.forEach(p => {
      const client = getClient(p.clientId);
      rows.push([client?.name || "", p.amount, p.type, p.status, p.date, p.notes]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "payments.csv"; a.click();
  }

  function printReport() { window.print(); }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0A0F1E", display: "flex", alignItems: "center", justifyContent: "center", color: "#60A5FA", fontFamily: "'Cairo',sans-serif", fontSize: 18 }}>
      جاري التحميل...
    </div>
  );

  if (!currentUser) return <LoginScreen onLogin={emp => setCurrentUser(emp)} employees={employees} />;

  const { days, year, month } = getCalendarDays();

  const totalPayments = payments.reduce((sum, p) => sum + (p.status === "مدفوع" ? parseFloat(p.amount) || 0 : 0), 0);

  return (
    <div style={s.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #0A0F1E; } ::-webkit-scrollbar-thumb { background: #1E3A5F; border-radius: 3px; }
        .task-card { transition: all 0.2s; } .task-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
        select option { background: #111827; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {/* HEADER */}
      <div style={s.header} className="no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, background: "#2563EB", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📊</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#F1F5F9" }}>{APP_NAME}</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>أهلاً {currentUser.name} {isAdmin ? "👑" : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {alerts.length > 0 && <div style={{ background: "#2D1B0E", border: "1px solid #EF4444", color: "#EF4444", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>⚠️ {alerts.length}</div>}

          {/* زرار الإشعارات */}
          <div style={{ position: "relative" }}>
            <button style={{ ...s.btnG, padding: "8px 12px", position: "relative" }} onClick={() => setShowNotifications(!showNotifications)}>
              🔔 {unreadNotifs > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#EF4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadNotifs}</span>}
            </button>
            {showNotifications && (
              <div style={{ position: "absolute", top: 44, left: 0, background: "#111827", border: "1px solid #1E3A5F", borderRadius: 10, width: 280, maxHeight: 300, overflowY: "auto", zIndex: 300, padding: 8 }}>
                {notifications.length === 0 && <div style={{ color: "#64748B", fontSize: 12, textAlign: "center", padding: 12 }}>لا توجد إشعارات</div>}
                {notifications.slice(0, 10).map(n => (
                  <div key={n.id} onClick={() => markNotifRead(n.id)} style={{ padding: "8px 10px", borderRadius: 7, marginBottom: 4, background: n.read ? "transparent" : "#1E3A5F22", cursor: "pointer", borderRight: n.read ? "none" : "3px solid #2563EB" }}>
                    <div style={{ fontSize: 12, color: n.read ? "#64748B" : "#CBD5E1" }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>{n.time?.toDate ? n.time.toDate().toLocaleString("ar-EG") : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* زرار تحديث */}
          <button style={{ ...s.btnG, padding: "8px 12px" }} onClick={() => window.location.reload()} title="تحديث">🔄</button>

          {/* صورة الموظف */}
          <div onClick={() => { setProfileForm({ name: currentUser.name, password: "", photo: currentUser.photo }); setProfileModal(true); }} style={{ width: 34, height: 34, borderRadius: "50%", background: currentUser.color + "33", border: `2px solid ${currentUser.color}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}>
            {currentUser.photo ? <img src={currentUser.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: currentUser.color, fontWeight: 700, fontSize: 14 }}>{currentUser.name[0]}</span>}
          </div>

          <button style={s.btnP} onClick={() => { setForm({ title: "", empId: "", clientId: "", status: "قيد الانتظار", priority: "متوسطة", due: "", notes: "", tags: [] }); setModal("task"); }}>+ مهمة</button>
          {isAdmin && <button style={s.btnG} onClick={() => { setForm({ name: "", username: "", password: "", role: "employee", color: "#60A5FA", photo: "" }); setModal("emp"); }}>+ موظف</button>}
          {isAdmin && <button style={s.btnG} onClick={() => { setForm({ name: "", phone: "", email: "", notes: "" }); setModal("client"); }}>+ عميل</button>}
          <button style={s.btnG} onClick={() => { setForm({ clientId: "", amount: "", type: "كاش", status: "مدفوع", date: new Date().toISOString().split("T")[0], notes: "" }); setModal("payment"); }}>+ مدفوعة</button>
          <button style={s.btnR} onClick={() => setCurrentUser(null)}>خروج</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ padding: "12px 20px 0", display: "flex", gap: 6, flexWrap: "wrap" }} className="no-print">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "7px 14px", borderRadius: 8, border: tab === t.key ? "none" : "1px solid #1E3A5F",
            background: tab === t.key ? "#2563EB" : "rgba(255,255,255,0.05)",
            color: tab === t.key ? "#fff" : "#94A3B8", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 12
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "16px 20px" }}>

        {/* ===== DASHBOARD ===== */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "إجمالي المهام", val: tasks.length, color: "#60A5FA" },
                { label: "جاري العمل", val: tasks.filter(t => t.status === "جاري العمل").length, color: "#F59E0B" },
                { label: "تم الإنجاز", val: tasks.filter(t => t.status === "تم الإنجاز").length, color: "#34D399" },
                { label: "متأخرة", val: tasks.filter(t => t.status !== "تم الإنجاز" && t.due && daysDiff(t.due) < 0).length, color: "#EF4444" },
                { label: "الموظفون", val: employees.length, color: "#F472B6" },
                { label: "إجمالي المدفوعات", val: `${totalPayments.toLocaleString()} ج`, color: "#34D399" },
              ].map((st, i) => (
                <div key={i} style={{ background: "#0F172A", border: "1px solid #1E3A5F", borderRadius: 10, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: i === 5 ? 16 : 26, fontWeight: 900, color: st.color }}>{st.val}</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>{st.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
              <div style={s.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 14 }}>توزيع المهام</div>
                {STATUSES.map(st => {
                  const count = tasks.filter(t => t.status === st).length;
                  const pct = tasks.length ? Math.round(count / tasks.length * 100) : 0;
                  return (
                    <div key={st} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: STATUS_COLOR[st] }}>{st}</span>
                        <span style={{ color: "#64748B" }}>{count}</span>
                      </div>
                      <div style={{ background: "#1E293B", borderRadius: 4, height: 5 }}>
                        <div style={{ background: STATUS_COLOR[st], height: 5, borderRadius: 4, width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={s.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 14 }}>إنجاز الموظفين</div>
                {employees.map(e => {
                  const total = tasks.filter(t => t.empId === e.id).length;
                  const done = tasks.filter(t => t.empId === e.id && t.status === "تم الإنجاز").length;
                  const pct = total ? Math.round(done / total * 100) : 0;
                  return (
                    <div key={e.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#CBD5E1" }}>{e.name}</span>
                        <span style={{ color: e.color, fontWeight: 700 }}>{done}/{total}</span>
                      </div>
                      <div style={{ background: "#1E293B", borderRadius: 4, height: 5 }}>
                        <div style={{ background: e.color, height: 5, borderRadius: 4, width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={s.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 14 }}>⚠️ تنبيهات المواعيد</div>
                {alerts.length === 0 && <div style={{ color: "#334155", fontSize: 12, textAlign: "center", padding: "20px 0" }}>لا توجد تنبيهات</div>}
                {alerts.map(t => {
                  const info = urgencyInfo(t.due);
                  return (
                    <div key={t.id} style={{ background: "#1A0F0F", border: "1px solid #3B1F1F", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#FCA5A5", marginBottom: 4 }}>{t.title}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 11, color: info?.color, fontWeight: 700 }}>{info?.label}</span>
                        <span style={{ fontSize: 11, color: "#64748B" }}>📅 {t.due}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== BOARD ===== */}
        {tab === "board" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <input style={{ ...s.input, maxWidth: 180 }} placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} />
              <select style={{ ...s.input, width: "auto" }} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
                <option value="all">كل الموظفين</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <select style={{ ...s.input, width: "auto" }} value={filterTag} onChange={e => setFilterTag(e.target.value)}>
                <option value="all">كل التاغات</option>
                {tags.map(t => <option key={t}>{t}</option>)}
              </select>
              <select style={{ ...s.input, width: "auto" }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="due">ترتيب: التاريخ</option>
                <option value="priority">ترتيب: الأولوية</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
              {STATUSES.map(status => (
                <div key={status} style={{ ...s.card, minWidth: 240, flex: "0 0 240px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[status], display: "inline-block" }}></span>
                      <span style={{ fontWeight: 700, color: STATUS_COLOR[status], fontSize: 12 }}>{status}</span>
                    </div>
                    <span style={{ background: STATUS_BG[status], color: STATUS_COLOR[status], borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{byStatus(status).length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {byStatus(status).map(task => {
                      const emp = getEmp(task.empId);
                      const client = getClient(task.clientId);
                      const urg = urgencyInfo(task.due);
                      const taskComments = comments.filter(c => c.taskId === task.id);
                      const canEdit = isAdmin || task.empId === currentUser?.id;
                      return (
                        <div key={task.id} className="task-card" style={{ background: "#111827", border: `1px solid ${urg ? urg.color + "55" : "#1E293B"}`, borderRadius: 10, padding: 12, cursor: "pointer" }} onClick={() => setSelectedTask(task)}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.4, flex: 1 }}>{task.title}</span>
                            <span style={{ background: PRI_COLOR[task.priority] + "22", color: PRI_COLOR[task.priority], borderRadius: 5, padding: "1px 6px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{task.priority}</span>
                          </div>
                          {emp && (
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                              <div style={{ width: 18, height: 18, borderRadius: "50%", overflow: "hidden", background: emp.color + "33", border: `1.5px solid ${emp.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {emp.photo ? <img src={emp.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 9, color: emp.color, fontWeight: 700 }}>{emp.name[0]}</span>}
                              </div>
                              <span style={{ fontSize: 10, color: "#94A3B8" }}>{emp.name}</span>
                              {client && <span style={{ fontSize: 10, color: "#64748B" }}>• {client.name}</span>}
                            </div>
                          )}
                          {task.tags?.length > 0 && (
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 4 }}>
                              {task.tags.map((tg, i) => <span key={tg} style={{ color: TAG_COLORS[i % TAG_COLORS.length], background: TAG_COLORS[i % TAG_COLORS.length] + "11", border: `1px solid ${TAG_COLORS[i % TAG_COLORS.length]}44`, borderRadius: 4, padding: "1px 5px", fontSize: 9 }}>{tg}</span>)}
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              {task.due && <span style={{ fontSize: 9, color: urg ? urg.color : "#475569" }}>📅 {task.due}</span>}
                              {taskComments.length > 0 && <span style={{ fontSize: 9, color: "#64748B" }}>💬 {taskComments.length}</span>}
                            </div>
                          </div>
                          {canEdit && (
                            <div style={{ display: "flex", gap: 3, marginTop: 8, flexWrap: "wrap" }}>
                              {STATUSES.filter(s => s !== status).map(s => (
                                <button key={s} onClick={e => { e.stopPropagation(); moveTask(task.id, s, task.title, task.empId); }}
                                  style={{ background: STATUS_BG[s], color: STATUS_COLOR[s], border: "none", borderRadius: 4, padding: "2px 5px", fontSize: 8, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
                              ))}
                              <button onClick={e => { e.stopPropagation(); setForm({ ...task }); setModal("task"); }}
                                style={{ background: "#1E3A5F", color: "#60A5FA", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 9, cursor: "pointer" }}>✏️</button>
                              {isAdmin && <>
                                <button onClick={e => { e.stopPropagation(); setForm({ taskId: task.id, title: task.title, currentEmpId: task.empId }); setModal("transfer"); }}
                                  style={{ background: "#1E4D3A", color: "#34D399", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 9, cursor: "pointer" }}>نقل</button>
                                <button onClick={e => { e.stopPropagation(); deleteTask(task.id, task.title); }}
                                  style={{ background: "#2D1B1B", color: "#EF4444", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 9, cursor: "pointer" }}>🗑</button>
                              </>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {byStatus(status).length === 0 && <div style={{ color: "#334155", fontSize: 11, textAlign: "center", padding: "12px 0" }}>لا توجد مهام</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== EMPLOYEES ===== */}
        {tab === "employees" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
            {employees.map(emp => {
              const total = tasks.filter(t => t.empId === emp.id).length;
              const done = tasks.filter(t => t.empId === emp.id && t.status === "تم الإنجاز").length;
              const pct = total ? Math.round(done / total * 100) : 0;
              return (
                <div key={emp.id} style={{ ...s.card, border: `1px solid ${emp.color}33` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: emp.color + "22", border: `2px solid ${emp.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {emp.photo ? <img src={emp.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20, color: emp.color, fontWeight: 900 }}>{emp.name[0]}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{emp.name} {emp.role === "admin" ? "👑" : ""}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>@{emp.username}</div>
                    </div>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => { setForm({ ...emp }); setModal("emp"); }} style={{ background: "#1E3A5F", color: "#60A5FA", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                        <button onClick={() => deleteEmp(emp.id, emp.name)} style={{ background: "#2D1B1B", color: "#EF4444", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>🗑</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "#64748B" }}>الإنجاز</span>
                    <span style={{ fontSize: 11, color: emp.color, fontWeight: 700 }}>{done}/{total} ({pct}%)</span>
                  </div>
                  <div style={{ background: "#1E293B", borderRadius: 4, height: 5, marginBottom: 10 }}>
                    <div style={{ background: emp.color, height: 5, borderRadius: 4, width: `${pct}%` }}></div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {STATUSES.slice(0, 3).map(st => (
                      <div key={st} style={{ flex: 1, background: STATUS_BG[st], borderRadius: 5, padding: "4px 2px", textAlign: "center" }}>
                        <div style={{ color: STATUS_COLOR[st], fontSize: 13, fontWeight: 700 }}>{tasks.filter(t => t.empId === emp.id && t.status === st).length}</div>
                        <div style={{ color: STATUS_COLOR[st], fontSize: 8, opacity: 0.7 }}>{st.split(" ")[0]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== CLIENTS ===== */}
        {tab === "clients" && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <input style={{ ...s.input, maxWidth: 260 }} placeholder="🔍 ابحث بأول حرف..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
              {sortedClients.map(client => {
                const clientTasks = tasks.filter(t => t.clientId === client.id);
                const done = clientTasks.filter(t => t.status === "تم الإنجاز").length;
                const clientPayments = payments.filter(p => p.clientId === client.id);
                const totalPaid = clientPayments.filter(p => p.status === "مدفوع").reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                return (
                  <div key={client.id} style={s.card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1E3A5F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏢</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{client.name}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>{client.phone}</div>
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => setSelectedClient(client)} style={{ background: "#1E3A5F", color: "#60A5FA", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>📁</button>
                        {isAdmin && <>
                          <button onClick={() => { setForm({ ...client }); setModal("client"); }} style={{ background: "#1E3A5F", color: "#60A5FA", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                          <button onClick={() => deleteClient(client.id, client.name)} style={{ background: "#2D1B1B", color: "#EF4444", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>🗑</button>
                        </>}
                      </div>
                    </div>
                    {client.email && <div style={{ fontSize: 11, color: "#60A5FA", marginBottom: 8 }}>📧 {client.email}</div>}
                    <div style={{ display: "flex", gap: 10, fontSize: 12, marginBottom: 8 }}>
                      <span style={{ color: "#60A5FA" }}>📋 {clientTasks.length} مهمة</span>
                      <span style={{ color: "#34D399" }}>✅ {done} مكتملة</span>
                      <span style={{ color: "#F59E0B" }}>💰 {totalPaid.toLocaleString()} ج</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== PAYMENTS ===== */}
        {tab === "payments" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8" }}>💰 كشف المدفوعات</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={s.btnG} onClick={exportCSV}>📥 Excel</button>
                <button style={s.btnG} onClick={printReport}>🖨️ طباعة</button>
              </div>
            </div>

            {/* ملخص */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 16 }}>
              {[
                { label: "إجمالي المدفوعات", val: payments.filter(p => p.status === "مدفوع").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0), color: "#34D399" },
                { label: "جزئي", val: payments.filter(p => p.status === "جزئي").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0), color: "#F59E0B" },
                { label: "غير مدفوع", val: payments.filter(p => p.status === "لم يدفع").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0), color: "#EF4444" },
                { label: "عدد العمليات", val: payments.length, color: "#60A5FA" },
              ].map((st, i) => (
                <div key={i} style={{ background: "#0F172A", border: "1px solid #1E3A5F", borderRadius: 10, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: st.color }}>{typeof st.val === "number" && i < 3 ? `${st.val.toLocaleString()} ج` : st.val}</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>{st.label}</div>
                </div>
              ))}
            </div>

            {/* جدول المدفوعات */}
            <div style={s.card}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1E293B" }}>
                    {["العميل", "المبلغ", "النوع", "الحالة", "التاريخ", "بواسطة", ""].map((h, i) => (
                      <th key={i} style={{ padding: "8px 10px", color: "#64748B", fontWeight: 600, textAlign: "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.sort((a, b) => (b.date || "") > (a.date || "") ? 1 : -1).map(p => {
                    const client = getClient(p.clientId);
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid #0F172A" }}>
                        <td style={{ padding: "8px 10px", color: "#CBD5E1" }}>{client?.name || "-"}</td>
                        <td style={{ padding: "8px 10px", color: "#34D399", fontWeight: 700 }}>{parseFloat(p.amount).toLocaleString()} ج</td>
                        <td style={{ padding: "8px 10px", color: "#94A3B8" }}>{p.type}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ background: p.status === "مدفوع" ? "#1E4D3A" : p.status === "جزئي" ? "#3B2A0E" : "#2D1B1B", color: p.status === "مدفوع" ? "#34D399" : p.status === "جزئي" ? "#F59E0B" : "#EF4444", borderRadius: 5, padding: "2px 8px", fontSize: 11 }}>{p.status}</span>
                        </td>
                        <td style={{ padding: "8px 10px", color: "#64748B" }}>{p.date}</td>
                        <td style={{ padding: "8px 10px", color: "#64748B" }}>{p.createdBy}</td>
                        <td style={{ padding: "8px 10px" }}>
                          {isAdmin && <button onClick={() => deletePayment(p.id)} style={{ background: "#2D1B1B", color: "#EF4444", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>🗑</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {payments.length === 0 && <div style={{ color: "#334155", textAlign: "center", padding: 20, fontSize: 13 }}>لا توجد مدفوعات بعد</div>}
            </div>
          </div>
        )}

        {/* ===== ACTIVITY ===== */}
        {tab === "activity" && (
          <div style={s.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8", marginBottom: 16 }}>📜 سجل النشاط</div>
            {activityLog.length === 0 && <div style={{ color: "#334155", textAlign: "center", padding: 20 }}>لا يوجد نشاط بعد</div>}
            {activityLog.map(log => (
              <div key={log.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #1E293B" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1E3A5F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>👤</div>
                <div>
                  <div style={{ fontSize: 13, color: "#CBD5E1" }}>
                    <span style={{ color: "#60A5FA", fontWeight: 700 }}>{log.user}</span> — {log.action}
                    {log.details && <span style={{ color: "#94A3B8" }}> "{log.details}"</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{log.time?.toDate ? log.time.toDate().toLocaleString("ar-EG") : "الآن"}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== CALENDAR ===== */}
        {tab === "calendar" && (
          <div style={s.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => setCalendarDate(new Date(year, month - 1))} style={{ ...s.btnG, padding: "6px 12px" }}>◀</button>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#F1F5F9" }}>{MONTHS_AR[month]} {year}</div>
              <button onClick={() => setCalendarDate(new Date(year, month + 1))} style={{ ...s.btnG, padding: "6px 12px" }}>▶</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 8 }}>
              {DAYS_AR.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#64748B", padding: "4px 0" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {days.map((day, i) => {
                if (!day) return <div key={i}></div>;
                const dayTasks = getTasksForDay(year, month, day);
                const today = new Date();
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                return (
                  <div key={i} style={{ background: isToday ? "#1E3A5F" : "#111827", border: `1px solid ${isToday ? "#60A5FA" : "#1E293B"}`, borderRadius: 8, padding: "6px 4px", minHeight: 60 }}>
                    <div style={{ fontSize: 12, color: isToday ? "#60A5FA" : "#94A3B8", fontWeight: isToday ? 700 : 400, marginBottom: 4, textAlign: "center" }}>{day}</div>
                    {dayTasks.slice(0, 2).map(t => (
                      <div key={t.id} style={{ background: STATUS_COLOR[t.status] + "22", color: STATUS_COLOR[t.status], borderRadius: 3, padding: "1px 4px", fontSize: 9, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                    ))}
                    {dayTasks.length > 2 && <div style={{ fontSize: 9, color: "#64748B" }}>+{dayTasks.length - 2}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== REPORTS ===== */}
        {tab === "reports" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8" }}>📈 التقارير</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={s.btnG} onClick={exportCSV}>📥 Excel</button>
                <button style={s.btnG} onClick={printReport}>🖨️ PDF / طباعة</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
              <div style={s.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 14 }}>أداء الموظفين</div>
                {employees.map(e => {
                  const total = tasks.filter(t => t.empId === e.id).length;
                  const done = tasks.filter(t => t.empId === e.id && t.status === "تم الإنجاز").length;
                  const late = tasks.filter(t => t.empId === e.id && t.status !== "تم الإنجاز" && t.due && daysDiff(t.due) < 0).length;
                  return (
                    <div key={e.id} style={{ marginBottom: 12, padding: 10, background: "#111827", borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ color: "#CBD5E1", fontWeight: 600 }}>{e.name}</span>
                        <span style={{ color: e.color, fontSize: 12 }}>{total} مهمة</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                        <span style={{ color: "#34D399" }}>✅ {done}</span>
                        <span style={{ color: "#EF4444" }}>⏰ {late} متأخرة</span>
                        <span style={{ color: "#F59E0B" }}>🔄 {total - done} جارية</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={s.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 14 }}>المدفوعات حسب العميل</div>
                {sortedClients.map(c => {
                  const clientPayments = payments.filter(p => p.clientId === c.id);
                  const totalPaid = clientPayments.filter(p => p.status === "مدفوع").reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                  const pending = clientPayments.filter(p => p.status !== "مدفوع").reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                  if (clientPayments.length === 0) return null;
                  return (
                    <div key={c.id} style={{ marginBottom: 10, padding: 8, background: "#111827", borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, color: "#CBD5E1", marginBottom: 4, fontSize: 12 }}>{c.name}</div>
                      <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                        <span style={{ color: "#34D399" }}>مدفوع: {totalPaid.toLocaleString()} ج</span>
                        {pending > 0 && <span style={{ color: "#EF4444" }}>متبقي: {pending.toLocaleString()} ج</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={s.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 14 }}>المهام حسب التاغ</div>
                {tags.map((tg, i) => {
                  const count = tasks.filter(t => t.tags?.includes(tg)).length;
                  if (count === 0) return null;
                  return (
                    <div key={tg} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                      <span style={{ color: TAG_COLORS[i % TAG_COLORS.length], fontSize: 12 }}>{tg}</span>
                      <span style={{ color: "#94A3B8", fontSize: 12 }}>{count} مهمة</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== TASK DETAIL ===== */}
      {selectedTask && (
        <div style={s.overlay} onClick={() => setSelectedTask(null)}>
          <div style={{ ...s.modal, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", margin: 0, flex: 1 }}>{selectedTask.title}</h3>
              <button onClick={() => setSelectedTask(null)} style={{ background: "none", border: "none", color: "#64748B", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ background: STATUS_BG[selectedTask.status], color: STATUS_COLOR[selectedTask.status], borderRadius: 6, padding: "3px 10px", fontSize: 12 }}>{selectedTask.status}</span>
              <span style={{ background: PRI_COLOR[selectedTask.priority] + "22", color: PRI_COLOR[selectedTask.priority], borderRadius: 6, padding: "3px 10px", fontSize: 12 }}>{selectedTask.priority}</span>
              {selectedTask.due && <span style={{ color: "#64748B", fontSize: 12 }}>📅 {selectedTask.due}</span>}
            </div>
            {selectedTask.notes && <div style={{ background: "#0F172A", borderRadius: 8, padding: 10, fontSize: 12, color: "#94A3B8", marginBottom: 12 }}>{selectedTask.notes}</div>}
            {selectedTask.createdBy && <div style={{ fontSize: 11, color: "#475569", marginBottom: 12 }}>أضافها: {selectedTask.createdBy} • آخر تعديل: {selectedTask.updatedBy || "-"}</div>}
            <div style={{ borderTop: "1px solid #1E293B", paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 10 }}>💬 التعليقات</div>
              <div style={{ maxHeight: 160, overflowY: "auto", marginBottom: 10 }}>
                {comments.filter(c => c.taskId === selectedTask.id).map(c => (
                  <div key={c.id} style={{ background: "#0F172A", borderRadius: 8, padding: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: "#60A5FA", fontWeight: 700, marginBottom: 2 }}>{c.user}</div>
                    <div style={{ fontSize: 12, color: "#CBD5E1" }}>{c.text}</div>
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{c.time?.toDate ? c.time.toDate().toLocaleString("ar-EG") : ""}</div>
                  </div>
                ))}
                {comments.filter(c => c.taskId === selectedTask.id).length === 0 && <div style={{ color: "#334155", fontSize: 12 }}>لا توجد تعليقات بعد</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...s.input, flex: 1 }} placeholder="اكتب تعليق..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment(selectedTask.id, selectedTask.title, selectedTask.empId)} />
                <button style={s.btnP} onClick={() => addComment(selectedTask.id, selectedTask.title, selectedTask.empId)}>إرسال</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== CLIENT DETAIL ===== */}
      {selectedClient && (
        <div style={s.overlay} onClick={() => setSelectedClient(null)}>
          <div style={{ ...s.modal, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", margin: 0 }}>📁 ملف {selectedClient.name}</h3>
              <button onClick={() => setSelectedClient(null)} style={{ background: "none", border: "none", color: "#64748B", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
              {selectedClient.phone && <div>📞 {selectedClient.phone}</div>}
              {selectedClient.email && <div>📧 {selectedClient.email}</div>}
              {selectedClient.notes && <div style={{ marginTop: 6, color: "#94A3B8" }}>{selectedClient.notes}</div>}
            </div>

            {/* سجل الأعمال */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 8 }}>📋 سجل الأعمال</div>
              {tasks.filter(t => t.clientId === selectedClient.id).map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#0F172A", borderRadius: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#CBD5E1", fontWeight: 600 }}>{t.title}</div>
                    <div style={{ fontSize: 10, color: "#64748B" }}>{getEmp(t.empId)?.name} • {t.due}</div>
                  </div>
                  <span style={{ background: STATUS_BG[t.status], color: STATUS_COLOR[t.status], borderRadius: 5, padding: "2px 8px", fontSize: 11 }}>{t.status}</span>
                </div>
              ))}
              {tasks.filter(t => t.clientId === selectedClient.id).length === 0 && <div style={{ color: "#334155", fontSize: 12 }}>لا توجد مهام</div>}
            </div>

            {/* سجل المدفوعات */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 8 }}>💰 سجل المدفوعات</div>
              {payments.filter(p => p.clientId === selectedClient.id).map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#0F172A", borderRadius: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#34D399", fontWeight: 700 }}>{parseFloat(p.amount).toLocaleString()} ج</div>
                    <div style={{ fontSize: 10, color: "#64748B" }}>{p.type} • {p.date}</div>
                  </div>
                  <span style={{ background: p.status === "مدفوع" ? "#1E4D3A" : "#2D1B1B", color: p.status === "مدفوع" ? "#34D399" : "#EF4444", borderRadius: 5, padding: "2px 8px", fontSize: 11 }}>{p.status}</span>
                </div>
              ))}
              {payments.filter(p => p.clientId === selectedClient.id).length === 0 && <div style={{ color: "#334155", fontSize: 12 }}>لا توجد مدفوعات</div>}

              <div style={{ marginTop: 10, padding: 10, background: "#0F172A", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94A3B8", fontSize: 12 }}>إجمالي المدفوع</span>
                <span style={{ color: "#34D399", fontWeight: 700, fontSize: 14 }}>
                  {payments.filter(p => p.clientId === selectedClient.id && p.status === "مدفوع").reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0).toLocaleString()} ج
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== PROFILE MODAL ===== */}
      {profileModal && (
        <div style={s.overlay} onClick={() => setProfileModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#F1F5F9" }}>⚙️ إعدادات حسابي</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 70, height: 70, borderRadius: "50%", overflow: "hidden", background: currentUser.color + "33", border: `2px solid ${currentUser.color}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
                  {profileForm.photo ? <img src={profileForm.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 28, color: currentUser.color, fontWeight: 900 }}>{currentUser.name[0]}</span>}
                </div>
                <button style={{ ...s.btnG, fontSize: 11, padding: "4px 12px" }} onClick={() => fileInputRef.current?.click()}>تغيير الصورة</button>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                  const file = e.target.files[0];
                  if (file) {
                    const url = await uploadPhoto(file, "employees", currentUser.id);
                    setProfileForm({ ...profileForm, photo: url });
                  }
                }} />
              </div>
              <input style={s.input} placeholder="الاسم *" value={profileForm.name || ""} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
              <input style={s.input} type="password" placeholder="كلمة السر الجديدة (اتركها فارغة لو مش عايز تغيرها)" value={profileForm.password || ""} onChange={e => setProfileForm({ ...profileForm, password: e.target.value })} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={s.btnG} onClick={() => setProfileModal(false)}>إلغاء</button>
                <button style={s.btnP} onClick={saveProfile}>حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TASK FORM ===== */}
      {modal === "task" && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#F1F5F9" }}>{form.id ? "✏️ تعديل المهمة" : "➕ مهمة جديدة"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={s.input} placeholder="عنوان المهمة *" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} />
              <select style={s.input} value={form.empId || ""} onChange={e => setForm({ ...form, empId: e.target.value })}>
                <option value="">-- اختر موظف --</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <select style={s.input} value={form.clientId || ""} onChange={e => setForm({ ...form, clientId: e.target.value })}>
                <option value="">-- بدون عميل --</option>
                {sortedClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select style={s.input} value={form.status || "قيد الانتظار"} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map(st => <option key={st}>{st}</option>)}
                </select>
                <select style={s.input} value={form.priority || "متوسطة"} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <input type="date" style={s.input} value={form.due || ""} onChange={e => setForm({ ...form, due: e.target.value })} />
              <div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>التاغات:</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                  {tags.map((tg, i) => (
                    <span key={tg} onClick={() => toggleTag(tg)} style={{ display: "inline-flex", alignItems: "center", borderRadius: 5, padding: "3px 9px", fontSize: 11, cursor: "pointer", border: "1px solid", color: TAG_COLORS[i % TAG_COLORS.length], borderColor: TAG_COLORS[i % TAG_COLORS.length] + (form.tags?.includes(tg) ? "" : "44"), background: TAG_COLORS[i % TAG_COLORS.length] + (form.tags?.includes(tg) ? "33" : "11") }}>{tg}</span>
                  ))}
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input style={{ ...s.input, flex: 1 }} placeholder="تاغ جديد..." value={newTag} onChange={e => setNewTag(e.target.value)} />
                    <button style={{ ...s.btnP, padding: "6px 12px", fontSize: 12 }} onClick={addNewTag}>+ إضافة</button>
                  </div>
                )}
              </div>
              <textarea rows={2} style={s.input} placeholder="ملاحظات" value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={s.btnG} onClick={() => setModal(null)}>إلغاء</button>
                <button style={s.btnP} onClick={saveTask}>حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TRANSFER TASK ===== */}
      {modal === "transfer" && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={{ ...s.modal, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#F1F5F9" }}>🔄 نقل المهمة</h3>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 12 }}>"{form.title}"</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select style={s.input} value={form.newEmpId || ""} onChange={e => setForm({ ...form, newEmpId: e.target.value })}>
                <option value="">-- اختر موظف --</option>
                {employees.filter(e => e.id !== form.currentEmpId).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={s.btnG} onClick={() => setModal(null)}>إلغاء</button>
                <button style={s.btnP} onClick={() => form.newEmpId && transferTask(form.taskId, form.newEmpId, form.title)}>نقل</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== EMPLOYEE FORM ===== */}
      {modal === "emp" && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#F1F5F9" }}>{form.id ? "✏️ تعديل موظف" : "👤 موظف جديد"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={s.input} placeholder="الاسم *" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input style={s.input} placeholder="اسم المستخدم *" value={form.username || ""} onChange={e => setForm({ ...form, username: e.target.value })} />
              <input style={s.input} type="password" placeholder="كلمة السر *" value={form.password || ""} onChange={e => setForm({ ...form, password: e.target.value })} />
              <select style={s.input} value={form.role || "employee"} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="employee">موظف عادي</option>
                <option value="admin">Admin 👑</option>
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ color: "#94A3B8", fontSize: 12 }}>اللون:</label>
                <input type="color" value={form.color || "#60A5FA"} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 44, height: 32, padding: 2, background: "none", border: "1px solid #1E3A5F", borderRadius: 6, cursor: "pointer" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={s.btnG} onClick={() => setModal(null)}>إلغاء</button>
                <button style={s.btnP} onClick={saveEmp}>حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== CLIENT FORM ===== */}
      {modal === "client" && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#F1F5F9" }}>{form.id ? "✏️ تعديل عميل" : "🏢 عميل جديد"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={s.input} placeholder="اسم العميل *" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input style={s.input} placeholder="رقم الهاتف" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input style={s.input} placeholder="البريد الإلكتروني" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} />
              <textarea rows={2} style={s.input} placeholder="ملاحظات" value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={s.btnG} onClick={() => setModal(null)}>إلغاء</button>
                <button style={s.btnP} onClick={saveClient}>حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== PAYMENT FORM ===== */}
      {modal === "payment" && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#F1F5F9" }}>💰 إضافة مدفوعة</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select style={s.input} value={form.clientId || ""} onChange={e => setForm({ ...form, clientId: e.target.value })}>
                <option value="">-- اختر عميل --</option>
                {sortedClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input style={s.input} type="number" placeholder="المبلغ (ج.م) *" value={form.amount || ""} onChange={e => setForm({ ...form, amount: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select style={s.input} value={form.type || "كاش"} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option>كاش</option>
                  <option>تحويل بنكي</option>
                  <option>شيك</option>
                </select>
                <select style={s.input} value={form.status || "مدفوع"} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option>مدفوع</option>
                  <option>جزئي</option>
                  <option>لم يدفع</option>
                </select>
              </div>
              <input type="date" style={s.input} value={form.date || ""} onChange={e => setForm({ ...form, date: e.target.value })} />
              <textarea rows={2} style={s.input} placeholder="ملاحظات" value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={s.btnG} onClick={() => setModal(null)}>إلغاء</button>
                <button style={s.btnP} onClick={savePayment}>حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
