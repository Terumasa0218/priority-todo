"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { DEFAULT_APP_SETTINGS, DEFAULT_CATS, DEFAULT_TIMETABLE_CONFIG, FILTERS, WEEKDAY_LABELS } from "@/lib/constants";
import { expandRecurring, remaining, uid } from "@/lib/utils";
import { AppSettings, Category, Task, TimetableConfig, TimetableItem, TouchDragState } from "@/lib/types";
import { IconBook, IconList, IconPalette, IconPlus, IconSettings } from "@/components/Icons";
import TaskRow from "@/components/TaskRow";
import TaskForm from "@/components/TaskForm";
import CategoryManager from "@/components/CategoryManager";
import CalendarView from "@/components/CalendarView";
import CompletedList from "@/components/CompletedList";
import TimetableView from "@/components/TimetableView";
import TodayView from "@/components/TodayView";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import SurfaceCard from "@/components/ui/SurfaceCard";
import EmptyState from "@/components/ui/EmptyState";
import { auth, firebaseEnabled, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, signInWithRedirect, User, browserLocalPersistence, getRedirectResult, setPersistence } from "firebase/auth";
import { deleteCloudSnapshot, loadCloudSnapshot, migrateLocalToCloudOnce, saveCloudSnapshot } from "@/lib/cloudStorage";
import { createTimetableShareToken, loadTimetableShareToken } from "@/lib/timetableShare";
import { AuthIssue, resolveAuthIssue } from "@/lib/authErrorCatalog";
import { loadAppSettings, loadCategories, loadTasks, loadTimetable, loadTimetableConfig, saveAppSettings, saveCategories, saveTasks, saveTimetable, saveTimetableConfig } from "@/lib/storage";

type View = "list" | "calendar" | "timetable" | "completed";
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

const withTaskDefaults = (task: Task): Task => ({
  ...task,
  kind: task.kind ?? "todo",
  startDate: task.startDate ?? null,
  startOffsetDays: task.startOffsetDays ?? null,
});


export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cats, setCats] = useState<Category[]>(DEFAULT_CATS);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [timetableConfig, setTimetableConfig] = useState<TimetableConfig>(DEFAULT_TIMETABLE_CONFIG);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [view, setView] = useState<View>("list");
  const [activeFilter, setActiveFilter] = useState("today");
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
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        await setPersistence(auth!, browserLocalPersistence);
      } catch (err) {
        console.error("setPersistence failed:", err);
      }
      if (cancelled) return;
      try {
        const result = await getRedirectResult(auth!);
        if (result?.user) setAuthFlowMessage("ログイン情報を確認中...");
      } catch (err) {
        console.error("Redirect result error:", err);
        const code = (err as { code?: string })?.code;
        setAuthIssue(resolveAuthIssue(code));
      }
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(auth!, (nextUser) => {
        setUser(nextUser);
        setAuthReady(true);
        if (nextUser) {
          setAuthIssue(null);
          setAuthFlowMessage(null);
        }
      });
    })();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setReady(false);
      return;
    }
    let mounted = true;
    const sync = async () => {
      setSyncing(true);
      const localTasks = loadTasks().map(withTaskDefaults);
      setTasks(localTasks);
      setCats(loadCategories());
      setTimetable(loadTimetable().map((it) => ({ ...it, period: migratePeriod(it.period as string | number) })));
      setTimetableConfig(loadTimetableConfig());
      setAppSettings(loadAppSettings());
      try {
        const raw = localStorage.getItem("prioritodo_skip_holiday_classes");
        if (raw !== null) setSkipHolidayClasses(raw === "1");
      } catch { /* ignore */ }
      try {
        await migrateLocalToCloudOnce(user.uid);
        const snapshot = await loadCloudSnapshot(user.uid);
        if (!mounted) return;
        const cloudHasData =
          snapshot.tasks.length > 0 ||
          snapshot.timetable.length > 0 ||
          snapshot.cats.length > 1 ||
          snapshot.settings.skipHolidayClasses !== DEFAULT_APP_SETTINGS.skipHolidayClasses;
        if (cloudHasData) {
          // 同 id のタスクは「より進んだ状態」(完了 / 完了 occurrence / 先延ばし数が多い方) を優先する。
          // クラウド書き込みが debounce 中に失敗してもローカル側の完了などが復活しないように。
          const cloudTasks = snapshot.tasks.map(withTaskDefaults);
          const localById = new Map(localTasks.map((t) => [t.id, t]));
          const cloudById = new Map(cloudTasks.map((t) => [t.id, t]));
          const allIds = new Set<string>([...localById.keys(), ...cloudById.keys()]);
          const progress = (t: Task) =>
            (t.completed ? 1 : 0) +
            (t.completedOccurrences?.length || 0) +
            Object.keys(t.snoozedOccurrences || {}).length;
          const merged: Task[] = [];
          for (const id of allIds) {
            const lo = localById.get(id);
            const cl = cloudById.get(id);
            if (lo && !cl) merged.push(lo);
            else if (!lo && cl) merged.push(cl);
            else if (lo && cl) merged.push(progress(lo) > progress(cl) ? lo : cl);
          }
          setTasks(merged);
          setCats(snapshot.cats);
          setTimetable(snapshot.timetable.map((it) => ({ ...it, period: migratePeriod(it.period as string | number) })));
          setTimetableConfig(snapshot.timetableConfig);
          setAppSettings(snapshot.settings);
        }
        setReady(true);
      } catch (err) {
        console.error("Cloud sync failed, using local:", err);
        if (mounted) setReady(true);
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
    if (!ready) return;
    saveTasks(tasks);
    saveCategories(cats);
    saveTimetable(timetable);
    saveTimetableConfig(timetableConfig);
    saveAppSettings(appSettings);
  }, [tasks, cats, timetable, timetableConfig, appSettings, ready]);

  useEffect(() => {
    if (!ready || !user) return;
    const timer = setTimeout(() => {
      saveCloudSnapshot(user.uid, { tasks, cats, timetable, timetableConfig, settings: appSettings }).catch((err) => {
        console.error("Cloud sync failed:", err);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [tasks, cats, timetable, timetableConfig, appSettings, ready, user]);

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

  // オンデマンド授業（period が "オンデマンド..." で始まる）は祝日スキップしない
  const onDemandTimetableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of timetable) {
      if (typeof t.period === "string" && t.period.startsWith("オンデマンド")) {
        ids.add(t.id);
      }
    }
    return ids;
  }, [timetable]);

  const allExpanded = useMemo(() => {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 90);
    const exp: Task[] = [];
    active.forEach((t) => {
      if (t.recurrence && t.recurrence !== "none") {
        const cat = cats.find((c) => c.id === t.category);
        const isOnDemand = !!(cat?.timetableId && onDemandTimetableIds.has(cat.timetableId));
        exp.push(...expandRecurring(t, horizon, { skipHolidays: isOnDemand ? false : appSettings.skipHolidayClasses }));
      } else {
        exp.push(t);
      }
    });
    return exp;
  }, [active, cats, onDemandTimetableIds, appSettings.skipHolidayClasses]);

  const sorted = useMemo(() => {
    const now = Date.now();
    const fDays = FILTERS.find((f) => f.id === activeFilter)?.days ?? 7;
    // 予定（event）で終了時刻が過去のものはアクティブリストから除外
    let list = allExpanded.filter((t) => {
      if (t.kind !== "event") return true;
      const endTs = t.endTime ? new Date(t.endTime).getTime() : new Date(t.deadline).getTime() + 3_600_000;
      return endTs >= now;
    });
    if (fDays !== Infinity) {
      const end = activeFilter === "today" ? new Date(new Date().setHours(23, 59, 59, 999)).getTime() : now + fDays * 864e5;
      list = list.filter((t) => new Date(t.deadline).getTime() <= end);
    }
    allExpanded.filter((t) => t.kind !== "event" && new Date(t.deadline).getTime() < now).forEach((t) => {
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
  }, [allExpanded, activeFilter, catFilter, timetableCats]);

  const sortedRef = useRef<Task[]>(sorted);
  useEffect(() => {
    sortedRef.current = sorted;
  }, [sorted]);

  const weekDone = useMemo(() => {
    const w = Date.now() - 7 * 864e5;
    return completed.filter((t) => t.completedAt && new Date(t.completedAt).getTime() > w).length;
  }, [completed]);
  const overdueCount = allExpanded.filter((t) => new Date(t.deadline).getTime() < Date.now()).length;

  // タスク変更を localStorage とクラウドに即時反映する。
  // クラウド側 useEffect の 400ms debounce 中にアプリが閉じても取りこぼさない。
  const persistTasks = useCallback(
    (updater: (prev: Task[]) => Task[]) => {
      setTasks((prev) => {
        const next = updater(prev);
        try { saveTasks(next); } catch { /* ignore */ }
        if (user) {
          saveCloudSnapshot(user.uid, { tasks: next, cats, timetable, timetableConfig, settings: appSettings }).catch((err) => {
            console.error("Immediate cloud save failed:", err);
          });
        }
        return next;
      });
    },
    [user, cats, timetable, timetableConfig, appSettings]
  );

  const handleSave = useCallback(
    (data: Task) => {
      persistTasks((prev) => {
        const ex = prev.find((t) => t.id === data.id);
        const payload = withTaskDefaults(data);
        return ex ? prev.map((t) => (t.id === data.id ? { ...t, ...payload } : t)) : [...prev, payload];
      });
      setShowForm(false);
      setEditTask(null);
      setPrefillDate(null);
    },
    [persistTasks]
  );

  const handleComplete = useCallback(
    (task: Task) => {
      if (task.kind === "event") return; // 予定は完了の概念なし
      persistTasks((prev) => {
        if (task.isOccurrence) {
          const k = task.deadline.slice(0, 16);
          const updated = prev.map((t) =>
            t.id === task.parentId ? { ...t, completedOccurrences: [...(t.completedOccurrences || []), k] } : t
          );
          return [
            ...updated,
            { ...task, id: uid(), completed: true, completedAt: new Date().toISOString(), isOccurrence: false, parentId: undefined },
          ];
        }
        return prev.map((t) => (t.id === task.id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t));
      });
    },
    [persistTasks]
  );

  const handleRestore = useCallback(
    (id: string) => {
      persistTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: false, completedAt: null } : t)));
    },
    [persistTasks]
  );

  const handleSnooze = useCallback(
    (task: Task, snoozeUntilYMD: string) => {
      const parentId = task.parentId || task.id;
      const key = task.deadline.slice(0, 16);
      persistTasks((prev) =>
        prev.map((t) => {
          if (t.id !== parentId) return t;
          const next = { ...(t.snoozedOccurrences || {}), [key]: snoozeUntilYMD };
          return { ...t, snoozedOccurrences: next };
        })
      );
    },
    [persistTasks]
  );

  const handleDeleteTask = useCallback(
    (task: Task) => {
      const id = task.parentId || task.id;
      persistTasks((prev) => {
        if (task.isOccurrence) {
          const k = task.deadline.slice(0, 16);
          return prev.map((t) =>
            t.id === task.parentId ? { ...t, completedOccurrences: [...(t.completedOccurrences || []), k] } : t
          );
        }
        return prev.filter((t) => t.id !== id);
      });
    },
    [persistTasks]
  );

  const handleDeleteFromForm = useCallback(
    (id: string) => {
      persistTasks((prev) => prev.filter((t) => t.id !== id));
      setShowForm(false);
      setEditTask(null);
    },
    [persistTasks]
  );

  const openNew = (date: Date | null) => {
    setEditTask(null);
    setPrefillDate(date || null);
    setShowForm(true);
  };

  // 編集を開く: occurrence (展開された繰り返しの個別回) なら親タスクに解決して開く。
  // これにより「初回締切日」フォームに常にユーザーが当初入れた値が表示され、
  // 5週目をタップしても 5週目の deadline が「初回締切日」欄に出る違和感を避ける。
  const openEdit = useCallback((t: Task) => {
    if (t.isOccurrence && t.parentId) {
      const parent = tasks.find((x) => x.id === t.parentId);
      if (parent) {
        setEditTask(parent);
        setPrefillDate(null);
        setShowForm(true);
        return;
      }
    }
    setEditTask(t);
    setPrefillDate(null);
    setShowForm(true);
  }, [tasks]);


  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider || authBusy) return;
    setAuthBusy(true);
    setAuthIssue(null);
    setAuthFlowMessage(null);
    if (inAppBrowser) {
      setAuthFlowMessage("アプリ内ブラウザです。失敗する場合は下の「Safari / Chromeで開く」を使ってください。");
    }
    try {
      await setPersistence(auth, browserLocalPersistence);
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
    setTimetable([]);
    setTimetableConfig(DEFAULT_TIMETABLE_CONFIG);
    window.location.reload();
  };

  const handleResetSemester = () => {
    if (timetable.length === 0 && timetableCats.length === 0) {
      window.alert("リセットする時間割がありません。");
      return;
    }
    const ttCatIds = new Set(timetableCats.map((c) => c.id));
    const linkedTasks = tasks.filter((t) => ttCatIds.has(t.category)).length;
    const ok = window.confirm(
      `学期をリセットします。\n\n` +
      `・時間割 ${timetable.length} コマ\n` +
      `・授業カテゴリ ${timetableCats.length} 件\n` +
      `・関連する繰り返しタスク ${linkedTasks} 件\n\n` +
      `すべて削除されます。よろしいですか？（取り消せません）`
    );
    if (!ok) return;
    setTasks((prev) => prev.filter((t) => !ttCatIds.has(t.category)));
    setCats((prev) => prev.filter((c) => !c.timetableId));
    setTimetable([]);
    setShowSettings(false);
    setCatFilter("all");
    setShowCourseFilters(false);
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

  if (!authReady) {
    return <div className="h-[100dvh] bg-background safe-top safe-bottom" />;
  }

  // 初回ログイン直後（ローカルキャッシュ無し かつ 同期未完）は文言付きスプラッシュ。
  // 2回目以降はローカルキャッシュが即時反映されるのでここを通らない。
  const hasLocalData = tasks.length > 0 || cats.length > 1 || timetable.length > 0;
  if (user && !ready && !hasLocalData) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center safe-top safe-bottom safe-x">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
        <p className="mt-4 text-sm text-gray-500">ユーザーの情報を取得しています...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-[100dvh] bg-background flex items-center justify-center p-6 text-center safe-top safe-bottom safe-x">
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
            className="mt-4 px-4 py-2 rounded-lg bg-[#007AFF] hover:bg-[#0062CC] text-white text-sm font-medium disabled:opacity-60 active:scale-[0.98] transition-transform"
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
            <TaskRow task={t} cats={cats} idx={i} touchDrag={touchDrag} onComplete={handleComplete} onEdit={openEdit} onDelete={handleDeleteTask} />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background prioritodo-app safe-x">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 safe-top">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-shrink"><h1 className="text-base font-bold text-gray-900 tracking-tight">PrioriTodo</h1><p className="text-[10px] text-gray-400 tracking-wide truncate">次にやることが、すぐ分かる</p></div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {overdueCount > 0 && <span className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md whitespace-nowrap">{overdueCount}件超過</span>}
            <div className="text-right leading-none whitespace-nowrap mr-1"><div className="text-[9px] text-gray-400">今週</div><div className="text-sm font-bold text-gray-900">{weekDone}<span className="text-[9px] text-gray-400 font-normal ml-0.5">達成</span></div></div>
            <button onClick={() => setShowCatMgr(true)} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="カテゴリ編集"><IconPalette size={16} stroke="#666" /></button>
            <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="設定"><IconSettings size={15} stroke="#666" /></button>
            <button onClick={() => setShowHelp(true)} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="ヘルプ"><IconBook size={15} stroke="#666" /></button>
            <button onClick={handleLogout} className="text-[10px] text-gray-500 border border-gray-200 px-1.5 py-1 rounded-md whitespace-nowrap">ログアウト</button>
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
            { id: "completed", label: "達成済み" },
          ]}
        />
      </div>

      <div className={`${view === "calendar" ? "w-full" : "max-w-lg mx-auto"} w-full flex-1 overflow-y-auto pb-24`}>
        {view === "list" && (
          <>
            <div className="px-4 pt-3 pb-1">
              <SegmentedTabs
                value={activeFilter}
                onChange={setActiveFilter}
                items={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
              />
            </div>
            <SurfaceCard className="mx-4 mb-2 px-3 py-2 space-y-1.5 !rounded-2xl">
              <div className="flex gap-1.5 overflow-x-auto">
                <button
                  onClick={() => { setCatFilter("all"); setShowCourseFilters(false); }}
                  className={`px-3 py-2 min-h-11 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === "all" ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                >
                  すべて
                </button>
                {timetableCats.length > 0 && (
                  <button
                    onClick={() => { setCatFilter("timetable_group"); setShowCourseFilters(true); }}
                    className={`flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === "timetable_group" || timetableCats.some((tc) => tc.id === catFilter) ? "bg-[#007AFF] text-white" : "text-gray-500 hover:bg-gray-50"}`}
                  >
                    <span className="text-[13px]">📚</span>
                    授業
                    <span className="text-[10px] opacity-70">{timetableCats.length}</span>
                  </button>
                )}
                {cats.filter((c) => !c.timetableId).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCatFilter(c.id); setShowCourseFilters(false); }}
                    className={`flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === c.id ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
                    style={catFilter === c.id ? { backgroundColor: c.color } : {}}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catFilter === c.id ? "rgba(255,255,255,0.7)" : c.color }} />{c.label}
                  </button>
                ))}
              </div>
              {showCourseFilters && timetableCats.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => setCatFilter("timetable_group")}
                    className={`px-3 py-2 min-h-11 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === "timetable_group" ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    授業すべて
                  </button>
                  {timetableCats.map((c) => (
                    <button key={c.id} onClick={() => setCatFilter(c.id)} className={`flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${catFilter === c.id ? "text-white" : "text-gray-500 hover:bg-gray-50"}`} style={catFilter === c.id ? { backgroundColor: c.color } : {}}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catFilter === c.id ? "rgba(255,255,255,0.7)" : c.color }} />{c.label}
                    </button>
                  ))}
                </div>
              )}
            </SurfaceCard>
            {activeFilter === "today" ? (
              <TodayView
                tasks={allExpanded.filter((t) => catFilter === "all" || (catFilter === "timetable_group" ? timetableCats.some((c) => c.id === t.category) : t.category === catFilter))}
                cats={cats}
                onComplete={handleComplete}
                onEdit={openEdit}
                onSnooze={handleSnooze}
              />
            ) : sorted.length === 0 ? (
              <div className="px-4 py-8">
                <EmptyState title="タスクなし" description="右下の + から追加して、今日の流れを作りましょう。" icon={<IconList size={20} stroke="#94A3B8" />} />
              </div>
            ) : (
              renderSortedTasks()
            )}
          </>
        )}

        {view === "calendar" && <div className="pt-3"><CalendarView tasks={allExpanded} cats={cats} month={calMonth} setMonth={setCalMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onAddClick={(d) => openNew(d)} onEditTask={openEdit} /></div>}
        {view === "timetable" && <TimetableView items={timetable} setItems={setTimetable} setCats={setCats} config={timetableConfig} setConfig={setTimetableConfig} onShare={handleShareTimetable} tasks={tasks} cats={cats} />}
        {view === "completed" && <div><div className="px-4 py-3 flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">達成済み</span><span className="text-[11px] text-gray-400">{completed.length}件</span></div><CompletedList tasks={completed} cats={cats} onRestore={handleRestore} /></div>}
      </div>

      <button
        onClick={() => openNew(null)}
        className="fixed right-6 z-40 w-14 h-14 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      ><IconPlus size={20} sw={2.5} /></button>
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
              }} className="px-3 py-1.5 text-xs rounded bg-[#007AFF] text-white">インポート</button>
            </div>
          </div>
        </div>
      )}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col safe-x" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 safe-top">
            <button onClick={() => setShowSettings(false)} className="text-sm text-blue-500 font-medium">戻る</button>
            <span className="text-sm font-semibold text-gray-900">設定</span><div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto safe-bottom">
            <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
              <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between"><span className="text-sm text-gray-900">壁紙</span><span className="text-sm text-gray-400">近日公開</span></div>
              <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between"><span className="text-sm text-gray-900">完了エフェクト</span><span className="text-sm text-gray-400">近日公開</span></div>
              <div className="px-4 py-3.5 flex items-center justify-between"><span className="text-sm text-gray-900">言語</span><span className="text-sm text-gray-400">日本語</span></div>
            </div>
            <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-900">授業日の祝日扱い</div>
                <div className="text-xs text-gray-500 mt-1 leading-relaxed">大学ルールに合わせて、祝日でも授業課題を出すか切り替えます。</div>
              </div>
              <label className="px-4 py-3.5 flex items-center justify-between">
                <span className="text-sm text-gray-900">祝日は休講としてスキップ</span>
                <input type="checkbox" checked={skipHolidayClasses} onChange={(e) => setSkipHolidayClasses(e.target.checked)} />
              </label>
            </div>

            <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-900">大学・授業ルール</div>
                <div className="text-xs text-gray-500 mt-1 leading-relaxed">国公立・私立など大学ごとの祝日授業ルールに合わせて、授業課題の自動展開を調整します。</div>
              </div>
              <button
                type="button"
                onClick={() => setAppSettings((prev) => ({ ...prev, skipHolidayClasses: !prev.skipHolidayClasses }))}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-gray-50 min-h-14"
              >
                <div className="pr-4">
                  <div className="text-sm font-medium text-gray-900">祝日は休講としてスキップ</div>
                  <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">オフにすると、祝日でも通常授業の課題を作成します。オンデマンドは常にスキップしません。</div>
                </div>
                <span className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors ${appSettings.skipHolidayClasses ? "bg-[#007AFF]" : "bg-gray-300"}`} aria-hidden="true">
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${appSettings.skipHolidayClasses ? "translate-x-5" : "translate-x-0.5"}`} />
                </span>
              </button>
            </div>

            <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-900">学期の切り替え</div>
                <div className="text-xs text-gray-500 mt-1 leading-relaxed">時間割と授業カテゴリ、それに紐づく繰り返しタスクを一括で削除します。新しい学期の準備にどうぞ。</div>
              </div>
              <button
                onClick={handleResetSemester}
                className="w-full px-4 py-3 text-left text-sm font-medium text-rose-600 active:bg-rose-50 min-h-11"
              >
                学期をリセットする
              </button>
            </div>

            <div className="mx-4 mt-4"><button onClick={handleResetAllData} className="text-sm text-red-600 font-semibold min-h-11">すべてのデータを初期化</button></div>
            <p className="px-4 pt-3 text-xs text-gray-400">今後のアップデートで壁紙テーマやパーティクルエフェクトのカスタマイズが追加されます。</p>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col safe-x" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 safe-top">
            <button onClick={() => setShowHelp(false)} className="text-sm text-blue-500 font-medium">戻る</button>
            <span className="text-sm font-semibold text-gray-900">使い方</span><div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto safe-bottom"><div className="mt-4 mx-4 space-y-4">
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
