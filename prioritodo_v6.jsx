import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const DAY = ["日", "月", "火", "水", "木", "金", "土"];
const PALETTE = [
  "#CD2B31", "#D4440C", "#E5A500", "#30A46C", "#5B5BD6",
  "#8E4EC6", "#3E63DD", "#0EA5E9", "#889096", "#E879A2",
  "#F97316", "#65A30D", "#0D9488", "#6D28D9", "#475569",
  "#DC2626", "#2563EB", "#16A34A", "#CA8A04", "#9333EA",
];
const RECUR = [
  { id: "none", label: "なし" }, { id: "daily", label: "毎日" },
  { id: "weekly", label: "毎週" }, { id: "biweekly", label: "隔週" }, { id: "monthly", label: "毎月" },
];
const FILTERS = [
  { id: "today", label: "今日", days: 0 }, { id: "week", label: "1週間", days: 7 },
  { id: "2week", label: "2週間", days: 14 }, { id: "month", label: "1ヶ月", days: 30 },
  { id: "all", label: "すべて", days: Infinity },
];
const REMINDERS = [
  { id: "none", label: "なし" }, { id: "30min", label: "30分前" }, { id: "1hour", label: "1時間前" },
  { id: "3hour", label: "3時間前" }, { id: "1day", label: "1日前" }, { id: "3day", label: "3日前" },
];
const DEFAULT_CATS = [{ id: "default", label: "未分類", color: "#889096" }];
const SK_T = "prioritodo_v6_tasks", SK_C = "prioritodo_v6_cats", SK_G = "prioritodo_v6_groups";
const loadT = () => { try { return JSON.parse(localStorage.getItem(SK_T)) || []; } catch { return []; } };
const saveT = (t) => { try { localStorage.setItem(SK_T, JSON.stringify(t)); } catch {} };
const loadC = () => { try { return JSON.parse(localStorage.getItem(SK_C)) || DEFAULT_CATS; } catch { return DEFAULT_CATS; } };
const saveC = (c) => { try { localStorage.setItem(SK_C, JSON.stringify(c)); } catch {} };
const loadG = () => { try { return JSON.parse(localStorage.getItem(SK_G)) || []; } catch { return []; } };
const saveG = (g) => { try { localStorage.setItem(SK_G, JSON.stringify(g)); } catch {} };

function fmt(d) { const o = new Date(d); return `${o.getMonth()+1}/${o.getDate()} (${DAY[o.getDay()]}) ${String(o.getHours()).padStart(2,"0")}:${String(o.getMinutes()).padStart(2,"0")}`; }
function remaining(d) {
  const ms = new Date(d).getTime() - Date.now();
  if (ms < 0) return { t: "期限超過", u: 4 };
  const h = ms / 36e5;
  if (h < 1) return { t: `${Math.ceil(ms/6e4)}分`, u: 3 };
  if (h < 24) return { t: `${Math.ceil(h)}時間`, u: 3 };
  const days = Math.ceil(h / 24);
  return { t: `${days}日`, u: days <= 3 ? 2 : days <= 7 ? 1 : 0 };
}
function urgColor(u) {
  if (u >= 4) return { bg: "#FCECED", fg: "#CD2B31" };
  if (u >= 3) return { bg: "#FFF0EC", fg: "#D4440C" };
  if (u >= 2) return { bg: "#FFF3D0", fg: "#9E6C00" };
  if (u >= 1) return { bg: "#EDF6FF", fg: "#3E63DD" };
  return { bg: "#F0F0F3", fg: "#60646C" };
}

function expandRecurring(task, horizonDate) {
  if (!task.recurrence || task.recurrence === "none") return [task];
  const results = [], base = new Date(task.deadline), horizon = new Date(horizonDate);
  const lookback = new Date(); lookback.setDate(lookback.getDate() - 1);
  let current = new Date(base);
  const endDate = task.repeatEndDate ? new Date(task.repeatEndDate) : horizon;
  const effectiveEnd = endDate < horizon ? endDate : horizon;
  let count = 0;
  while (current <= effectiveEnd && count < 200) {
    if (current >= lookback) {
      const key = current.toISOString().slice(0, 16);
      if (!(task.completedOccurrences || []).includes(key)) {
        results.push({ ...task, id: `${task.id}_${current.getTime()}`, parentId: task.id, deadline: current.toISOString(), isOccurrence: true });
      }
    }
    current = new Date(current); advanceDate(current, task.recurrence); count++;
  }
  return results;
}
function advanceDate(d, r) { switch(r) { case "daily": d.setDate(d.getDate()+1); break; case "weekly": d.setDate(d.getDate()+7); break; case "biweekly": d.setDate(d.getDate()+14); break; case "monthly": d.setMonth(d.getMonth()+1); break; } }
function calcEndDate(deadline, recurrence, count) { const d = new Date(deadline); for (let i = 0; i < count - 1; i++) advanceDate(d, recurrence); return d; }
function calcCount(deadline, recurrence, endDate) { const d = new Date(deadline), end = new Date(endDate); let c = 1; while (d < end && c < 200) { advanceDate(d, recurrence); c++; } return c; }
function snapToWeekday(endDate, deadline, recurrence) {
  if (recurrence !== "weekly" && recurrence !== "biweekly") return endDate;
  const target = new Date(deadline).getDay(), end = new Date(endDate), ed = end.getDay();
  if (ed === target) return end;
  let diff = ed - target; if (diff < 0) diff += 7;
  end.setDate(end.getDate() - diff); return end;
}

// ─── Icons ───
const Icon = ({ d, size = 16, stroke = "currentColor", sw = 1.8, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}><path d={d} /></svg>
);
const IconPlus = (p) => <Icon d="M12 5v14M5 12h14" {...p} />;
const IconCheck = (p) => <Icon d="M5 13l4 4L19 7" {...p} />;
const IconX = (p) => <Icon d="M18 6L6 18M6 6l12 12" {...p} />;
const IconChevL = (p) => <Icon d="M15 18l-6-6 6-6" {...p} />;
const IconChevR = (p) => <Icon d="M9 6l6 6-6 6" {...p} />;
const IconChevD = (p) => <Icon d="M6 9l6 6 6-6" {...p} />;
const IconGrip = (p) => <Icon d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" sw={3} {...p} />;
const IconFlag = ({ filled, ...p }) => filled
  ? <svg width={16} height={16} viewBox="0 0 24 24" fill="#CD2B31" stroke="#CD2B31" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
  : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
const IconRepeat = (p) => <Icon d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h12M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H5" {...p} />;
const IconList = (p) => <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...p} />;
const IconCalendar = (p) => <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" {...p} />;
const IconArchive = (p) => <Icon d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" {...p} />;
const IconSettings = (p) => <Icon d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" {...p} />;
const IconTrash = (p) => <Icon d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" {...p} />;
const IconPalette = ({ size = 16, stroke = "currentColor", ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {/* Brush handle */}
    <line x1="3" y1="21" x2="10" y2="14" strokeWidth={2.2} />
    {/* Brush tip */}
    <path d="M9.5 14.5L10.5 12.5L12 13.5L10.5 15z" fill={stroke} stroke="none" />
    {/* Palette body */}
    <path d="M12 5c-4 0-7 3-7 6.5S8 18 12 18c1 0 1.5-.5 1.5-1s-.2-.7-.5-1c-.3-.3-.5-.6-.5-1 0-.8.7-1.5 1.5-1.5H16c2.8 0 5-2.2 5-5 0-3.9-3.6-7-9-7.5z" />
    {/* Color dots */}
    <circle cx="10" cy="9" r="1" fill={stroke} stroke="none" />
    <circle cx="14" cy="8" r="1" fill={stroke} stroke="none" />
    <circle cx="17" cy="11" r="1" fill={stroke} stroke="none" />
  </svg>
);
const IconBook = (p) => <Icon d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" {...p} />;
const IconUsers = (p) => <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" {...p} />;

// ─── CSS ───
const globalStyle = document.createElement("style");
globalStyle.textContent = `
@keyframes taskShrink {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0); opacity: 0; height: 0; padding: 0; margin: 0; border: none; overflow: hidden; }
}
.task-shrink { animation: taskShrink 0.35s 0.15s ease-in forwards; }
@keyframes particle {
  0% { transform: translate(0,0) scale(1); opacity: 1; }
  100% { opacity: 0; }
}
.prioritodo-app * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
.prioritodo-app input, .prioritodo-app textarea, .prioritodo-app select { -webkit-user-select: text; user-select: text; }
`;
if (typeof document !== "undefined" && !document.getElementById("prioritodo-styles")) {
  globalStyle.id = "prioritodo-styles";
  document.head.appendChild(globalStyle);
}

// Particle burst component
function ParticleBurst({ x, y }) {
  const particles = useMemo(() => {
    const count = 8;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 30 + Math.random() * 40;
      const size = 4 + Math.random() * 5;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const colors = ["#111827", "#6B7280", "#9CA3AF", "#374151", "#D1D5DB"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const dur = 0.3 + Math.random() * 0.2;
      return { tx, ty, size, color, dur };
    });
  }, []);

  return (
    <div style={{ position: "fixed", left: x, top: y, pointerEvents: "none", zIndex: 9999 }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute",
          width: p.size, height: p.size,
          borderRadius: p.size > 6 ? "2px" : "50%",
          backgroundColor: p.color,
          animation: `particle ${p.dur}s ease-out forwards`,
          transform: `translate(${-p.size/2}px, ${-p.size/2}px)`,
          ["--tx"]: `${p.tx}px`, ["--ty"]: `${p.ty}px`,
          animationName: "none",
        }} ref={el => {
          if (el) {
            el.animate([
              { transform: `translate(${-p.size/2}px, ${-p.size/2}px) scale(1)`, opacity: 1 },
              { transform: `translate(${p.tx}px, ${p.ty}px) scale(0.2)`, opacity: 0 }
            ], { duration: p.dur * 1000, easing: "ease-out", fill: "forwards" });
          }
        }} />
      ))}
    </div>
  );
}

// ─── Category Picker ───
function CategoryPicker({ cats, setCats, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[4]);
  const current = cats.find(c => c.id === selected) || cats[0] || { label: "未分類", color: "#889096" };
  const handleCreate = () => {
    if (!newLabel.trim()) return;
    const cat = { id: uid(), label: newLabel.trim(), color: newColor };
    setCats(prev => [...prev, cat]); onSelect(cat.id);
    setNewLabel(""); setCreating(false); setOpen(false);
  };
  return (
    <div>
      <div className="px-4 py-3 flex items-center justify-between cursor-pointer" onClick={() => setOpen(!open)}>
        <span className="text-sm text-gray-900">カテゴリ</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: current.color }} />
          <span className="text-sm text-gray-600">{current.label}</span>
          <IconChevD size={14} stroke="#999" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
        </div>
      </div>
      {open && (
        <div className="border-t border-gray-100">
          {cats.map(c => (
            <div key={c.id} onClick={() => { onSelect(c.id); setOpen(false); setCreating(false); }}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selected === c.id ? "bg-blue-50" : "hover:bg-gray-50"}`}>
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-sm text-gray-800 flex-1">{c.label}</span>
              {selected === c.id && <IconCheck size={14} stroke="#3B82F6" sw={2.5} />}
            </div>
          ))}
          {!creating ? (
            <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2.5 w-full text-sm text-blue-500 hover:bg-blue-50 transition-colors border-t border-gray-100">
              <IconPlus size={14} /> 新しいカテゴリを作成
            </button>
          ) : (
            <div className="px-4 py-3 border-t border-gray-100 space-y-2.5">
              <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="カテゴリ名"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:border-gray-400"
                autoFocus onKeyDown={e => e.key === "Enter" && handleCreate()} />
              <div className="flex gap-1.5 flex-wrap">
                {PALETTE.map(c => <button key={c} onClick={() => setNewColor(c)} className={`w-6 h-6 rounded-full transition-all ${newColor === c ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : ""}`} style={{ backgroundColor: c }} />)}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-500 bg-gray-100">取消</button>
                <button onClick={handleCreate} disabled={!newLabel.trim()} className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-gray-900 disabled:bg-gray-300">作成</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Category Manager ───
function CategoryManager({ cats, setCats, onClose }) {
  const [eid, setEid] = useState(null);
  const [eLabel, setELabel] = useState("");
  const [eColor, setEColor] = useState("");
  const startEdit = (c) => { setEid(c.id); setELabel(c.label); setEColor(c.color); };
  const saveEdit = () => { if (!eLabel.trim()) return; setCats(prev => prev.map(c => c.id === eid ? { ...c, label: eLabel.trim(), color: eColor } : c)); setEid(null); };
  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={onClose} className="text-sm text-blue-500 font-medium">戻る</button>
        <span className="text-sm font-semibold text-gray-900">カテゴリ管理</span><div className="w-10" />
      </div>
      <div className="flex-1 overflow-y-auto">
        <p className="px-4 pt-4 pb-2 text-xs text-gray-400">カテゴリの名前や色を変更できます。</p>
        <div className="mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          {cats.map((c, i) => (
            <div key={c.id} className={i < cats.length - 1 ? "border-b border-gray-100" : ""}>
              {eid === c.id ? (
                <div className="px-4 py-3 space-y-3">
                  <input type="text" value={eLabel} onChange={e => setELabel(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" autoFocus />
                  <div className="flex gap-1.5 flex-wrap">{PALETTE.map(co => <button key={co} onClick={() => setEColor(co)} className={`w-6 h-6 rounded-full transition-all ${eColor === co ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : ""}`} style={{ backgroundColor: co }} />)}</div>
                  <div className="flex gap-2">
                    <button onClick={() => setEid(null)} className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-500 bg-gray-100">取消</button>
                    <button onClick={saveEdit} className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-gray-900">保存</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center px-4 py-3">
                  <span className="w-4 h-4 rounded-full flex-shrink-0 mr-3" style={{ backgroundColor: c.color }} />
                  <span className="text-sm text-gray-900 flex-1">{c.label}</span>
                  <button onClick={() => startEdit(c)} className="text-xs text-blue-500 px-2">編集</button>
                  {c.id !== "default" && <button onClick={() => setCats(prev => prev.filter(x => x.id !== c.id))} className="p-1 text-gray-300 hover:text-red-500"><IconTrash size={14} /></button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Task Form ───
function TaskForm({ task, onSave, onDelete, onClose, prefillDate, cats, setCats }) {
  const isEdit = !!task;
  const getDefault = () => {
    if (prefillDate) { const d = new Date(prefillDate); d.setHours(23, 59); return d.toISOString().slice(0, 16); }
    const d = new Date(); d.setHours(d.getHours() + 1, 0); return d.toISOString().slice(0, 16);
  };
  const [title, setTitle] = useState(task?.title || "");
  const [deadline, setDeadline] = useState(task?.deadline ? new Date(task.deadline).toISOString().slice(0,16) : getDefault());
  const [category, setCategory] = useState(task?.category || (cats[0]?.id || "default"));
  const [priority, setPriority] = useState(task?.priority || false);
  const [recurrence, setRecurrence] = useState(task?.recurrence || "none");
  const [repeatCount, setRepeatCount] = useState(task?.repeatCount || 15);
  const [repeatEndDate, setRepeatEndDate] = useState(task?.repeatEndDate || "");
  const [reminder, setReminder] = useState(task?.reminder || "1day");
  const [memo, setMemo] = useState(task?.memo || "");
  const [url, setUrl] = useState(task?.url || "");
  const [showError, setShowError] = useState(false);

  useEffect(() => { if (recurrence === "none") return; const end = calcEndDate(deadline, recurrence, repeatCount); setRepeatEndDate(end.toISOString().slice(0, 10)); }, [recurrence, repeatCount, deadline]);
  const handleEndDateChange = (val) => { const snapped = snapToWeekday(new Date(val), deadline, recurrence); const s = snapped.toISOString().slice(0, 10); setRepeatEndDate(s); setRepeatCount(Math.max(1, calcCount(deadline, recurrence, snapped))); };
  const handleCountChange = (d) => setRepeatCount(Math.max(1, Math.min(99, repeatCount + d)));
  const deadlineDay = DAY[new Date(deadline).getDay()];

  const handleSave = () => {
    if (!title.trim()) { setShowError(true); return; }
    onSave({
      id: task?.parentId || task?.id || uid(), title: title.trim(), deadline: new Date(deadline).toISOString(),
      category, priority, recurrence, repeatCount: recurrence === "none" ? null : repeatCount,
      repeatEndDate: recurrence === "none" ? null : repeatEndDate, reminder, memo, url,
      completed: false, completedAt: null, completedOccurrences: task?.completedOccurrences || [],
      order: task?.order ?? null, createdAt: task?.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={onClose} className="text-sm text-blue-500 font-medium">キャンセル</button>
        <span className="text-sm font-semibold text-gray-900">{isEdit ? "予定の編集" : "新しい予定"}</span>
        <button onClick={handleSave} className="text-sm font-semibold text-blue-500">保存</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div>
            <input type="text" value={title} onChange={e => { setTitle(e.target.value); if (e.target.value.trim()) setShowError(false); }}
              placeholder="タスク名を入力" className={`w-full px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b ${showError && !title.trim() ? "border-red-300 bg-red-50/50" : "border-gray-100"}`} autoFocus />
            {showError && !title.trim() && <div className="px-4 py-2 text-xs text-red-500 bg-red-50/50">タスク名を入力してください</div>}
          </div>
          <CategoryPicker cats={cats} setCats={setCats} selected={category} onSelect={setCategory} />
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2"><IconFlag filled={priority} /><span className="text-sm text-gray-900">最優先</span></div>
            <button onClick={() => setPriority(!priority)} className={`w-12 h-7 rounded-full transition-colors duration-200 relative flex-shrink-0 ${priority ? "bg-red-500" : "bg-gray-300"}`}>
              <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${priority ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="px-4 py-3"><label className="block text-sm text-gray-900 mb-2">締切</label>
            <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 focus:outline-none focus:border-gray-400" />
          </div>
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-900 mb-2 block">繰り返し</span>
            <div className="flex gap-1.5 flex-wrap">{RECUR.map(r => <button key={r.id} onClick={() => setRecurrence(r.id)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${recurrence === r.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>{r.label}</button>)}</div>
          </div>
          {recurrence !== "none" && (<>
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-900">終了日</span><span className="text-xs text-gray-400">毎{deadlineDay}曜に自動調整</span></div>
              <input type="date" value={repeatEndDate} onChange={e => handleEndDateChange(e.target.value)} min={new Date(deadline).toISOString().slice(0, 10)} className="w-full text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 focus:outline-none focus:border-gray-400" />
            </div>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-900">回数</span>
              <div className="flex items-center gap-2">
                <button onClick={() => handleCountChange(-1)} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-bold">-</button>
                <span className="text-sm font-medium text-gray-900 w-8 text-center">{repeatCount}</span>
                <button onClick={() => handleCountChange(1)} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-bold">+</button>
                <span className="text-xs text-gray-400 ml-1">回</span>
              </div>
            </div>
          </>)}
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-900">通知アラーム</span>
            <select value={reminder} onChange={e => setReminder(e.target.value)} className="appearance-none bg-transparent text-sm text-gray-500 text-right focus:outline-none cursor-pointer">
              {REMINDERS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="URL" className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b border-gray-100" />
          <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="メモ" rows={3} className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none" />
        </div>
        <div className="h-24" />
      </div>
      {isEdit && <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-gray-200"><button onClick={() => onDelete(task.parentId || task.id)} className="text-sm text-red-500 font-medium">削除</button></div>}
    </div>
  );
}

// ─── Task Row ───
function TaskRow({ task, cats, onComplete, onEdit, onDelete, idx, touchDrag }) {
  const rem = remaining(task.deadline);
  const uc = urgColor(rem.u);
  const cat = cats.find(c => c.id === task.category) || { label: "未分類", color: "#889096" };
  const isOverdue = rem.u >= 4;
  const [popping, setPopping] = useState(false);
  const [burst, setBurst] = useState(null);
  const [swipeX, setSwipeX] = useState(0);
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null); // {x, y} for PC right-click
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);
  const checkRef = useRef(null);

  const hasMemo = task.memo && task.memo.trim();
  const hasUrl = task.url && task.url.trim();

  const handleComplete = () => {
    const rect = checkRef.current?.getBoundingClientRect();
    if (rect) setBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setPopping(true);
    setTimeout(() => onComplete(task), 500);
  };

  useEffect(() => { if (burst) { const t = setTimeout(() => setBurst(null), 600); return () => clearTimeout(t); } }, [burst]);

  // Close context menu on click outside
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [ctxMenu]);

  // Swipe
  const onTouchStartSwipe = (e) => { if (touchDrag.active) return; touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; swiping.current = false; };
  const onTouchMoveSwipe = (e) => { if (touchDrag.active) return; const dx = e.touches[0].clientX - touchStartX.current; const dy = Math.abs(e.touches[0].clientY - touchStartY.current); if (dy > 20 && !swiping.current) return; if (dx < -10) { swiping.current = true; setSwipeX(Math.max(dx, -80)); } else if (showDeleteBtn && dx > 10) { setSwipeX(Math.min(dx - 80, 0)); } };
  const onTouchEndSwipe = () => { if (touchDrag.active) return; if (swipeX < -40) { setSwipeX(-80); setShowDeleteBtn(true); } else { setSwipeX(0); setShowDeleteBtn(false); } };

  // Long press drag
  const longPressTimer = useRef(null);
  const onTouchStartDrag = (e) => { longPressTimer.current = setTimeout(() => { touchDrag.start(idx, e.touches[0].clientY); }, 500); };
  const onTouchMoveCancelDrag = () => { clearTimeout(longPressTimer.current); };
  const onTouchEndDrag = () => { clearTimeout(longPressTimer.current); };

  // PC right-click
  const handleContextMenu = (e) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className={`relative overflow-hidden ${popping ? "task-shrink" : ""}`}>
      {burst && <ParticleBurst x={burst.x} y={burst.y} />}
      {/* Delete button behind (swipe) */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center">
        <button onClick={() => onDelete(task)} className="text-white text-xs font-medium">削除</button>
      </div>
      {/* Card */}
      <div className="relative bg-white transition-transform"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={(e) => { onTouchStartSwipe(e); onTouchStartDrag(e); }}
        onTouchMove={(e) => { onTouchMoveSwipe(e); onTouchMoveCancelDrag(); }}
        onTouchEnd={() => { onTouchEndSwipe(); onTouchEndDrag(); }}
        onContextMenu={handleContextMenu}>
        <div className={`flex items-start gap-3 px-4 py-3.5 border-b border-gray-100 transition-colors ${
          touchDrag.active && touchDrag.dragIdx === idx ? "opacity-50 bg-gray-100" : ""
        } ${isOverdue ? "bg-red-50/70" : task.priority ? "bg-red-50/30" : ""}`}
          style={task.priority || isOverdue ? { borderLeft: "3px solid #CD2B31" } : { borderLeft: "3px solid transparent" }}>
          {/* Grip */}
          <div className="text-gray-300 flex-shrink-0 mt-0.5"><IconGrip size={14} /></div>
          {/* Checkbox */}
          <button ref={checkRef} onClick={handleComplete} className="w-5 h-5 rounded-md border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all flex-shrink-0 mt-0.5" />
          {/* Content */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !task.isGroupTask && onEdit(task)}>
            <div className="flex items-center gap-2">
              {task.priority && <IconFlag filled size={13} />}
              <span className={`text-sm font-medium truncate ${isOverdue ? "text-red-700" : "text-gray-900"}`}>{task.title}</span>
              {task.recurrence && task.recurrence !== "none" && <IconRepeat size={12} stroke="#889096" />}
              {task.isGroupTask && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded flex-shrink-0">{task.groupName}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-xs text-gray-400">{cat.label}</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-gray-400">{fmt(task.deadline)}</span>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: uc.bg, color: uc.fg }}>
                {rem.u >= 4 ? rem.t : `あと${rem.t}`}
              </span>
            </div>
            {/* Memo preview */}
            {hasMemo && (
              <div className="mt-1.5 text-xs text-gray-400 leading-relaxed line-clamp-2" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {task.memo}
              </div>
            )}
            {/* URL preview */}
            {hasUrl && (
              <div className="mt-1 flex items-center gap-1">
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
                <span className="text-[11px] text-blue-400 truncate">{task.url.replace(/^https?:\/\//, "").slice(0, 30)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* PC Context menu */}
      {ctxMenu && (
        <div className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <button onClick={() => { onEdit(task); setCtxMenu(null); }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap">編集</button>
          <button onClick={() => { onDelete(task); setCtxMenu(null); }}
            className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 whitespace-nowrap">削除</button>
        </div>
      )}
    </div>
  );
}

// ─── Calendar ───
function CalendarView({ tasks, cats, month, setMonth, onAddClick, onEditTask, selectedDate, setSelectedDate }) {
  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1).getDay(), total = new Date(y, m+1, 0).getDate(), today = new Date();
  const cells = []; for (let i = 0; i < first; i++) cells.push(null); for (let d = 1; d <= total; d++) cells.push(d);
  const tasksOn = (day) => tasks.filter(t => { const dd=new Date(t.deadline); return dd.getFullYear()===y&&dd.getMonth()===m&&dd.getDate()===day; });
  const isToday = (day) => day&&today.getFullYear()===y&&today.getMonth()===m&&today.getDate()===day;
  const isSel = (day) => { if (!day||!selectedDate) return false; return selectedDate.getFullYear()===y&&selectedDate.getMonth()===m&&selectedDate.getDate()===day; };
  const selTasks = selectedDate ? tasks.filter(t => { const dd=new Date(t.deadline); return dd.getFullYear()===selectedDate.getFullYear()&&dd.getMonth()===selectedDate.getMonth()&&dd.getDate()===selectedDate.getDate(); }).sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)) : [];
  const fmtSel = selectedDate ? `${selectedDate.getFullYear()}年${selectedDate.getMonth()+1}月${selectedDate.getDate()}日(${DAY[selectedDate.getDay()]})` : "";
  const fmtTime = (d) => { const o=new Date(d); return `${String(o.getHours()).padStart(2,"0")}:${String(o.getMinutes()).padStart(2,"0")}`; };
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setMonth(new Date(y,m-1))} className="p-2 hover:bg-gray-100 rounded-lg"><IconChevL size={16} /></button>
        <span className="text-sm font-semibold text-gray-900">{y}年 {m+1}月</span>
        <button onClick={() => setMonth(new Date(y,m+1))} className="p-2 hover:bg-gray-100 rounded-lg"><IconChevR size={16} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">{DAY.map((d,i) => <div key={d} className={`text-center text-[11px] font-medium py-1 ${i===0?"text-red-400":i===6?"text-blue-400":"text-gray-400"}`}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
        {cells.map((day, idx) => { const dt=day?tasksOn(day):[]; const sel=isSel(day), tod=isToday(day); return (
          <div key={idx} onClick={() => day&&setSelectedDate(new Date(y,m,day))} className={`min-h-[100px] p-1.5 transition-colors ${day?"cursor-pointer":""}`}
            style={{ backgroundColor: sel?"#111827":tod?"rgba(219,234,254,0.5)":"#fff" }}>
            {day && (<><div className={`text-[11px] leading-none mb-1.5 text-center font-medium ${sel?"font-bold text-white":tod?"font-bold text-blue-600":"text-gray-700"}`}>{day}</div>
              <div className="space-y-0.5">{dt.slice(0,2).map(t => { const tc=cats.find(c=>c.id===t.category); return <div key={t.id} className={`text-[8px] leading-tight truncate px-0.5 rounded ${sel?"text-white/80":"text-gray-500"}`} style={!sel?{borderLeft:`2px solid ${t.priority?"#CD2B31":(tc?.color||"#889096")}`}:{borderLeft:"2px solid rgba(255,255,255,0.5)"}}>{t.title}</div>; })}
                {dt.length>2 && <div className={`text-[8px] px-0.5 ${sel?"text-white/50":"text-gray-400"}`}>+{dt.length-2}</div>}</div></>)}
          </div>); })}
      </div>
      {selectedDate && (
        <div className="mt-3">
          <div className="bg-gray-100 px-4 py-2.5 flex items-center justify-between rounded-t-lg"><span className="text-xs font-semibold text-gray-700">{fmtSel}</span><button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600"><IconX size={14} /></button></div>
          <div className="border border-t-0 border-gray-100 rounded-b-lg bg-white">
            {selTasks.length===0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">予定はありません</div> :
              selTasks.map(t => { const tc=cats.find(c=>c.id===t.category)||{label:"未分類",color:"#889096"}; const hasMemo=t.memo&&t.memo.trim(); const hasUrl=t.url&&t.url.trim(); return (
                <div key={t.id} onClick={() => onEditTask(t)} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex-shrink-0 w-12 text-right mt-0.5"><div className="text-xs font-medium text-gray-500">{fmtTime(t.deadline)}</div></div>
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: t.priority?"#CD2B31":tc.color, minHeight: "24px" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">{t.priority && <IconFlag filled size={11} />}<span className="text-sm text-gray-900 font-medium truncate">{t.title}</span>{t.recurrence&&t.recurrence!=="none"&&<IconRepeat size={11} stroke="#889096" />}</div>
                    <span className="text-[11px] text-gray-400">{tc.label}</span>
                    {hasMemo && <div className="mt-1 text-[11px] text-gray-400 leading-relaxed" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.memo}</div>}
                    {hasUrl && <div className="mt-0.5 text-[10px] text-blue-400 truncate">{t.url.replace(/^https?:\/\//,"").slice(0,35)}</div>}
                  </div>
                  <IconChevR size={14} stroke="#ccc" className="mt-0.5" />
                </div>); })}
            <button onClick={() => onAddClick(selectedDate)} className="flex items-center justify-center gap-2 w-full px-4 py-3.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors border-t border-gray-100"><IconPlus size={15} />新しい予定の作成</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Completed (1 month only) ───
function CompletedList({ tasks, cats, onRestore }) {
  const oneMonthAgo = Date.now() - 30 * 864e5;
  const recent = tasks.filter(t => t.completedAt && new Date(t.completedAt).getTime() > oneMonthAgo);
  if (!recent.length) return <div className="flex flex-col items-center justify-center py-16 text-gray-400"><IconArchive size={32} stroke="#ccc" /><p className="text-sm mt-3">達成済みタスクはまだありません</p></div>;
  return (<div>
    <div className="px-4 py-2"><span className="text-[10px] text-gray-400">過去1ヶ月分を表示</span></div>
    {recent.map(t => { const cat=cats.find(c=>c.id===t.category)||{label:"未分類",color:"#889096"}; return (
      <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
        <button onClick={() => onRestore(t.id)} className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0"><IconCheck size={12} stroke="white" sw={3} /></button>
        <div className="flex-1 min-w-0"><span className="text-sm text-gray-400 line-through truncate block">{t.title}</span>
          <div className="flex items-center gap-2 mt-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} /><span className="text-[11px] text-gray-300">{t.completedAt ? fmt(t.completedAt) : ""}</span></div>
        </div>
      </div>); })}
  </div>);
}

// ─── Group View (Phase 2) ───
function GroupView({ groups, setGroups }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupTab, setGroupTab] = useState("tasks"); // tasks | members | calendar
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(() => { const d = new Date(); d.setDate(d.getDate()+7); return d.toISOString().slice(0,16); });
  const [taskAssignee, setTaskAssignee] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [calMonth, setCalMonth] = useState(new Date());
  const [selGrpDate, setSelGrpDate] = useState(null);
  const MEMBER_COLORS = ["#5B5BD6","#CD2B31","#30A46C","#E5A500","#8E4EC6","#3E63DD","#0EA5E9","#D4440C","#65A30D","#E879A2"];

  const createGroup = () => { if (!newName.trim()) return; const g = { id: uid(), name: newName.trim(), members: [{ id: uid(), name: "自分", isMe: true }], tasks: [], createdAt: new Date().toISOString() }; setGroups(prev => [...prev, g]); setNewName(""); setShowCreate(false); setSelectedGroup(g.id); };
  const addMember = (gid) => { if (!memberName.trim()) return; setGroups(prev => prev.map(g => g.id === gid ? { ...g, members: [...g.members, { id: uid(), name: memberName.trim(), isMe: false }] } : g)); setMemberName(""); setShowAddMember(false); };
  const addTask = (gid) => { if (!taskTitle.trim()) return; setGroups(prev => prev.map(g => g.id === gid ? { ...g, tasks: [...g.tasks, { id: uid(), title: taskTitle.trim(), deadline: new Date(taskDeadline).toISOString(), assignee: taskAssignee || null, completed: false, createdAt: new Date().toISOString() }] } : g)); setTaskTitle(""); setTaskAssignee(""); setShowAddTask(false); };
  const toggleTask = (gid, tid) => { setGroups(prev => prev.map(g => g.id === gid ? { ...g, tasks: g.tasks.map(t => t.id === tid ? { ...t, completed: !t.completed } : t) } : g)); };
  const deleteTask = (gid, tid) => { setGroups(prev => prev.map(g => g.id === gid ? { ...g, tasks: g.tasks.filter(t => t.id !== tid) } : g)); };
  const deleteGroup = (gid) => { setGroups(prev => prev.filter(g => g.id !== gid)); setSelectedGroup(null); };
  const removeMember = (gid, mid) => { setGroups(prev => prev.map(g => g.id === gid ? { ...g, members: g.members.filter(m => m.id !== mid) } : g)); };

  const group = groups.find(g => g.id === selectedGroup);

  // Group list
  if (!selectedGroup) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-900">グループ</span>
          <button onClick={() => setShowCreate(true)} className="text-xs text-blue-500 font-medium flex items-center gap-1"><IconPlus size={13} />グループを作成</button>
        </div>
        {showCreate && (
          <div className="mb-4 bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="グループ名" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:border-gray-400" autoFocus onKeyDown={e => e.key === "Enter" && createGroup()} />
            <div className="flex gap-2"><button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-500 bg-gray-100">取消</button><button onClick={createGroup} disabled={!newName.trim()} className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-gray-900 disabled:bg-gray-300">作成</button></div>
          </div>
        )}
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400"><IconUsers size={32} stroke="#ddd" /><p className="text-sm mt-3">グループはまだありません</p><p className="text-xs mt-1 text-gray-300">グループを作成して、タスクを共有しましょう</p></div>
        ) : (
          <div className="space-y-2">{groups.map(g => {
            const done = g.tasks.filter(t => t.completed).length, total = g.tasks.length;
            return (<div key={g.id} onClick={() => setSelectedGroup(g.id)} className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-900">{g.name}</span><IconChevR size={14} stroke="#ccc" /></div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400"><span className="flex items-center gap-1"><IconUsers size={12} />{g.members.length}人</span><span>{total}件</span>{total > 0 && <span>{done}/{total} 完了</span>}</div>
              {total > 0 && <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(done/total)*100}%` }} /></div>}
            </div>);
          })}</div>
        )}
      </div>
    );
  }

  // Group detail with sub-tabs
  const getMemberColor = (idx) => MEMBER_COLORS[idx % MEMBER_COLORS.length];

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setSelectedGroup(null)} className="text-blue-500 text-sm font-medium flex items-center gap-1"><IconChevL size={14} />戻る</button>
        <span className="flex-1" /><button onClick={() => deleteGroup(group.id)} className="text-xs text-red-400">削除</button>
      </div>
      <h2 className="text-base font-bold text-gray-900 mb-3">{group.name}</h2>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-4">
        {[{id:"tasks",label:"タスク"},{id:"members",label:"メンバー"},{id:"calendar",label:"カレンダー"}].map(t => (
          <button key={t.id} onClick={() => setGroupTab(t.id)} className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${groupTab===t.id?"bg-white text-gray-900 shadow-sm":"text-gray-500"}`}>{t.label}</button>
        ))}
      </div>

      {/* Tasks tab */}
      {groupTab === "tasks" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">{group.tasks.length}件</span>
            <button onClick={() => setShowAddTask(true)} className="text-xs text-blue-500 flex items-center gap-1"><IconPlus size={12} />タスクを追加</button>
          </div>
          {showAddTask && (
            <div className="mb-3 p-3 bg-white rounded-xl border border-gray-100 space-y-2">
              <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="タスク名" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none" autoFocus />
              <input type="datetime-local" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              <select value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">担当者なし</option>{group.members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
              <div className="flex gap-2"><button onClick={() => setShowAddTask(false)} className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-500 bg-gray-100">取消</button><button onClick={() => addTask(group.id)} disabled={!taskTitle.trim()} className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-gray-900 disabled:bg-gray-300">追加</button></div>
            </div>
          )}
          {group.tasks.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">タスクはまだありません</div> : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {[...group.tasks].sort((a,b) => { if (a.completed !== b.completed) return a.completed ? 1 : -1; return new Date(a.deadline) - new Date(b.deadline); }).map((t,i) => {
                const rem2 = remaining(t.deadline), uc2 = urgColor(rem2.u);
                const mi = group.members.findIndex(m => m.name === t.assignee);
                return (
                  <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-gray-50" : ""} ${t.completed ? "opacity-40" : ""}`}>
                    <button onClick={() => toggleTask(group.id, t.id)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${t.completed ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
                      {t.completed && <IconCheck size={12} stroke="white" sw={3} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${t.completed ? "line-through text-gray-400" : "text-gray-900"}`}>{t.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{fmt(t.deadline)}</span>
                        {!t.completed && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: uc2.bg, color: uc2.fg }}>{rem2.u >= 4 ? rem2.t : `あと${rem2.t}`}</span>}
                        {t.assignee && <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: mi >= 0 ? getMemberColor(mi) : "#889096" }}>{t.assignee}</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteTask(group.id, t.id)} className="text-gray-300 hover:text-red-400 p-1"><IconTrash size={13} /></button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Progress */}
          {group.tasks.length > 0 && (
            <div className="mt-3 bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2"><span>全体の進捗</span><span>{group.tasks.filter(t=>t.completed).length}/{group.tasks.length}</span></div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(group.tasks.filter(t=>t.completed).length/group.tasks.length)*100}%` }} /></div>
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {groupTab === "members" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">{group.members.length}人</span>
            <button onClick={() => setShowAddMember(true)} className="text-xs text-blue-500 flex items-center gap-1"><IconPlus size={12} />メンバーを追加</button>
          </div>
          {showAddMember && (
            <div className="mb-3 flex gap-2">
              <input type="text" value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="名前" className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none" autoFocus onKeyDown={e => e.key === "Enter" && addMember(group.id)} />
              <button onClick={() => addMember(group.id)} disabled={!memberName.trim()} className="px-3 py-2 rounded-lg text-xs font-medium text-white bg-gray-900 disabled:bg-gray-300">追加</button>
              <button onClick={() => setShowAddMember(false)} className="px-2 text-xs text-gray-400">取消</button>
            </div>
          )}
          <div className="space-y-3">
            {group.members.map((m, mi) => {
              const mTasks = group.tasks.filter(t => t.assignee === m.name);
              const mDone = mTasks.filter(t => t.completed).length;
              const mPending = mTasks.filter(t => !t.completed).sort((a,b) => new Date(a.deadline) - new Date(b.deadline));
              const color = getMemberColor(mi);
              return (
                <div key={m.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {/* Member header */}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: color }}>{m.name.slice(0,1)}</div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900">{m.name}</span>
                          {m.isMe && <span className="text-[10px] text-gray-400">あなた</span>}
                        </div>
                        {mTasks.length > 0 && <div className="text-[10px] text-gray-400">{Math.round((mDone/mTasks.length)*100)}% 完了</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {mTasks.length > 0 && <span className="text-[11px] text-gray-400">{mDone}/{mTasks.length}</span>}
                      {!m.isMe && <button onClick={() => removeMember(group.id, m.id)} className="text-gray-300 hover:text-red-400"><IconTrash size={12} /></button>}
                    </div>
                  </div>
                  {/* Progress bar */}
                  {mTasks.length > 0 && (
                    <div className="px-4 py-1.5">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${(mDone/mTasks.length)*100}%`, backgroundColor: color }} /></div>
                    </div>
                  )}
                  {/* Pending tasks */}
                  {mPending.length > 0 && (
                    <div className="px-4 pb-2">
                      {mPending.slice(0, 3).map(t => {
                        const r = remaining(t.deadline), u = urgColor(r.u);
                        return (
                          <div key={t.id} className="flex items-center gap-2 py-1">
                            <span className="text-[11px] text-gray-500 truncate flex-1">{t.title}</span>
                            <span className="text-[10px] font-medium px-1 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: u.bg, color: u.fg }}>{r.u >= 4 ? r.t : `あと${r.t}`}</span>
                          </div>
                        );
                      })}
                      {mPending.length > 3 && <div className="text-[10px] text-gray-400 py-0.5">他{mPending.length - 3}件</div>}
                    </div>
                  )}
                  {mTasks.length === 0 && <div className="px-4 pb-3 text-[11px] text-gray-400">担当タスクなし</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar tab */}
      {groupTab === "calendar" && (() => {
        const y = calMonth.getFullYear(), mo = calMonth.getMonth();
        const first = new Date(y, mo, 1).getDay(), total = new Date(y, mo+1, 0).getDate(), today = new Date();
        const cells = []; for (let i = 0; i < first; i++) cells.push(null); for (let d = 1; d <= total; d++) cells.push(d);
        const tasksOn = (day) => group.tasks.filter(t => { const dd = new Date(t.deadline); return dd.getFullYear()===y && dd.getMonth()===mo && dd.getDate()===day && !t.completed; });
        const isToday = (day) => day && today.getFullYear()===y && today.getMonth()===mo && today.getDate()===day;
        const isSel = (day) => { if (!day || !selGrpDate) return false; return selGrpDate.getFullYear()===y && selGrpDate.getMonth()===mo && selGrpDate.getDate()===day; };
        const selDayTasks = selGrpDate ? group.tasks.filter(t => { const dd=new Date(t.deadline); return dd.getFullYear()===selGrpDate.getFullYear() && dd.getMonth()===selGrpDate.getMonth() && dd.getDate()===selGrpDate.getDate(); }).sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)) : [];
        const fmtSelDate = selGrpDate ? `${selGrpDate.getFullYear()}年${selGrpDate.getMonth()+1}月${selGrpDate.getDate()}日(${DAY[selGrpDate.getDay()]})` : "";
        const fmtTime = (d) => { const o=new Date(d); return `${String(o.getHours()).padStart(2,"0")}:${String(o.getMinutes()).padStart(2,"0")}`; };

        const handleAddFromCal = () => {
          if (selGrpDate) {
            const d = new Date(selGrpDate); d.setHours(23, 59);
            setTaskDeadline(d.toISOString().slice(0, 16));
          }
          setShowAddTask(true);
          setGroupTab("tasks");
        };

        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCalMonth(new Date(y,mo-1))} className="p-2 hover:bg-gray-100 rounded-lg"><IconChevL size={16} /></button>
              <span className="text-sm font-semibold text-gray-900">{y}年 {mo+1}月</span>
              <button onClick={() => setCalMonth(new Date(y,mo+1))} className="p-2 hover:bg-gray-100 rounded-lg"><IconChevR size={16} /></button>
            </div>
            <div className="grid grid-cols-7 mb-1">{DAY.map((d,i) => <div key={d} className={`text-center text-[11px] font-medium py-1 ${i===0?"text-red-400":i===6?"text-blue-400":"text-gray-400"}`}>{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              {cells.map((day, idx) => { const dt = day ? tasksOn(day) : []; const tod = isToday(day); const sel = isSel(day); return (
                <div key={idx} onClick={() => day && setSelGrpDate(new Date(y,mo,day))}
                  className={`min-h-[100px] p-1.5 transition-colors ${day?"cursor-pointer":""}`}
                  style={{ backgroundColor: sel?"#111827":tod?"rgba(219,234,254,0.5)":"#fff" }}>
                  {day && (<><div className={`text-[11px] leading-none mb-1.5 text-center font-medium ${sel?"font-bold text-white":tod?"font-bold text-blue-600":"text-gray-700"}`}>{day}</div>
                    <div className="space-y-0.5">{dt.slice(0,2).map(t => { const mi = group.members.findIndex(m => m.name === t.assignee); return <div key={t.id} className={`text-[8px] leading-tight truncate px-0.5 rounded ${sel?"text-white/80":"text-gray-500"}`} style={{borderLeft:`2px solid ${sel?"rgba(255,255,255,0.5)":(mi >= 0 ? getMemberColor(mi) : "#889096")}`}}>{t.title}</div>; })}{dt.length>2 && <span className={`text-[7px] px-0.5 ${sel?"text-white/50":"text-gray-400"}`}>+{dt.length-2}</span>}</div></>)}
                </div>); })}
            </div>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-2">
              {group.members.map((m, mi) => (
                <div key={m.id} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getMemberColor(mi) }} />
                  <span className="text-[10px] text-gray-500">{m.name}</span>
                </div>
              ))}
            </div>
            {/* Day detail panel */}
            {selGrpDate && (
              <div className="mt-3">
                <div className="bg-gray-100 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
                  <span className="text-xs font-semibold text-gray-700">{fmtSelDate}</span>
                  <button onClick={() => setSelGrpDate(null)} className="text-gray-400 hover:text-gray-600"><IconX size={14} /></button>
                </div>
                <div className="border border-t-0 border-gray-100 rounded-b-lg bg-white">
                  {selDayTasks.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">予定はありません</div>
                  ) : (
                    selDayTasks.map(t => {
                      const mi = group.members.findIndex(m => m.name === t.assignee);
                      const color = mi >= 0 ? getMemberColor(mi) : "#889096";
                      return (
                        <div key={t.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
                          <div className="flex-shrink-0 w-12 text-right mt-0.5">
                            <div className="text-xs font-medium text-gray-500">{fmtTime(t.deadline)}</div>
                          </div>
                          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color, minHeight: "24px" }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-900 font-medium">{t.title}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {t.assignee && <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: color }}>{t.assignee}</span>}
                              {t.completed && <span className="text-[10px] text-green-500">完了</span>}
                            </div>
                          </div>
                          <button onClick={() => toggleTask(group.id, t.id)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${t.completed?"bg-green-500 border-green-500":"border-gray-300 hover:border-green-400"}`}>
                            {t.completed && <IconCheck size={12} stroke="white" sw={3} />}
                          </button>
                        </div>
                      );
                    })
                  )}
                  <button onClick={handleAddFromCal}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors border-t border-gray-100">
                    <IconPlus size={15} />新しいタスクを追加
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── App ───
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [cats, setCats] = useState(DEFAULT_CATS);
  const [groups, setGroups] = useState([]);
  const [view, setView] = useState("list");
  const [filter, setFilter] = useState("week");
  const [catFilter, setCatFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [prefillDate, setPrefillDate] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [ready, setReady] = useState(false);

  // Touch drag state
  const [dragIdx, setDragIdx] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(0);
  const listRef = useRef(null);

  const touchDrag = useMemo(() => ({
    active: dragActive,
    dragIdx,
    start: (idx, y) => { setDragIdx(idx); setDragActive(true); dragStartY.current = y; setDragY(0); },
  }), [dragActive, dragIdx]);

  useEffect(() => {
    if (!dragActive) return;
    const onMove = (e) => {
      e.preventDefault();
      const y = e.touches[0].clientY;
      setDragY(y - dragStartY.current);
      // Calculate which index we're hovering over
      if (!listRef.current) return;
      const items = listRef.current.querySelectorAll("[data-task-idx]");
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (y > rect.top && y < rect.bottom) {
          const hoverIdx = parseInt(item.dataset.taskIdx);
          if (hoverIdx !== dragIdx) {
            // Reorder
            setTasks(prev => {
              const sorted2 = [...sortedRef.current];
              const [moved] = sorted2.splice(dragIdx, 1);
              sorted2.splice(hoverIdx, 0, moved);
              const norm = sorted2.filter(t => !t.priority && remaining(t.deadline).u < 4);
              const om = {}; norm.forEach((t, i) => { om[t.parentId || t.id] = i; });
              return prev.map(t => om[t.id] !== undefined ? { ...t, order: om[t.id] } : t);
            });
            setDragIdx(hoverIdx);
            dragStartY.current = y;
            setDragY(0);
          }
          break;
        }
      }
    };
    const onEnd = () => { setDragActive(false); setDragIdx(null); setDragY(0); };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    return () => { document.removeEventListener("touchmove", onMove); document.removeEventListener("touchend", onEnd); };
  }, [dragActive, dragIdx]);

  useEffect(() => { setTasks(loadT()); setCats(loadC()); setGroups(loadG()); setReady(true); }, []);
  useEffect(() => { if (ready) saveT(tasks); }, [tasks, ready]);
  useEffect(() => { if (ready) saveC(cats); }, [cats, ready]);
  useEffect(() => { if (ready) saveG(groups); }, [groups, ready]);

  const active = useMemo(() => tasks.filter(t => !t.completed), [tasks]);
  const completed = useMemo(() => tasks.filter(t => t.completed).sort((a,b) => new Date(b.completedAt)-new Date(a.completedAt)), [tasks]);

  const allExpanded = useMemo(() => {
    const horizon = new Date(); horizon.setDate(horizon.getDate()+90);
    const exp = [];
    active.forEach(t => { if (t.recurrence && t.recurrence !== "none") exp.push(...expandRecurring(t, horizon)); else exp.push(t); });
    // Inject group tasks assigned to "自分"
    groups.forEach(g => {
      g.tasks.filter(t => t.assignee === "自分" && !t.completed).forEach(t => {
        exp.push({ ...t, id: `grp_${g.id}_${t.id}`, isGroupTask: true, groupName: g.name, category: "default" });
      });
    });
    return exp;
  }, [active, groups]);

  const sorted = useMemo(() => {
    const now = Date.now();
    const fDays = FILTERS.find(f => f.id === filter)?.days ?? 7;
    let list = [...allExpanded];
    if (fDays !== Infinity) {
      const end = filter === "today" ? new Date(new Date().setHours(23,59,59,999)).getTime() : now + fDays*864e5;
      list = list.filter(t => new Date(t.deadline).getTime() <= end);
    }
    // Always include overdue
    allExpanded.filter(t => new Date(t.deadline).getTime() < now).forEach(t => { if (!list.find(l => l.id === t.id)) list.push(t); });
    // Category filter
    if (catFilter !== "all") list = list.filter(t => t.category === catFilter);

    // Sort: overdue first, then priority, then normal by deadline
    const overdue = list.filter(t => new Date(t.deadline).getTime() < now).sort((a,b) => new Date(a.deadline)-new Date(b.deadline));
    const notOverdue = list.filter(t => new Date(t.deadline).getTime() >= now);
    const pri = notOverdue.filter(t => t.priority).sort((a,b) => new Date(a.deadline)-new Date(b.deadline));
    const norm = notOverdue.filter(t => !t.priority);
    norm.sort((a,b) => { const ao=a.order??Infinity, bo=b.order??Infinity; if (ao!==Infinity||bo!==Infinity) { if (ao!==bo) return ao-bo; } return new Date(a.deadline)-new Date(b.deadline); });
    return [...overdue, ...pri, ...norm];
  }, [allExpanded, filter, catFilter]);

  // Keep a ref for touch drag to access
  const sortedRef = useRef(sorted);
  useEffect(() => { sortedRef.current = sorted; }, [sorted]);

  const weekDone = useMemo(() => { const w=Date.now()-7*864e5; return completed.filter(t => t.completedAt && new Date(t.completedAt).getTime()>w).length; }, [completed]);
  const overdueCount = allExpanded.filter(t => new Date(t.deadline).getTime() < Date.now()).length;

  const handleSave = useCallback((data) => { setTasks(prev => { const ex=prev.find(t=>t.id===data.id); return ex ? prev.map(t=>t.id===data.id?{...t,...data}:t) : [...prev,data]; }); setShowForm(false); setEditTask(null); setPrefillDate(null); }, []);
  const handleComplete = useCallback((task) => {
    if (task.isOccurrence) {
      const k = task.deadline.slice(0,16);
      setTasks(prev => prev.map(t => t.id===task.parentId ? {...t, completedOccurrences:[...(t.completedOccurrences||[]),k]} : t));
      setTasks(prev => [...prev, {...task, id:uid(), completed:true, completedAt:new Date().toISOString(), isOccurrence:false, parentId:undefined}]);
    } else { setTasks(prev => prev.map(t => t.id===task.id ? {...t, completed:true, completedAt:new Date().toISOString()} : t)); }
  }, []);
  const handleRestore = useCallback((id) => { setTasks(prev => prev.map(t => t.id===id ? {...t, completed:false, completedAt:null} : t)); }, []);
  const handleDeleteTask = useCallback((task) => {
    const id = task.parentId || task.id;
    if (task.isOccurrence) {
      // Mark this occurrence as completed/skipped
      const k = task.deadline.slice(0,16);
      setTasks(prev => prev.map(t => t.id===task.parentId ? {...t, completedOccurrences:[...(t.completedOccurrences||[]),k]} : t));
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  }, []);
  const handleDeleteFromForm = useCallback((id) => { setTasks(prev => prev.filter(t => t.id !== id)); setShowForm(false); setEditTask(null); }, []);
  const openNew = (date) => { setEditTask(null); setPrefillDate(date||null); setShowForm(true); };

  // Section labels
  const hasOverdue = sorted.some(t => new Date(t.deadline).getTime() < Date.now());
  const hasPriority = sorted.some(t => t.priority && new Date(t.deadline).getTime() >= Date.now());

  return (
    <div className="min-h-screen bg-white prioritodo-app" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div><h1 className="text-base font-bold text-gray-900 tracking-tight">PrioriTodo</h1><p className="text-[10px] text-gray-400 tracking-wide">次にやることが、すぐ分かる</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCatMgr(true)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="カテゴリ編集"><IconPalette size={17} stroke="#666" /></button>
            <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="設定"><IconSettings size={16} stroke="#666" /></button>
            <button onClick={() => setShowHelp(true)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="ヘルプ"><IconBook size={16} stroke="#666" /></button>
            {overdueCount>0 && <span className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">{overdueCount}件超過</span>}
            <div className="text-right leading-none"><div className="text-[10px] text-gray-400">今週</div><div className="text-base font-bold text-gray-900">{weekDone}<span className="text-[10px] text-gray-400 font-normal ml-0.5">達成</span></div></div>
          </div>
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 pt-3">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {[
            {id:"list",label:"タスク",icon:<IconList size={14}/>},
            {id:"calendar",label:"カレンダー",icon:<IconCalendar size={14}/>},
            {id:"group",label:"グループ",icon:<IconUsers size={14}/>},
            {id:"completed",label:"達成済み",icon:<IconArchive size={14}/>,count:completed.length},
          ].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id)} className={`flex items-center gap-1 px-3 py-2.5 text-[11px] font-medium transition-colors border-b-2 whitespace-nowrap ${view===tab.id?"border-gray-900 text-gray-900":"border-transparent text-gray-400 hover:text-gray-600"}`}>
              {tab.icon}{tab.label}{tab.count>0 && <span className="text-[10px] ml-0.5 text-gray-300">{tab.count}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-lg mx-auto pb-24">
        {view==="list" && (<>
          <div className="px-4 pt-3 pb-1 flex gap-1.5 overflow-x-auto">
            {FILTERS.map(f => <button key={f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${filter===f.id?"bg-gray-900 text-white":"bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>{f.label}</button>)}
          </div>
          <div className="px-4 py-2 flex gap-1.5 overflow-x-auto border-b border-gray-100">
            <button onClick={() => setCatFilter("all")} className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter==="all"?"bg-gray-200 text-gray-900":"text-gray-400 hover:text-gray-600"}`}>すべて</button>
            {cats.map(c => <button key={c.id} onClick={() => setCatFilter(c.id)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter===c.id?"text-white":"text-gray-500 hover:bg-gray-50"}`} style={catFilter===c.id?{backgroundColor:c.color}:{}}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:catFilter===c.id?"rgba(255,255,255,0.7)":c.color}} />{c.label}</button>)}
          </div>
          {sorted.length===0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400"><IconList size={32} stroke="#ddd" /><p className="text-sm mt-3">タスクなし</p><p className="text-xs mt-1 text-gray-300">右下の + から追加</p></div>
          ) : (<div ref={listRef}>
            {sorted.map((t, i) => {
              const now = Date.now();
              const tTime = new Date(t.deadline).getTime();
              const isOD = tTime < now;
              const prevIsOD = i > 0 && new Date(sorted[i-1].deadline).getTime() < now;
              const showODLabel = i === 0 && isOD;
              const showPriLabel = !isOD && t.priority && (i === 0 || (prevIsOD && !isOD) || (i > 0 && !sorted[i-1].priority && sorted[i-1].deadline && new Date(sorted[i-1].deadline).getTime() >= now));
              const showNormLabel = !isOD && !t.priority && i > 0 && (new Date(sorted[i-1].deadline).getTime() < now || sorted[i-1].priority);
              return (
                <div key={t.id} data-task-idx={i}>
                  {showODLabel && <div className="px-4 pt-2 pb-1"><span className="text-[10px] font-semibold text-red-500 tracking-widest uppercase">期限超過</span></div>}
                  {showPriLabel && <div className="px-4 pt-3 pb-1"><span className="text-[10px] font-semibold text-red-500 tracking-widest uppercase">最優先</span></div>}
                  {showNormLabel && <div className="px-4 pt-3 pb-1"><span className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase">その他</span></div>}
                  <TaskRow task={t} cats={cats} idx={i} touchDrag={touchDrag}
                    onComplete={handleComplete} onEdit={t=>{setEditTask(t);setPrefillDate(null);setShowForm(true);}}
                    onDelete={handleDeleteTask} />
                </div>
              );
            })}
          </div>)}
          {sorted.length>0 && (
            <div className="px-4 py-4">
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
                <span>表示中 {sorted.length}件 / 全{allExpanded.length}件</span>
                <span>今週の達成率 {Math.round((weekDone/Math.max(weekDone+active.length,1))*100)}%</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-900 rounded-full transition-all duration-700" style={{width:`${Math.min(100,(weekDone/Math.max(weekDone+active.length,1))*100)}%`}} /></div>
            </div>
          )}
        </>)}
        {view==="calendar" && <div className="px-4 py-4"><CalendarView tasks={allExpanded} cats={cats} month={calMonth} setMonth={setCalMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onAddClick={d=>openNew(d)} onEditTask={t=>{setEditTask(t);setPrefillDate(null);setShowForm(true);}} /></div>}

        {/* Group View */}
        {view==="group" && <GroupView groups={groups} setGroups={setGroups} />}

        {view==="completed" && <div><div className="px-4 py-3 flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">達成済み</span><span className="text-[11px] text-gray-400">{completed.length}件</span></div><CompletedList tasks={completed} cats={cats} onRestore={handleRestore} /></div>}
      </div>
      <button onClick={() => openNew(null)} className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center"><IconPlus size={20} sw={2.5} /></button>
      {showForm && <TaskForm task={editTask} prefillDate={prefillDate} cats={cats} setCats={setCats} onSave={handleSave} onDelete={handleDeleteFromForm} onClose={() => {setShowForm(false);setEditTask(null);setPrefillDate(null);}} />}
      {showCatMgr && <CategoryManager cats={cats} setCats={setCats} onClose={() => setShowCatMgr(false)} />}

      {/* Settings */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <button onClick={() => setShowSettings(false)} className="text-sm text-blue-500 font-medium">戻る</button>
            <span className="text-sm font-semibold text-gray-900">設定</span><div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
              <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-900">壁紙</span>
                <span className="text-sm text-gray-400">近日公開</span>
              </div>
              <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-900">完了エフェクト</span>
                <span className="text-sm text-gray-400">近日公開</span>
              </div>
              <div className="px-4 py-3.5 flex items-center justify-between">
                <span className="text-sm text-gray-900">言語</span>
                <span className="text-sm text-gray-400">日本語</span>
              </div>
            </div>
            <p className="px-4 pt-3 text-xs text-gray-400">今後のアップデートで壁紙テーマやパーティクルエフェクトのカスタマイズが追加されます。</p>
          </div>
        </div>
      )}

      {/* Help */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <button onClick={() => setShowHelp(false)} className="text-sm text-blue-500 font-medium">戻る</button>
            <span className="text-sm font-semibold text-gray-900">使い方</span><div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mt-4 mx-4 space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">PrioriTodoとは</h3>
                <p className="text-xs text-gray-500 leading-relaxed">「次にやることが、すぐ分かる」をコンセプトにした優先順位自動整理タスク管理アプリです。締切が近い順に自動でソートされ、開いた瞬間に何をすべきか一目で分かります。</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">基本操作</h3>
                <div className="space-y-2 text-xs text-gray-500 leading-relaxed">
                  <p><span className="font-medium text-gray-700">タスク追加：</span>右下の「+」ボタン、またはカレンダーの日付をタップ</p>
                  <p><span className="font-medium text-gray-700">完了：</span>チェックボックスをタップ</p>
                  <p><span className="font-medium text-gray-700">編集：</span>タスクをタップ</p>
                  <p><span className="font-medium text-gray-700">削除：</span>左にスワイプ（モバイル）/ 右クリック（PC）</p>
                  <p><span className="font-medium text-gray-700">並び替え：</span>長押しして上下にドラッグ</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">最優先フラグ</h3>
                <p className="text-xs text-gray-500 leading-relaxed">締切に関わらずリスト上部に固定表示されます。すぐにやらないといけないタスクに設定してください。</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">繰り返しタスク</h3>
                <p className="text-xs text-gray-500 leading-relaxed">毎週の授業課題など、定期的なタスクを自動で生成します。終了日と回数は連動し、曜日のズレも自動で補正されます。デフォルトは15回（半期分）です。</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">表示フィルター</h3>
                <p className="text-xs text-gray-500 leading-relaxed">期間（今日〜すべて）とカテゴリで絞り込めます。「今週」×「授業」で今週の授業タスクだけ表示するなど、組み合わせて使えます。</p>
              </div>
            </div>
            <div className="h-8" />
          </div>
        </div>
      )}
    </div>
  );
}
