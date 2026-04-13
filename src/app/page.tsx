"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FILTERS, DEFAULT_CATS, DEFAULT_TIMETABLE_CONFIG } from "@/lib/constants";
import { expandRecurring, remaining, uid } from "@/lib/utils";
import { Category, Group, Task, TimetableConfig, TimetableItem, TouchDragState } from "@/lib/types";
import { IconArchive, IconBook, IconCalendar, IconClock, IconList, IconPalette, IconPlus, IconSettings, IconUsers } from "@/components/Icons";
import TaskRow from "@/components/TaskRow";
import TaskForm from "@/components/TaskForm";
import CategoryManager from "@/components/CategoryManager";
import CalendarView from "@/components/CalendarView";
import CompletedList from "@/components/CompletedList";
import GroupView from "@/components/GroupView";
import TimetableView from "@/components/TimetableView";
import { auth, firebaseEnabled, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, signInWithRedirect, User, browserLocalPersistence, getRedirectResult, setPersistence } from "firebase/auth";
import { loadCloudSnapshot, migrateLocalToCloudOnce, saveCloudSnapshot } from "@/lib/cloudStorage";
import { createTimetablePresetToken, loadTimetablePresetFromToken } from "@/lib/timetableShare";

type View = "list" | "calendar" | "timetable" | "group" | "completed";
const isMobileBrowser = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cats, setCats] = useState<Category[]>(DEFAULT_CATS);
  const [groups, setGroups] = useState<Group[]>([]);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [timetableConfig, setTimetableConfig] = useState<TimetableConfig>(DEFAULT_TIMETABLE_CONFIG);
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState("week");
  const [catFilter, setCatFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [prefillDate, setPrefillDate] = useState<Date | null>(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const importedPresetRef = useRef<string | null>(null);

  const touchDrag = useMemo<TouchDragState>(
    () => ({
      active: dragActive,
      dragIdx,
      start: (idx, y) => {
        setDragIdx(idx);
        setDragActive(true);
        dragStartY.current = y;
        setDragY(0);
      },
    }),
    [dragActive, dragIdx]
  );

  useEffect(() => {
    if (!dragActive) return;
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const y = e.touches[0].clientY;
      setDragY(y - dragStartY.current);
      if (!listRef.current || dragIdx === null) return;
      const items = listRef.current.querySelectorAll<HTMLElement>("[data-task-idx]");
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (y > rect.top && y < rect.bottom) {
          const hoverIdx = Number(item.dataset.taskIdx);
          if (hoverIdx !== dragIdx) {
            setTasks((prev) => {
              const sorted2 = [...sortedRef.current];
              const [moved] = sorted2.splice(dragIdx, 1);
              sorted2.splice(hoverIdx, 0, moved);
              const norm = sorted2.filter((t) => !t.priority && remaining(t.deadline).u < 4);
              const om: Record<string, number> = {};
              norm.forEach((t, i) => {
                om[t.parentId || t.id] = i;
              });
              return prev.map((t) => (om[t.id] !== undefined ? { ...t, order: om[t.id] } : t));
            });
            setDragIdx(hoverIdx);
            dragStartY.current = y;
            setDragY(0);
          }
          break;
        }
      }
    };
    const onEnd = () => {
      setDragActive(false);
      setDragIdx(null);
      setDragY(0);
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [dragActive, dragIdx]);

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setAuthReady(true);
      return;
    }
    setPersistence(auth, browserLocalPersistence).catch(() => { /* ignore */ });
    getRedirectResult(auth).catch((err: { code?: string }) => {
      console.error("Redirect result error:", err);
      const code = err?.code;
      if (code === "auth/unauthorized-domain") {
        setAuthErrorMessage("認証ドメイン設定が不足しています（管理者に連絡してください）");
        return;
      }
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        setAuthErrorMessage("このブラウザではログインに制限があります。Safari/Chromeで開いてください。");
        return;
      }
      setAuthErrorMessage("ログインに失敗しました。時間をおいて再試行してください。");
    });
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) setAuthErrorMessage(null);
    });
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setReady(false);
      return;
    }
    let mounted = true;
    const sync = async () => {
      setSyncing(true);
      try {
        await migrateLocalToCloudOnce(user.uid);
        const snapshot = await loadCloudSnapshot(user.uid);
        if (!mounted) return;
        setTasks(snapshot.tasks);
        setCats(snapshot.cats);
        setGroups(snapshot.groups);
        setTimetable(snapshot.timetable);
        setTimetableConfig(snapshot.timetableConfig);
        setReady(true);
      } finally {
        if (mounted) setSyncing(false);
      }
    };
    sync();
    return () => {
      mounted = false;
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!ready || !user) return;
    const timer = setTimeout(() => {
      saveCloudSnapshot(user.uid, { tasks, cats, groups, timetable, timetableConfig });
    }, 250);
    return () => clearTimeout(timer);
  }, [tasks, cats, groups, timetable, timetableConfig, ready, user]);

  useEffect(() => {
    if (!ready || !user) return;
    const params = new URLSearchParams(window.location.search);
    const presetId = params.get("preset");
    if (!presetId || importedPresetRef.current === presetId) return;
    importedPresetRef.current = presetId;
    const preset = loadTimetablePresetFromToken(presetId);
    if (!preset) return;
    const nextTimetable = preset.timetable.map((it) => ({ ...it, id: uid() }));
    setTimetable(nextTimetable);
    setTimetableConfig(preset.timetableConfig);
    setCats((prev) => {
      const withoutTimetable = prev.filter((c) => !c.timetableId);
      const fromTimetable = nextTimetable.map((it) => ({
        id: uid(),
        label: it.name,
        color: it.color,
        timetableId: it.id,
      }));
      return [...withoutTimetable, ...fromTimetable];
    });
    params.delete("preset");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [ready, user]);

  useEffect(() => {
    if (view !== "calendar") setSelectedDate(null);
  }, [view]);

  const active = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completed = useMemo(
    () => tasks.filter((t) => t.completed).sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()),
    [tasks]
  );

  const allExpanded = useMemo(() => {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 90);
    const exp: Task[] = [];
    active.forEach((t) => {
      if (t.recurrence && t.recurrence !== "none") exp.push(...expandRecurring(t, horizon));
      else exp.push(t);
    });
    groups.forEach((g) => {
      g.tasks.filter((t) => t.assignee === "自分" && !t.completed).forEach((t) => {
        exp.push({
          ...t,
          id: `grp_${g.id}_${t.id}`,
          isGroupTask: true,
          groupName: g.name,
          category: "default",
          priority: false,
          recurrence: "none",
          repeatCount: null,
          repeatEndDate: null,
          reminder: "none",
          memo: "",
          url: "",
          completedAt: null,
          completedOccurrences: [],
          order: null,
        });
      });
    });
    return exp;
  }, [active, groups]);

  const sorted = useMemo(() => {
    const now = Date.now();
    const fDays = FILTERS.find((f) => f.id === filter)?.days ?? 7;
    let list = [...allExpanded];
    if (fDays !== Infinity) {
      const end = filter === "today" ? new Date(new Date().setHours(23, 59, 59, 999)).getTime() : now + fDays * 864e5;
      list = list.filter((t) => new Date(t.deadline).getTime() <= end);
    }
    allExpanded.filter((t) => new Date(t.deadline).getTime() < now).forEach((t) => {
      if (!list.find((l) => l.id === t.id)) list.push(t);
    });
    if (catFilter !== "all") list = list.filter((t) => t.category === catFilter);

    const overdue = list.filter((t) => new Date(t.deadline).getTime() < now).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    const notOverdue = list.filter((t) => new Date(t.deadline).getTime() >= now);
    const pri = notOverdue.filter((t) => t.priority).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    const norm = notOverdue.filter((t) => !t.priority);
    norm.sort((a, b) => {
      const ao = a.order ?? Infinity;
      const bo = b.order ?? Infinity;
      if (ao !== Infinity || bo !== Infinity) {
        if (ao !== bo) return ao - bo;
      }
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
    return [...overdue, ...pri, ...norm];
  }, [allExpanded, filter, catFilter]);

  const sortedRef = useRef<Task[]>(sorted);
  useEffect(() => {
    sortedRef.current = sorted;
  }, [sorted]);

  const weekDone = useMemo(() => {
    const w = Date.now() - 7 * 864e5;
    return completed.filter((t) => t.completedAt && new Date(t.completedAt).getTime() > w).length;
  }, [completed]);
  const overdueCount = allExpanded.filter((t) => new Date(t.deadline).getTime() < Date.now()).length;

  const handleSave = useCallback((data: Task) => {
    setTasks((prev) => {
      const ex = prev.find((t) => t.id === data.id);
      return ex ? prev.map((t) => (t.id === data.id ? { ...t, ...data } : t)) : [...prev, data];
    });
    setShowForm(false);
    setEditTask(null);
    setPrefillDate(null);
  }, []);

  const handleComplete = useCallback((task: Task) => {
    if (task.isOccurrence) {
      const k = task.deadline.slice(0, 16);
      setTasks((prev) => prev.map((t) => (t.id === task.parentId ? { ...t, completedOccurrences: [...(t.completedOccurrences || []), k] } : t)));
      setTasks((prev) => [...prev, { ...task, id: uid(), completed: true, completedAt: new Date().toISOString(), isOccurrence: false, parentId: undefined }]);
    } else {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t)));
    }
  }, []);

  const handleRestore = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: false, completedAt: null } : t)));
  }, []);

  const handleDeleteTask = useCallback((task: Task) => {
    const id = task.parentId || task.id;
    if (task.isOccurrence) {
      const k = task.deadline.slice(0, 16);
      setTasks((prev) => prev.map((t) => (t.id === task.parentId ? { ...t, completedOccurrences: [...(t.completedOccurrences || []), k] } : t)));
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }, []);

  const handleDeleteFromForm = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setShowForm(false);
    setEditTask(null);
  }, []);

  const openNew = (date: Date | null) => {
    setEditTask(null);
    setPrefillDate(date || null);
    setShowForm(true);
  };

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) return;
    setAuthErrorMessage(null);
    try {
      if (isMobileBrowser()) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login error:", e);
      const code = (e as { code?: string })?.code;
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      if (code === "auth/unauthorized-domain") {
        setAuthErrorMessage("認証ドメインが未設定です。管理者に連絡してください。");
        return;
      }
      setAuthErrorMessage("ログインに失敗しました。Safari/Chromeで再試行してください。");
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    setTasks([]);
    setCats(DEFAULT_CATS);
    setGroups([]);
    setTimetable([]);
    setTimetableConfig(DEFAULT_TIMETABLE_CONFIG);
  };

  const handleShareTimetable = async (): Promise<string | null> => {
    if (!user || timetable.length === 0) return null;
    const presetId = createTimetablePresetToken({
      timetable,
      timetableConfig,
    });
    return `${window.location.origin}?preset=${presetId}`;
  };

  if (!firebaseEnabled) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Firebase設定が必要です</h1>
          <p className="text-sm text-gray-500 mt-2">
            NEXT_PUBLIC_FIREBASE_* の環境変数を設定してから再起動してください。
          </p>
        </div>
      </div>
    );
  }

  if (!authReady || syncing) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <p className="text-sm text-gray-500">データを同期中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-lg font-bold text-gray-900">PrioriTodoへようこそ</h1>
          <p className="text-sm text-gray-500 mt-2">Googleでログインして、クラウド同期を有効化してください。</p>
          {authErrorMessage && <p className="text-xs text-red-500 mt-2">{authErrorMessage}</p>}
          <button
            onClick={handleGoogleLogin}
            className="mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium"
          >
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white prioritodo-app" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div><h1 className="text-base font-bold text-gray-900 tracking-tight">PrioriTodo</h1><p className="text-[10px] text-gray-400 tracking-wide">次にやることが、すぐ分かる</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCatMgr(true)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="カテゴリ編集"><IconPalette size={17} stroke="#666" /></button>
            <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="設定"><IconSettings size={16} stroke="#666" /></button>
            <button onClick={() => setShowHelp(true)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="ヘルプ"><IconBook size={16} stroke="#666" /></button>
            <button onClick={handleLogout} className="text-[11px] text-gray-500 border border-gray-200 px-2 py-1 rounded-md">ログアウト</button>
            {overdueCount > 0 && <span className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">{overdueCount}件超過</span>}
            <div className="text-right leading-none"><div className="text-[10px] text-gray-400">今週</div><div className="text-base font-bold text-gray-900">{weekDone}<span className="text-[10px] text-gray-400 font-normal ml-0.5">達成</span></div></div>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-3">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {[
            { id: "list", label: "タスク", icon: <IconList size={14} /> },
            { id: "calendar", label: "カレンダー", icon: <IconCalendar size={14} /> },
            { id: "timetable", label: "時間割", icon: <IconClock size={14} /> },
            { id: "group", label: "グループ", icon: <IconUsers size={14} /> },
            { id: "completed", label: "達成済み", icon: <IconArchive size={14} />, count: completed.length },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setView(tab.id as View)} className={`flex items-center gap-1 px-3 py-2.5 text-[11px] font-medium transition-colors border-b-2 whitespace-nowrap ${view === tab.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {tab.icon}{tab.label}{(tab.count || 0) > 0 && <span className="text-[10px] ml-0.5 text-gray-300">{tab.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto pb-24">
        {view === "list" && (
          <>
            <div className="px-4 pt-3 pb-1 flex gap-1.5 overflow-x-auto">
              {FILTERS.map((f) => <button key={f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${filter === f.id ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>{f.label}</button>)}
            </div>
            <div className="px-4 py-2 flex gap-1.5 overflow-x-auto border-b border-gray-100">
              <button onClick={() => setCatFilter("all")} className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === "all" ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>すべて</button>
              {cats.map((c) => <button key={c.id} onClick={() => setCatFilter(c.id)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === c.id ? "text-white" : "text-gray-500 hover:bg-gray-50"}`} style={catFilter === c.id ? { backgroundColor: c.color } : {}}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catFilter === c.id ? "rgba(255,255,255,0.7)" : c.color }} />{c.label}</button>)}
            </div>
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400"><IconList size={32} stroke="#ddd" /><p className="text-sm mt-3">タスクなし</p><p className="text-xs mt-1 text-gray-300">右下の + から追加</p></div>
            ) : (
              <div ref={listRef}>
                {sorted.map((t, i) => {
                  const now = Date.now();
                  const tTime = new Date(t.deadline).getTime();
                  const isOD = tTime < now;
                  const prevIsOD = i > 0 && new Date(sorted[i - 1].deadline).getTime() < now;
                  const showODLabel = i === 0 && isOD;
                  const showPriLabel = !isOD && t.priority && (i === 0 || (prevIsOD && !isOD) || (i > 0 && !sorted[i - 1].priority && new Date(sorted[i - 1].deadline).getTime() >= now));
                  const showNormLabel = !isOD && !t.priority && i > 0 && (new Date(sorted[i - 1].deadline).getTime() < now || sorted[i - 1].priority);
                  return (
                    <div key={t.id} data-task-idx={i} style={dragActive && dragIdx === i ? { transform: `translateY(${dragY}px)` } : {}}>
                      {showODLabel && <div className="px-4 pt-2 pb-1"><span className="text-[10px] font-semibold text-red-500 tracking-widest uppercase">期限超過</span></div>}
                      {showPriLabel && <div className="px-4 pt-3 pb-1"><span className="text-[10px] font-semibold text-red-500 tracking-widest uppercase">最優先</span></div>}
                      {showNormLabel && <div className="px-4 pt-3 pb-1"><span className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase">その他</span></div>}
                      <TaskRow task={t} cats={cats} idx={i} touchDrag={touchDrag} onComplete={handleComplete} onEdit={(task) => { setEditTask(task); setPrefillDate(null); setShowForm(true); }} onDelete={handleDeleteTask} />
                    </div>
                  );
                })}
              </div>
            )}
            {sorted.length > 0 && (
              <div className="px-4 py-4">
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
                  <span>表示中 {sorted.length}件 / 全{allExpanded.length}件</span>
                  <span>今週の達成率 {Math.round((weekDone / Math.max(weekDone + active.length, 1)) * 100)}%</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-900 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (weekDone / Math.max(weekDone + active.length, 1)) * 100)}%` }} /></div>
              </div>
            )}
          </>
        )}

        {view === "calendar" && <div className="px-4 py-4"><CalendarView tasks={allExpanded} cats={cats} month={calMonth} setMonth={setCalMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onAddClick={(d) => openNew(d)} onEditTask={(t) => { setEditTask(t); setPrefillDate(null); setShowForm(true); }} /></div>}
        {view === "timetable" && <TimetableView items={timetable} setItems={setTimetable} setCats={setCats} config={timetableConfig} setConfig={setTimetableConfig} onShare={handleShareTimetable} />}
        {view === "group" && <GroupView groups={groups} setGroups={setGroups} />}
        {view === "completed" && <div><div className="px-4 py-3 flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">達成済み</span><span className="text-[11px] text-gray-400">{completed.length}件</span></div><CompletedList tasks={completed} cats={cats} onRestore={handleRestore} /></div>}
      </div>

      <button onClick={() => openNew(null)} className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center"><IconPlus size={20} sw={2.5} /></button>
      {showForm && <TaskForm task={editTask} prefillDate={prefillDate} cats={cats} setCats={setCats} onSave={handleSave} onDelete={handleDeleteFromForm} onClose={() => { setShowForm(false); setEditTask(null); setPrefillDate(null); }} />}
      {showCatMgr && <CategoryManager cats={cats} setCats={setCats} onClose={() => setShowCatMgr(false)} />}

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <button onClick={() => setShowSettings(false)} className="text-sm text-blue-500 font-medium">戻る</button>
            <span className="text-sm font-semibold text-gray-900">設定</span><div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
              <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between"><span className="text-sm text-gray-900">壁紙</span><span className="text-sm text-gray-400">近日公開</span></div>
              <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between"><span className="text-sm text-gray-900">完了エフェクト</span><span className="text-sm text-gray-400">近日公開</span></div>
              <div className="px-4 py-3.5 flex items-center justify-between"><span className="text-sm text-gray-900">言語</span><span className="text-sm text-gray-400">日本語</span></div>
            </div>
            <p className="px-4 pt-3 text-xs text-gray-400">今後のアップデートで壁紙テーマやパーティクルエフェクトのカスタマイズが追加されます。</p>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <button onClick={() => setShowHelp(false)} className="text-sm text-blue-500 font-medium">戻る</button>
            <span className="text-sm font-semibold text-gray-900">使い方</span><div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto"><div className="mt-4 mx-4 space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4"><h3 className="text-sm font-semibold text-gray-900 mb-2">PrioriTodoとは</h3><p className="text-xs text-gray-500 leading-relaxed">「次にやることが、すぐ分かる」をコンセプトにした優先順位自動整理タスク管理アプリです。締切が近い順に自動でソートされ、開いた瞬間に何をすべきか一目で分かります。</p></div>
            <div className="bg-white rounded-xl border border-gray-100 p-4"><h3 className="text-sm font-semibold text-gray-900 mb-2">基本操作</h3><div className="space-y-2 text-xs text-gray-500 leading-relaxed"><p><span className="font-medium text-gray-700">タスク追加：</span>右下の「+」ボタン、またはカレンダーの日付をタップ</p><p><span className="font-medium text-gray-700">完了：</span>チェックボックスをタップ</p><p><span className="font-medium text-gray-700">編集：</span>タスクをタップ</p><p><span className="font-medium text-gray-700">削除：</span>左にスワイプ（モバイル）/ 右クリック（PC）</p><p><span className="font-medium text-gray-700">並び替え：</span>長押しして上下にドラッグ</p></div></div>
            <div className="bg-white rounded-xl border border-gray-100 p-4"><h3 className="text-sm font-semibold text-gray-900 mb-2">最優先フラグ</h3><p className="text-xs text-gray-500 leading-relaxed">締切に関わらずリスト上部に固定表示されます。すぐにやらないといけないタスクに設定してください。</p></div>
            <div className="bg-white rounded-xl border border-gray-100 p-4"><h3 className="text-sm font-semibold text-gray-900 mb-2">繰り返しタスク</h3><p className="text-xs text-gray-500 leading-relaxed">毎週の授業課題など、定期的なタスクを自動で生成します。終了日と回数は連動し、曜日のズレも自動で補正されます。デフォルトは15回（半期分）です。</p></div>
            <div className="bg-white rounded-xl border border-gray-100 p-4"><h3 className="text-sm font-semibold text-gray-900 mb-2">表示フィルター</h3><p className="text-xs text-gray-500 leading-relaxed">期間（今日〜すべて）とカテゴリで絞り込めます。「今週」×「授業」で今週の授業タスクだけ表示するなど、組み合わせて使えます。</p></div>
          </div><div className="h-8" /></div>
        </div>
      )}
    </div>
  );
}
