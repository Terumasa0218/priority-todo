"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FILTERS, DEFAULT_CATS, DEFAULT_TIMETABLE_CONFIG, WEEKDAY_LABELS } from "@/lib/constants";
import { expandRecurring, remaining, uid } from "@/lib/utils";
import { Category, Group, Task, TimetableConfig, TimetableItem, TouchDragState } from "@/lib/types";
import { IconBook, IconList, IconPalette, IconPlus, IconSettings } from "@/components/Icons";
import TaskRow from "@/components/TaskRow";
import TaskForm from "@/components/TaskForm";
import CategoryManager from "@/components/CategoryManager";
import CalendarView from "@/components/CalendarView";
import CompletedList from "@/components/CompletedList";
import GroupView from "@/components/GroupView";
import TimetableView from "@/components/TimetableView";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import SurfaceCard from "@/components/ui/SurfaceCard";
import EmptyState from "@/components/ui/EmptyState";
import { auth, firebaseEnabled, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, signInWithRedirect, User, browserLocalPersistence, getRedirectResult, setPersistence } from "firebase/auth";
import { deleteCloudSnapshot, loadCloudSnapshot, migrateLocalToCloudOnce, saveCloudSnapshot } from "@/lib/cloudStorage";
import { createTimetableShareToken, loadTimetableShareToken } from "@/lib/timetableShare";
import { AuthIssue, resolveAuthIssue } from "@/lib/authErrorCatalog";

type View = "list" | "calendar" | "timetable" | "group" | "completed";
const isInAppBrowser = () => /FBAN|FBAV|Instagram|Line|Twitter|wv|WebView|GSA|LinkedInApp|Slack|Discord|GitHub/i.test(navigator.userAgent);
const isMobileDevice = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

const migratePeriod = (period: string | number): string => {
  if (typeof period === "string") {
    if (period === "1限" || period === "2限") return "1・2限";
    if (period === "3限" || period === "4限") return "3・4限";
    if (period === "5限" || period === "6限") return "5・6限";
    return period;
  }
  if (period <= 2) return "1・2限";
  if (period <= 4) return "3・4限";
  if (period <= 6) return "5・6限";
  return `オンデマンド${period}`;
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cats, setCats] = useState<Category[]>(DEFAULT_CATS);
  const [groups, setGroups] = useState<Group[]>([]);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [timetableConfig, setTimetableConfig] = useState<TimetableConfig>(DEFAULT_TIMETABLE_CONFIG);
  const [view, setView] = useState<View>("list");
  const [activeFilter, setActiveFilter] = useState("week");
  // Backward-compatible aliases for in-progress refactors in this file.
  // This prevents accidental unresolved references when `filter` names remain.
  const filter = activeFilter;
  const setFilter = setActiveFilter;
  const [catFilter, setCatFilter] = useState("all");
  const [showCourseFilters, setShowCourseFilters] = useState(false);
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
  const [authIssue, setAuthIssue] = useState<AuthIssue | null>(null);
  const [authFlowMessage, setAuthFlowMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const inAppBrowser = useMemo(() => (typeof navigator !== "undefined" ? isInAppBrowser() : false), []);
  const iosDevice = useMemo(() => (typeof navigator !== "undefined" ? isIOS() : false), []);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const importedPresetRef = useRef<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof loadTimetableShareToken> | null>(null);

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
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) setAuthFlowMessage("ログイン情報を確認中...");
      })
      .catch((err: { code?: string }) => {
        console.error("Redirect result error:", err);
        setAuthIssue(resolveAuthIssue(err?.code));
      });
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        setAuthIssue(null);
        setAuthFlowMessage(null);
      }
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
        setTimetable(snapshot.timetable.map((it) => ({ ...it, period: migratePeriod(it.period as string | number) })));
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
    const params = new URLSearchParams(window.location.search);
    const shareToken = params.get("t");
    if (!shareToken || importedPresetRef.current === shareToken) return;
    importedPresetRef.current = shareToken;
    const parsed = loadTimetableShareToken(shareToken);
    if (parsed) setPendingImport(parsed);
  }, [ready, user]);

  const clearShareQuery = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("t");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  };
  useEffect(() => {
    if (view !== "calendar") setSelectedDate(null);
  }, [view]);

  useEffect(() => {
    setCats((prev) => {
      const timetableIds = new Set(timetable.map((it) => it.id));
      const trimmed = prev.filter((c) => !c.timetableId || timetableIds.has(c.timetableId));
      const existing = new Set(trimmed.filter((c) => c.timetableId).map((c) => c.timetableId));
      const appended = timetable
        .filter((it) => !existing.has(it.id))
        .map((it) => ({ id: uid(), label: it.name, color: it.color, timetableId: it.id }));
      const renamed = trimmed.map((c) => {
        if (!c.timetableId) return c;
        const it = timetable.find((x) => x.id === c.timetableId);
        return it ? { ...c, label: it.name, color: it.color } : c;
      });
      return [...renamed, ...appended];
    });
  }, [timetable, setCats]);

  const active = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completed = useMemo(
    () => tasks.filter((t) => t.completed).sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()),
    [tasks]
  );

  const timetableCats = useMemo(() => cats.filter((c) => !!c.timetableId), [cats]);
  const normalCats = useMemo(() => cats.filter((c) => !c.timetableId), [cats]);

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
    if (catFilter === "timetable_group") {
      const timetableIds = new Set(timetableCats.map((c) => c.id));
      list = list.filter((t) => timetableIds.has(t.category));
    } else if (catFilter !== "all") {
      list = list.filter((t) => t.category === catFilter);
    }

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
  }, [allExpanded, filter, catFilter, timetableCats]);

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
    if (!auth || !googleProvider || authBusy) return;
    setAuthBusy(true);
    setAuthIssue(null);
    setAuthFlowMessage(null);
    if (inAppBrowser) {
      setAuthFlowMessage("アプリ内ブラウザです。失敗する場合は下の「Safari / Chromeで開く」を使ってください。");
    }
    try {
      if (isMobileDevice() || inAppBrowser) {
        await signInWithRedirect(auth, googleProvider);
        return;
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (e) {
      console.error("Login error:", e);
      const code = (e as { code?: string })?.code;
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        setAuthFlowMessage("ポップアップに失敗したため、リダイレクトで再試行します…");
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      setAuthIssue(resolveAuthIssue(code));
    } finally {
      setAuthBusy(false);
    }
  };

  const copyCurrentUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAuthFlowMessage("URLをコピーしました。Safari / Chrome に貼り付けて開いてください。");
    } catch {
      setAuthFlowMessage("URLコピーに失敗しました。アドレスバーからURLをコピーしてSafari / Chromeで開いてください。");
    }
  };

  const openInExternalBrowser = (target: "auto" | "safari" | "chrome" = "auto") => {
    const currentUrl = window.location.href;
    if (/Line/i.test(navigator.userAgent)) {
      window.location.href = `https://line.me/R/openExternalBrowser?url=${encodeURIComponent(currentUrl)}`;
      return;
    }
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      if (target === "chrome") {
        const chromeUrl = currentUrl.startsWith("https://")
          ? currentUrl.replace(/^https:\/\//, "googlechromes://")
          : currentUrl.replace(/^http:\/\//, "googlechrome://");
        window.location.href = chromeUrl;
        return;
      }
      window.location.href = `x-safari-${currentUrl}`;
      return;
    }
    if (/Android/i.test(navigator.userAgent)) {
      const withoutProtocol = currentUrl.replace(/^https?:\/\//, "");
      window.location.href = `intent://${withoutProtocol}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }
    if (/GitHub|Instagram|FBAN|FBAV|Twitter|GSA|LinkedInApp|Slack|Discord/i.test(navigator.userAgent)) {
      void copyCurrentUrlToClipboard();
      return;
    }
    window.open(currentUrl, "_blank", "noopener,noreferrer");
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

  const handleResetAllData = async () => {
    const first = window.confirm("すべてのデータを削除しますか？この操作は取り消せません。");
    if (!first) return;
    const second = window.confirm("本当に削除しますか？タスク・時間割・カテゴリがすべて消えます。");
    if (!second) return;
    if (user) await deleteCloudSnapshot(user.uid);
    localStorage.clear();
    setTasks([]);
    setCats(DEFAULT_CATS);
    setGroups([]);
    setTimetable([]);
    setTimetableConfig(DEFAULT_TIMETABLE_CONFIG);
    window.location.reload();
  };

  const handleShareTimetable = async (): Promise<string | null> => {
    if (timetable.length === 0) return null;
    const token = createTimetableShareToken(timetable);
    return `${window.location.origin}/?t=${token}`;
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
          {inAppBrowser && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-left">
              <p className="text-xs text-amber-700 font-medium">このアプリ内ブラウザではGoogleログインできません。</p>
              <p className="text-[11px] text-amber-700 mt-0.5">右上メニューからSafari / Chromeで開くか、URLをコピーして外部ブラウザで開いてください。</p>
            </div>
          )}
          {authFlowMessage && <p className="text-xs text-gray-500 mt-2">{authFlowMessage}</p>}
          {authIssue && (
            <div className="mt-2">
              <p className="text-xs text-red-500">ログインに失敗しました {authIssue.id}</p>
              <p className="text-[11px] text-red-400 mt-0.5">{authIssue.summary}</p>
              {authIssue.id === 407 && (
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => openInExternalBrowser("safari")} disabled={authBusy} className="text-[11px] font-medium text-blue-500 underline disabled:opacity-50">
                    Safariで開く
                  </button>
                  {iosDevice && (
                    <button onClick={() => openInExternalBrowser("chrome")} disabled={authBusy} className="text-[11px] font-medium text-blue-500 underline disabled:opacity-50">
                      Chromeで開く
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
            <button
              onClick={handleGoogleLogin}
            disabled={authBusy}
            className="mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-60"
          >
            {authBusy ? "ログイン処理中..." : "Googleでログイン"}
          </button>
          {inAppBrowser && (
            <button onClick={copyCurrentUrlToClipboard} disabled={authBusy} className="mt-2 px-4 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 disabled:opacity-60">
              URLをコピー
            </button>
          )}
        </div>
      </div>
    );
  }

  const renderSortedTasks = () => (
    <div ref={listRef}>
      {sorted.map((t, i) => {
        const now = Date.now();
        const deadlineTime = new Date(t.deadline).getTime();
        const isOverdueTask = deadlineTime < now;
        const prevIsOverdueTask = i > 0 && new Date(sorted[i - 1].deadline).getTime() < now;
        const showOverdueLabel = i === 0 && isOverdueTask;
        const showPriorityLabel = !isOverdueTask && t.priority && (i === 0 || (prevIsOverdueTask && !isOverdueTask) || (i > 0 && !sorted[i - 1].priority && new Date(sorted[i - 1].deadline).getTime() >= now));
        const showNormalLabel = !isOverdueTask && !t.priority && i > 0 && (new Date(sorted[i - 1].deadline).getTime() < now || sorted[i - 1].priority);

        return (
          <div key={t.id} data-task-idx={i} style={dragActive && dragIdx === i ? { transform: `translateY(${dragY}px)` } : {}}>
            {showOverdueLabel && <div className="px-4 pt-2 pb-1"><span className="text-[10px] font-semibold text-red-500 tracking-widest uppercase">期限超過</span></div>}
            {showPriorityLabel && <div className="px-4 pt-3 pb-1"><span className="text-[10px] font-semibold text-red-500 tracking-widest uppercase">最優先</span></div>}
            {showNormalLabel && <div className="px-4 pt-3 pb-1"><span className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase">その他</span></div>}
            <TaskRow task={t} cats={cats} idx={i} touchDrag={touchDrag} onComplete={handleComplete} onEdit={(task) => { setEditTask(task); setPrefillDate(null); setShowForm(true); }} onDelete={handleDeleteTask} />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background prioritodo-app">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
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
        <SegmentedTabs
          value={view}
          onChange={(id) => setView(id as View)}
          items={[
            { id: "list", label: "タスク" },
            { id: "calendar", label: "カレンダー" },
            { id: "timetable", label: "時間割" },
            { id: "group", label: "グループ" },
            { id: "completed", label: "達成済み", count: completed.length },
          ]}
        />
      </div>

      <div className="max-w-lg mx-auto w-full flex-1 overflow-y-auto pb-24">
        {view === "list" && (
          <>
            <div className="px-4 pt-3 pb-1">
              <SegmentedTabs
                value={filter}
                onChange={setFilter}
                items={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
              />
            </div>
            <SurfaceCard className="mx-4 mb-2 px-3 py-2 space-y-1.5 !rounded-2xl">
              <div className="flex gap-1.5 overflow-x-auto">
                <button onClick={() => setCatFilter("all")} className={`px-3 py-2 min-h-11 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === "all" ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>すべて</button>
                <button onClick={() => setCatFilter("default")} className={`px-3 py-2 min-h-11 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === "default" ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>未分類</button>
                {timetableCats.length > 0 && (
                  <button onClick={() => { setShowCourseFilters((prev) => !prev); setCatFilter("timetable_group"); }} className={`px-3 py-2 min-h-11 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === "timetable_group" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>授業 {showCourseFilters ? "▲" : "▼"}</button>
                )}
                {normalCats.filter((c) => c.id !== "default").map((c) => <button key={c.id} onClick={() => setCatFilter(c.id)} className={`flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === c.id ? "text-white" : "text-gray-500 hover:bg-gray-50"}`} style={catFilter === c.id ? { backgroundColor: c.color } : {}}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catFilter === c.id ? "rgba(255,255,255,0.7)" : c.color }} />{c.label}</button>)}
              </div>
              {showCourseFilters && timetableCats.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {timetableCats.map((c) => (
                    <button key={c.id} onClick={() => setCatFilter(c.id)} className={`flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === c.id ? "text-white" : "text-gray-500 hover:bg-gray-50"}`} style={catFilter === c.id ? { backgroundColor: c.color } : {}}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catFilter === c.id ? "rgba(255,255,255,0.7)" : c.color }} />{c.label}
                    </button>
                  ))}
                </div>
              )}
            </SurfaceCard>
            {sorted.length === 0 ? (
              <div className="px-4 py-8">
                <EmptyState title="タスクなし" description="右下の + から追加して、今日の流れを作りましょう。" icon={<IconList size={20} stroke="#94A3B8" />} />
              </div>
            ) : (
              renderSortedTasks()
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
        {view === "timetable" && <TimetableView items={timetable} setItems={setTimetable} setCats={setCats} config={timetableConfig} setConfig={setTimetableConfig} onShare={handleShareTimetable} tasks={tasks} cats={cats} />}
        {view === "group" && <GroupView groups={groups} setGroups={setGroups} />}
        {view === "completed" && <div><div className="px-4 py-3 flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">達成済み</span><span className="text-[11px] text-gray-400">{completed.length}件</span></div><CompletedList tasks={completed} cats={cats} onRestore={handleRestore} /></div>}
      </div>

      <button onClick={() => openNew(null)} className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center"><IconPlus size={20} sw={2.5} /></button>
      {showForm && <TaskForm task={editTask} prefillDate={prefillDate} cats={cats} setCats={setCats} timetable={timetable} onSave={handleSave} onDelete={handleDeleteFromForm} onClose={() => { setShowForm(false); setEditTask(null); setPrefillDate(null); }} />}
      {showCatMgr && <CategoryManager cats={cats} setCats={setCats} onDeleteCategory={(catId) => setTasks((prev) => prev.map((t) => (t.category === catId ? { ...t, category: "default" } : t)))} onClose={() => setShowCatMgr(false)} />}


      {pendingImport && (
        <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900">時間割をインポート</h3>
            <p className="text-xs text-gray-500 mt-2">含まれる授業：</p>
            <ul className="mt-1 text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
              {pendingImport.items.map((it, idx) => <li key={`${it.name}-${idx}`}>・{it.name}（{WEEKDAY_LABELS[it.day]} {migratePeriod(it.period)}）</li>)}
            </ul>
            <p className="text-[11px] text-gray-400 mt-2">※現在の時間割は置き換えられます</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setPendingImport(null); clearShareQuery(); }} className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-600">キャンセル</button>
              <button onClick={() => {
                const next = pendingImport.items.map((it) => ({ id: uid(), name: it.name, day: Number(it.day), period: migratePeriod(it.period), teacher: it.teacher || "", room: it.room || "", color: it.color || "#889096", absenceLimit: 5, attendanceAbsent: 0, attendanceLate: 0, attendancePresent: 0, memo: "" }));
                setTimetable(next);
                setCats((prev) => {
                  const withoutTimetable = prev.filter((c) => !c.timetableId);
                  const fromTimetable = next.map((it) => ({ id: uid(), label: it.name, color: it.color, timetableId: it.id }));
                  return [...withoutTimetable, ...fromTimetable];
                });
                setPendingImport(null); clearShareQuery();
              }} className="px-3 py-1.5 text-xs rounded bg-gray-900 text-white">インポート</button>
            </div>
          </div>
        </div>
      )}
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
            <div className="mx-4 mt-4"><button onClick={handleResetAllData} className="text-sm text-red-600 font-semibold min-h-11">データを初期化</button></div><p className="px-4 pt-3 text-xs text-gray-400">今後のアップデートで壁紙テーマやパーティクルエフェクトのカスタマイズが追加されます。</p>
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
