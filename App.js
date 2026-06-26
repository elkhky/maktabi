import { useState, useEffect, useRef, useMemo } from "react";

const STATUSES = ["جديدة", "جارية", "مكتملة"];
const PRIORITIES = ["عالية", "متوسطة", "منخفضة"];
const STATUS_BG = { "جديدة": "#1E3A5F", "جارية": "#1E4D3A", "مكتملة": "#2D2060" };
const STATUS_TEXT = { "جديدة": "#60A5FA", "جارية": "#34D399", "مكتملة": "#A78BFA" };
const PRI_COLOR = { "عالية": "#EF4444", "متوسطة": "#F59E0B", "منخفضة": "#22C55E" };
const ALL_TAGS = ["ضرائب", "رواتب", "عملاء", "ميزانية", "تقارير", "بنوك"];
const TAG_COLORS = ["#60A5FA", "#34D399", "#A78BFA", "#F59E0B", "#F472B6", "#2DD4BF"];

const defaultData = {
  employees: [
    { id: 1, name: "أحمد محمد", role: "محاسب أول", color: "#2DD4BF" },
    { id: 2, name: "سارة علي", role: "محاسب", color: "#F472B6" },
    { id: 3, name: "محمود حسن", role: "مساعد محاسب", color: "#FB923C" },
  ],
  clients: [
    { id: 1, name: "شركة النور", phone: "01000000001", email: "nour@co.com" },
    { id: 2, name: "أبو عمر للتجارة", phone: "01000000002", email: "aboomar@co.com" },
  ],
  tasks: [
    { id: 1, title: "إعداد الميزانية الشهرية", empId: 1, clientId: 1, status: "جارية", priority: "عالية", due: "2026-06-10", notes: "مراجعة أرقام مايو", tags: ["ميزانية"] },
    { id: 2, title: "مراجعة ضرائب العميل أبو عمر", empId: 2, clientId: 2, status: "جديدة", priority: "متوسطة", due: "2026-06-15", notes: "", tags: ["ضرائب", "عملاء"] },
    { id: 3, title: "تحديث سجلات الرواتب", empId: 3, clientId: null, status: "مكتملة", priority: "منخفضة", due: "2026-06-05", notes: "تم", tags: ["رواتب"] },
    { id: 4, title: "تقرير الأرباح والخسائر", empId: 1, clientId: 1, status: "جديدة", priority: "عالية", due: "2026-06-20", notes: "", tags: ["تقارير"] },
    { id: 5, title: "متابعة مستحقات العملاء", empId: 2, clientId: 2, status: "جارية", priority: "متوسطة", due: "2026-06-12", notes: "", tags: ["عملاء"] },
  ],
  nextId: 20,
};

const LS_KEY = "acc_office_v2";

function loadData() {
  try {
    const d = localStorage.getItem(LS_KEY);
    return d ? JSON.parse(d) : defaultData;
  } catch {
    return defaultData;
  }
}

function saveData(d) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {}
}

function daysDiff(due) {
  if (!due) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

function urgencyInfo(due) {
  const diff = daysDiff(due);
  if (diff === null) return null;
  if (diff < 0) return { label: "متأخرة", color: "#EF4444" };
  if (diff <= 3) return { label: `${diff} أيام`, color: "#F59E0B" };
  return null;
}

const TABS = [
  { key: "dashboard", label: "📊 الإحصائيات" },
  { key: "board", label: "📋 المهام" },
  { key: "employees", label: "👥 الموظفون" },
  { key: "clients", label: "🏢 العملاء" },
];

function App() {
  const [data, setData] = useState(loadData);
  const { employees, clients, tasks } = data;
  const [tab, setTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [filterEmp, setFilterEmp] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [sortBy, setSortBy] = useState("due");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  function update(patch) {
    setData(prev => {
      const n = { ...prev, ...patch };
      saveData(n);
      return n;
    });
  }

  const filtered = useMemo(() => {
    let t = tasks;
    if (filterEmp !== "all") t = t.filter(x => x.empId === parseInt(filterEmp));
    if (filterTag !== "all") t = t.filter(x => x.tags && x.tags.includes(filterTag));
    if (search.trim()) t = t.filter(x => x.title.includes(search.trim()));
    if (sortBy === "due") t = [...t].sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);
    if (sortBy === "priority") {
      const order = { "عالية": 0, "متوسطة": 1, "منخفضة": 2 };
      t = [...t].sort((a, b) => order[a.priority] - order[b.priority]);
    }
    return t;
  }, [tasks, filterEmp, filterTag, search, sortBy]);

  const byStatus = s => filtered.filter(t => t.status === s);
  const getEmp = id => employees.find(e => e.id === id);
  const getClient = id => clients.find(c => c.id === id);
  const alerts = tasks.filter(t => t.status !== "مكتملة" && t.due && daysDiff(t.due) <= 3);

  function openAdd(type) {
    if (type === "task") setForm({ title: "", empId: employees[0]?.id || 1, clientId: "", status: "جديدة", priority: "متوسطة", due: "", notes: "", tags: [] });
    if (type === "emp") setForm({ name: "", role: "", color: "#60A5FA" });
    if (type === "client") setForm({ name: "", phone: "", email: "", notes: "" });
    setModal({ type, mode: "add" });
  }

  function openEdit(task) { setForm({ ...task }); setModal({ type: "task", mode: "edit" }); }

  function saveTask() {
    if (!form.title?.trim()) return;
    const t = { ...form, id: form.id || data.nextId, empId: parseInt(form.empId), clientId: form.clientId ? parseInt(form.clientId) : null, tags: form.tags || [] };
    const exists = tasks.find(x => x.id === t.id);
    update({ tasks: exists ? tasks.map(x => x.id === t.id ? t : x) : [...tasks, t], nextId: exists ? data.nextId : data.nextId + 1 });
    setModal(null);
  }

  function saveEmp() {
    if (!form.name?.trim()) return;
    update({ employees: [...employees, { ...form, id: data.nextId }], nextId: data.nextId + 1 });
    setModal(null);
  }

  function saveClient() {
    if (!form.name?.trim()) return;
    update({ clients: [...clients, { ...form, id: data.nextId }], nextId: data.nextId + 1 });
    setModal(null);
  }

  function deleteTask(id) { update({ tasks: tasks.filter(t => t.id !== id) }); }
  function moveTask(id, status) { update({ tasks: tasks.map(t => t.id === id ? { ...t, status } : t) }); }
  function toggleTag(tag) {
    const tags = form.tags || [];
    setForm({ ...form, tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] });
  }

  const s = {
    wrap: { minHeight: "100vh", background: "#0A0F1E", fontFamily: "'Cairo', 'Tajawal', sans-serif", direction: "rtl", color: "#E2E8F0" },
    header: { background: "#0F172A", borderBottom: "1px solid #1E3A5F", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
    logo: { width: 38, height: 38, background: "#2563EB", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 },
    btnPrimary: { background: "#2563EB", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13 },
    btnGhost: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13 },
    card: { background: "#0F172A", border: "1px solid #1E3A5F", borderRadius: 12, padding: 16 },
    statCard: { background: "#0F172A", border: "1px solid #1E3A5F", borderRadius: 10, padding: 14, textAlign: "center" },
    input: { background: "#111827", border: "1px solid #1E3A5F", color: "#E2E8F0", padding: "9px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, width: "100%", outline: "none" },
    modal: { background: "#111827", border: "1px solid #1E3A5F", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440 },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 },
  };

  return (
    <div style={s.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0A0F1E; }
        ::-webkit-scrollbar-thumb { background: #1E3A5F; border-radius: 3px; }
        .task-card { background: #111827; border: 1px solid #1E293B; border-radius: 10px; padding: 12px; cursor: pointer; transition: all 0.2s; }
        .task-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
        select option { background: #111827; }
      `}</style>

      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={s.logo}>📊</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, color: "#F1F5F9" }}>مكتب المحاسبة</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>نظام إدارة متكامل</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {alerts.length > 0 && (
            <div style={{ background: "#2D1B0E", border: "1px solid #EF4444", color: "#EF4444", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
              ⚠️ {alerts.length} مهمة تستحق التنبيه
            </div>
          )}
          <button style={s.btnPrimary} onClick={() => openAdd("task")}>+ مهمة</button>
          <button style={s.btnGhost} onClick={() => openAdd("emp")}>+ موظف</button>
          <button style={s.btnGhost} onClick={() => openAdd("client")}>+ عميل</button>
        </div>
      </div>

      <div style={{ padding: "12px 20px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 18px", borderRadius: 8, border: tab === t.key ? "none" : "1px solid #1E3A5F",
            background: tab === t.key ? "#2563EB" : "rgba(255,255,255,0.05)",
            color: tab === t.key ? "#fff" : "#94A3B8",
            cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "16px 20px" }}>

        {tab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "إجمالي المهام", val: tasks.length, color: "#60A5FA" },
                { label: "جارية", val: tasks.filter(t => t.status === "جارية").length, color: "#34D399" },
                { label: "مكتملة", val: tasks.filter(t => t.status === "مكتملة").length, color: "#A78BFA" },
                { label: "عالية الأولوية", val: tasks.filter(t => t.priority === "عالية" && t.status !== "مكتملة").length, color: "#EF4444" },
                { label: "متأخرة", val: tasks.filter(t => t.status !== "مكتملة" && t.due && daysDiff(t.due) < 0).length, color: "#F59E0B" },
                { label: "الموظفون", val: employees.length, color: "#F472B6" },
              ].map((st, i) => (
                <div key={i} style={s.statCard}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: st.color }}>{st.val}</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>{st.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
              <div style={s.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 14 }}>توزيع المهام حسب الحالة</div>
                {STATUSES.map(st => {
                  const count = tasks.filter(t => t.status === st).length;
                  const pct = tasks.length ? Math.round(count / tasks.length * 100) : 0;
                  return (
                    <div key={st} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: STATUS_TEXT[st] }}>{st}</span>
                        <span style={{ color: "#94A3B8" }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ background: "#1E293B", borderRadius: 4, height: 6 }}>
                        <div style={{ background: STATUS_TEXT[st], height: 6, borderRadius: 4, width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={s.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 14 }}>إنجاز الموظفين</div>
                {employees.map(e => {
                  const total = tasks.filter(t => t.empId === e.id).length;
                  const done = tasks.filter(t => t.empId === e.id && t.status === "مكتملة").length;
                  const pct = total ? Math.round(done / total * 100) : 0;
                  return (
                    <div key={e.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#CBD5E1" }}>{e.name}</span>
                        <span style={{ color: e.color, fontWeight: 700 }}>{done}/{total} ({pct}%)</span>
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
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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

        {tab === "board" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input style={{ ...s.input, maxWidth: 180 }} placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} />
              <select style={{ ...s.input, width: "auto" }} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
                <option value="all">كل الموظفين</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <select style={{ ...s.input, width: "auto" }} value={filterTag} onChange={e => setFilterTag(e.target.value)}>
                <option value="all">كل التاغات</option>
                {ALL_TAGS.map(t => <option key={t}>{t}</option>)}
              </select>
              <select style={{ ...s.input, width: "auto" }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="due">ترتيب: التاريخ</option>
                <option value="priority">ترتيب: الأولوية</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              {STATUSES.map(status => (
                <div key={status} style={s.card}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_TEXT[status], display: "inline-block" }}></span>
                      <span style={{ fontWeight: 700, color: STATUS_TEXT[status], fontSize: 14 }}>{status}</span>
                    </div>
                    <span style={{ background: STATUS_BG[status], color: STATUS_TEXT[status], borderRadius: 20, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{byStatus(status).length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {byStatus(status).map(task => {
                      const emp = getEmp(task.empId);
                      const client = getClient(task.clientId);
                      const urg = urgencyInfo(task.due);
                      return (
                        <div key={task.id} className="task-card" onClick={() => openEdit(task)} style={{ borderColor: urg ? urg.color + "55" : "#1E293B" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.4, flex: 1 }}>{task.title}</span>
                            <span style={{ background: PRI_COLOR[task.priority] + "22", color: PRI_COLOR[task.priority], borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{task.priority}</span>
                          </div>
                          {emp && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                              <div style={{ width: 20, height: 20, borderRadius: "50%", background: emp.color + "33", border: `1.5px solid ${emp.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: emp.color, fontWeight: 700 }}>{emp.name[0]}</div>
                              <span style={{ fontSize: 11, color: "#94A3B8" }}>{emp.name}</span>
                              {client && <span style={{ fontSize: 11, color: "#64748B" }}>• {client.name}</span>}
                            </div>
                          )}
                          {task.tags?.length > 0 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
                              {task.tags.map((tg, i) => (
                                <span key={tg} style={{ display: "inline-flex", alignItems: "center", borderRadius: 5, padding: "2px 7px", fontSize: 11, border: "1px solid", color: TAG_COLORS[i % TAG_COLORS.length], borderColor: TAG_COLORS[i % TAG_COLORS.length] + "44", background: TAG_COLORS[i % TAG_COLORS.length] + "11" }}>{tg}</span>
                              ))}
                            </div>
                          )}
                          {task.due && <div style={{ fontSize: 10, color: urg ? urg.color : "#475569", marginBottom: 6 }}>📅 {task.due} {urg ? `(${urg.label})` : ""}</div>}
                          <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                            {STATUSES.filter(s => s !== status).map(s => (
                              <button key={s} onClick={e => { e.stopPropagation(); moveTask(task.id, s); }}
                                style={{ background: STATUS_BG[s], color: STATUS_TEXT[s], border: "none", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
                            ))}
                            <button onClick={e => { e.stopPropagation(); deleteTask(task.id); }}
                              style={{ background: "#2D1B1B", color: "#EF4444", border: "none", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}>🗑</button>
                          </div>
                        </div>
                      );
                    })}
                    {byStatus(status).length === 0 && <div style={{ color: "#334155", fontSize: 12, textAlign: "center", padding: "16px 0" }}>لا توجد مهام</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "employees" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
            {employees.map(emp => {
              const total = tasks.filter(t => t.empId === emp.id).length;
              const done = tasks.filter(t => t.empId === emp.id && t.status === "مكتملة").length;
              const pct = total ? Math.round(done / total * 100) : 0;
              const empTasks = tasks.filter(t => t.empId === emp.id);
              return (
                <div key={emp.id} style={{ ...s.card, border: `1px solid ${emp.color}33` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: emp.color + "22", border: `2px solid ${emp.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: emp.color, fontWeight: 900 }}>{emp.name[0]}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{emp.name}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{emp.role}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "#64748B" }}>الإنجاز</span>
                    <span style={{ fontSize: 11, color: emp.color, fontWeight: 700 }}>{done}/{total} ({pct}%)</span>
                  </div>
                  <div style={{ background: "#1E293B", borderRadius: 4, height: 5, marginBottom: 12 }}>
                    <div style={{ background: emp.color, height: 5, borderRadius: 4, width: `${pct}%` }}></div>
                  </div>
                  <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                    {STATUSES.map(st => (
                      <div key={st} style={{ flex: 1, background: STATUS_BG[st], borderRadius: 6, padding: "5px 3px", textAlign: "center" }}>
                        <div style={{ color: STATUS_TEXT[st], fontSize: 14, fontWeight: 700 }}>{empTasks.filter(t => t.status === st).length}</div>
                        <div style={{ color: STATUS_TEXT[st], fontSize: 9, opacity: 0.7 }}>{st}</div>
                      </div>
                    ))}
                  </div>
                  {empTasks.slice(0, 3).map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: PRI_COLOR[t.priority], flexShrink: 0 }}></span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.title}</span>
                      <span style={{ color: STATUS_TEXT[t.status], flexShrink: 0, fontSize: 10 }}>{t.status}</span>
                    </div>
                  ))}
                  {empTasks.length > 3 && <div style={{ fontSize: 10, color: "#475569" }}>+{empTasks.length - 3} مهام أخرى</div>}
                </div>
              );
            })}
          </div>
        )}

        {tab === "clients" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
            {clients.map(client => {
              const clientTasks = tasks.filter(t => t.clientId === client.id);
              const done = clientTasks.filter(t => t.status === "مكتملة").length;
              return (
                <div key={client.id} style={s.card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1E3A5F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏢</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{client.name}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{client.phone}</div>
                    </div>
                  </div>
                  {client.email && <div style={{ fontSize: 11, color: "#60A5FA", marginBottom: 10 }}>📧 {client.email}</div>}
                  <div style={{ borderTop: "1px solid #1E293B", paddingTop: 10 }}>
                    <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6 }}>المهام: {clientTasks.length} (مكتملة: {done})</div>
                    {clientTasks.slice(0, 3).map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>
                        <span style={{ color: STATUS_TEXT[t.status], fontSize: 9 }}>●</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                      </div>
                    ))}
                    {clientTasks.length > 3 && <div style={{ fontSize: 10, color: "#475569" }}>+{clientTasks.length - 3} مهام أخرى</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal?.type === "task" && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#F1F5F9" }}>{modal.mode === "add" ? "➕ مهمة جديدة" : "✏️ تعديل المهمة"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={s.input} placeholder="عنوان المهمة *" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} />
              <select style={s.input} value={form.empId || ""} onChange={e => setForm({ ...form, empId: e.target.value })}>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <select style={s.input} value={form.clientId || ""} onChange={e => setForm({ ...form, clientId: e.target.value })}>
                <option value="">-- بدون عميل --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select style={s.input} value={form.status || "جديدة"} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map(st => <option key={st}>{st}</option>)}
                </select>
                <select style={s.input} value={form.priority || "متوسطة"} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <input type="date" style={s.input} value={form.due || ""} onChange={e => setForm({ ...form, due: e.target.value })} />
              <div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>التاغات:</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ALL_TAGS.map((tg, i) => (
                    <span key={tg} onClick={() => toggleTag(tg)} style={{
                      display: "inline-flex", alignItems: "center", borderRadius: 5, padding: "3px 9px", fontSize: 12, cursor: "pointer", border: "1px solid",
                      color: TAG_COLORS[i % TAG_COLORS.length],
                      borderColor: TAG_COLORS[i % TAG_COLORS.length] + (form.tags?.includes(tg) ? "" : "44"),
                      background: TAG_COLORS[i % TAG_COLORS.length] + (form.tags?.includes(tg) ? "33" : "11"),
                    }}>{tg}</span>
                  ))}
                </div>
              </div>
              <textarea rows={2} style={s.input} placeholder="ملاحظات" value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={s.btnGhost} onClick={() => setModal(null)}>إلغاء</button>
                <button style={s.btnPrimary} onClick={saveTask}>حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal?.type === "emp" && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#F1F5F9" }}>👤 موظف جديد</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={s.input} placeholder="الاسم *" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input style={s.input} placeholder="المسمى الوظيفي" value={form.role || ""} onChange={e => setForm({ ...form, role: e.target.value })} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ color: "#94A3B8", fontSize: 12 }}>اللون:</label>
                <input type="color" value={form.color || "#60A5FA"} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 44, height: 32, padding: 2, background: "none", border: "1px solid #1E3A5F", borderRadius: 6, cursor: "pointer" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={s.btnGhost} onClick={() => setModal(null)}>إلغاء</button>
                <button style={s.btnPrimary} onClick={saveEmp}>إضافة</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal?.type === "client" && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#F1F5F9" }}>🏢 عميل جديد</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={s.input} placeholder="اسم العميل *" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input style={s.input} placeholder="رقم الهاتف" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input style={s.input} placeholder="البريد الإلكتروني" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} />
              <textarea rows={2} style={s.input} placeholder="ملاحظات" value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={s.btnGhost} onClick={() => setModal(null)}>إلغاء</button>
                <button style={s.btnPrimary} onClick={saveClient}>إضافة</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
