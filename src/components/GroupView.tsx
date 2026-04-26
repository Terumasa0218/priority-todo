"use client";
import React, { useState } from "react";
import { Group } from "@/lib/types";
import { DAY, MEMBER_COLORS } from "@/lib/constants";
import { uid, remaining, urgColor, fmt } from "@/lib/utils";
import { IconPlus, IconUsers, IconChevR, IconChevL, IconTrash, IconCheck, IconX } from "./Icons";

interface GroupViewProps {
  groups: Group[];
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
}

export default function GroupView({ groups, setGroups }: GroupViewProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupTab, setGroupTab] = useState<"tasks" | "members" | "calendar">("tasks");
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [taskAssignee, setTaskAssignee] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [calMonth, setCalMonth] = useState(new Date());
  const [selGrpDate, setSelGrpDate] = useState<Date | null>(null);

  const createGroup = () => {
    if (!newName.trim()) return;
    const g: Group = {
      id: uid(),
      name: newName.trim(),
      members: [{ id: uid(), name: "自分", isMe: true }],
      tasks: [],
      createdAt: new Date().toISOString(),
    };
    setGroups((prev) => [...prev, g]);
    setNewName("");
    setShowCreate(false);
    setSelectedGroup(g.id);
  };

  const addMember = (gid: string) => {
    if (!memberName.trim()) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid
          ? { ...g, members: [...g.members, { id: uid(), name: memberName.trim(), isMe: false }] }
          : g
      )
    );
    setMemberName("");
    setShowAddMember(false);
  };

  const addTask = (gid: string) => {
    if (!taskTitle.trim()) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid
          ? {
              ...g,
              tasks: [
                ...g.tasks,
                {
                  id: uid(),
                  title: taskTitle.trim(),
                  deadline: new Date(taskDeadline).toISOString(),
                  assignee: taskAssignee || null,
                  completed: false,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : g
      )
    );
    setTaskTitle("");
    setTaskAssignee("");
    setShowAddTask(false);
  };

  const toggleTask = (gid: string, tid: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid
          ? {
              ...g,
              tasks: g.tasks.map((t) => (t.id === tid ? { ...t, completed: !t.completed } : t)),
            }
          : g
      )
    );
  };

  const deleteTask = (gid: string, tid: string) => {
    setGroups((prev) => prev.map((g) => (g.id === gid ? { ...g, tasks: g.tasks.filter((t) => t.id !== tid) } : g)));
  };

  const deleteGroup = (gid: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== gid));
    setSelectedGroup(null);
  };

  const removeMember = (gid: string, mid: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== gid) return g;
        const removed = g.members.find((m) => m.id === mid);
        return {
          ...g,
          members: g.members.filter((m) => m.id !== mid),
          tasks: g.tasks.map((t) => (removed && t.assignee === removed.name ? { ...t, assignee: null } : t)),
        };
      })
    );
  };

  const group = groups.find((g) => g.id === selectedGroup);

  if (!selectedGroup || !group) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-900">グループ</span>
          <button onClick={() => setShowCreate(true)} className="text-xs text-blue-500 font-medium flex items-center gap-1"><IconPlus size={13} />グループを作成</button>
        </div>
        {showCreate && (
          <div className="mb-4 bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="グループ名" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:border-gray-400" autoFocus onKeyDown={(e) => e.key === "Enter" && createGroup()} />
            <div className="flex gap-2"><button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-500 bg-gray-100">取消</button><button onClick={createGroup} disabled={!newName.trim()} className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-[#007AFF] disabled:bg-gray-300">作成</button></div>
          </div>
        )}
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400"><IconUsers size={32} stroke="#ddd" /><p className="text-sm mt-3">グループはまだありません</p><p className="text-xs mt-1 text-gray-300">グループを作成して、タスクを共有しましょう</p></div>
        ) : (
          <div className="space-y-2">{groups.map((g) => {
            const done = g.tasks.filter((t) => t.completed).length;
            const total = g.tasks.length;
            return (<div key={g.id} onClick={() => setSelectedGroup(g.id)} className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-900">{g.name}</span><IconChevR size={14} stroke="#ccc" /></div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400"><span className="flex items-center gap-1"><IconUsers size={12} />{g.members.length}人</span><span>{total}件</span>{total > 0 && <span>{done}/{total} 完了</span>}</div>
              {total > 0 && <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} /></div>}
            </div>);
          })}</div>
        )}
      </div>
    );
  }

  const getMemberColor = (idx: number) => MEMBER_COLORS[idx % MEMBER_COLORS.length];

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setSelectedGroup(null)} className="text-blue-500 text-sm font-medium flex items-center gap-1"><IconChevL size={14} />戻る</button>
        <span className="flex-1" /><button onClick={() => deleteGroup(group.id)} className="text-xs text-red-400">削除</button>
      </div>
      <h2 className="text-base font-bold text-gray-900 mb-3">{group.name}</h2>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-4">
        {[{ id: "tasks", label: "タスク" }, { id: "members", label: "メンバー" }, { id: "calendar", label: "カレンダー" }].map((t) => (
          <button key={t.id} onClick={() => setGroupTab(t.id as "tasks" | "members" | "calendar")} className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${groupTab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{t.label}</button>
        ))}
      </div>

      {groupTab === "tasks" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">{group.tasks.length}件</span>
            <button onClick={() => setShowAddTask(true)} className="text-xs text-blue-500 flex items-center gap-1"><IconPlus size={12} />タスクを追加</button>
          </div>
          {showAddTask && (
            <div className="mb-3 p-3 bg-white rounded-xl border border-gray-100 space-y-2">
              <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="タスク名" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none" autoFocus />
              <input type="datetime-local" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">担当者なし</option>{group.members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
              <div className="flex gap-2"><button onClick={() => setShowAddTask(false)} className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-500 bg-gray-100">取消</button><button onClick={() => addTask(group.id)} disabled={!taskTitle.trim()} className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-[#007AFF] disabled:bg-gray-300">追加</button></div>
            </div>
          )}
          {group.tasks.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">タスクはまだありません</div> : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {[...group.tasks].sort((a, b) => {
                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
              }).map((t, i) => {
                const rem2 = remaining(t.deadline);
                const uc2 = urgColor(rem2.u);
                const mi = group.members.findIndex((m) => m.name === t.assignee);
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
          {group.tasks.length > 0 && (
            <div className="mt-3 bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2"><span>全体の進捗</span><span>{group.tasks.filter((t) => t.completed).length}/{group.tasks.length}</span></div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(group.tasks.filter((t) => t.completed).length / group.tasks.length) * 100}%` }} /></div>
            </div>
          )}
        </div>
      )}

      {groupTab === "members" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">{group.members.length}人</span>
            <button onClick={() => setShowAddMember(true)} className="text-xs text-blue-500 flex items-center gap-1"><IconPlus size={12} />メンバーを追加</button>
          </div>
          {showAddMember && (
            <div className="mb-3 flex gap-2">
              <input type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="名前" className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none" autoFocus onKeyDown={(e) => e.key === "Enter" && addMember(group.id)} />
              <button onClick={() => addMember(group.id)} disabled={!memberName.trim()} className="px-3 py-2 rounded-lg text-xs font-medium text-white bg-[#007AFF] disabled:bg-gray-300">追加</button>
              <button onClick={() => setShowAddMember(false)} className="px-2 text-xs text-gray-400">取消</button>
            </div>
          )}
          <div className="space-y-3">
            {group.members.map((m, mi) => {
              const mTasks = group.tasks.filter((t) => t.assignee === m.name);
              const mDone = mTasks.filter((t) => t.completed).length;
              const mPending = mTasks.filter((t) => !t.completed).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
              const color = getMemberColor(mi);
              return (
                <div key={m.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: color }}>{m.name.slice(0, 1)}</div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900">{m.name}</span>
                          {m.isMe && <span className="text-[10px] text-gray-400">あなた</span>}
                        </div>
                        {mTasks.length > 0 && <div className="text-[10px] text-gray-400">{Math.round((mDone / mTasks.length) * 100)}% 完了</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {mTasks.length > 0 && <span className="text-[11px] text-gray-400">{mDone}/{mTasks.length}</span>}
                      {!m.isMe && <button onClick={() => removeMember(group.id, m.id)} className="text-gray-300 hover:text-red-400"><IconTrash size={12} /></button>}
                    </div>
                  </div>
                  {mTasks.length > 0 && (
                    <div className="px-4 py-1.5">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${(mDone / mTasks.length) * 100}%`, backgroundColor: color }} /></div>
                    </div>
                  )}
                  {mPending.length > 0 && (
                    <div className="px-4 pb-2">
                      {mPending.slice(0, 3).map((t) => {
                        const r = remaining(t.deadline);
                        const u = urgColor(r.u);
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

      {groupTab === "calendar" && (() => {
        const y = calMonth.getFullYear();
        const mo = calMonth.getMonth();
        const first = new Date(y, mo, 1).getDay();
        const total = new Date(y, mo + 1, 0).getDate();
        const today = new Date();
        const cells: (number | null)[] = [];
        for (let i = 0; i < first; i++) cells.push(null);
        for (let d = 1; d <= total; d++) cells.push(d);
        const tasksOn = (day: number) => group.tasks.filter((t) => { const dd = new Date(t.deadline); return dd.getFullYear() === y && dd.getMonth() === mo && dd.getDate() === day && !t.completed; });
        const isToday = (day: number | null) => day && today.getFullYear() === y && today.getMonth() === mo && today.getDate() === day;
        const isSel = (day: number | null) => day && selGrpDate && selGrpDate.getFullYear() === y && selGrpDate.getMonth() === mo && selGrpDate.getDate() === day;
        const selDayTasks = selGrpDate ? group.tasks.filter((t) => { const dd = new Date(t.deadline); return dd.getFullYear() === selGrpDate.getFullYear() && dd.getMonth() === selGrpDate.getMonth() && dd.getDate() === selGrpDate.getDate(); }).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()) : [];
        const fmtSelDate = selGrpDate ? `${selGrpDate.getFullYear()}年${selGrpDate.getMonth() + 1}月${selGrpDate.getDate()}日(${DAY[selGrpDate.getDay()]})` : "";
        const fmtTime = (d: string) => { const o = new Date(d); return `${String(o.getHours()).padStart(2, "0")}:${String(o.getMinutes()).padStart(2, "0")}`; };

        const handleAddFromCal = () => {
          if (selGrpDate) {
            const d = new Date(selGrpDate);
            d.setHours(23, 59);
            setTaskDeadline(d.toISOString().slice(0, 16));
          }
          setShowAddTask(true);
          setGroupTab("tasks");
        };

        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCalMonth(new Date(y, mo - 1))} className="p-2 hover:bg-gray-100 rounded-lg"><IconChevL size={16} /></button>
              <span className="text-sm font-semibold text-gray-900">{y}年 {mo + 1}月</span>
              <button onClick={() => setCalMonth(new Date(y, mo + 1))} className="p-2 hover:bg-gray-100 rounded-lg"><IconChevR size={16} /></button>
            </div>
            <div className="grid grid-cols-7 mb-1">{DAY.map((d, i) => <div key={d} className={`text-center text-xs font-semibold py-1.5 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              {cells.map((day, idx) => {
                const dt = day ? tasksOn(day) : [];
                const tod = isToday(day);
                const sel = isSel(day);
                return (
                  <div key={idx} onClick={() => day && setSelGrpDate(new Date(y, mo, day))} className={`min-h-[100px] p-1.5 transition-colors ${day ? "cursor-pointer" : ""}`} style={sel ? { border: "2px solid #111827", borderRadius: "4px", backgroundColor: "#fff" } : tod ? { backgroundColor: "rgba(219,234,254,0.4)" } : { backgroundColor: "#fff" }}>
                    {day && <><div className={`text-[11px] leading-none mb-1.5 text-center ${sel ? "font-bold text-gray-900" : tod ? "font-bold text-blue-600" : "text-gray-700"}`}>{day}</div>
                      <div className="space-y-0.5">{dt.slice(0, 2).map((t) => { const mi = group.members.findIndex((m) => m.name === t.assignee); return <div key={t.id} className="text-[10px] leading-tight truncate px-1 py-[1px] rounded text-white" style={{ backgroundColor: mi >= 0 ? getMemberColor(mi) : "#889096" }}>{t.title}</div>; })}{dt.length > 2 && <span className={`text-[9px] px-0.5 text-gray-400`}>+{dt.length - 2}</span>}</div>
                    </>}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {group.members.map((m, mi) => (
                <div key={m.id} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getMemberColor(mi) }} />
                  <span className="text-[10px] text-gray-500">{m.name}</span>
                </div>
              ))}
            </div>
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
                    selDayTasks.map((t) => {
                      const mi = group.members.findIndex((m) => m.name === t.assignee);
                      const color = mi >= 0 ? getMemberColor(mi) : "#889096";
                      return (
                        <div key={t.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
                          <div className="flex-shrink-0 w-12 text-right mt-0.5"><div className="text-xs font-medium text-gray-500">{fmtTime(t.deadline)}</div></div>
                          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color, minHeight: "24px" }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-900 font-medium">{t.title}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {t.assignee && <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: color }}>{t.assignee}</span>}
                              {t.completed && <span className="text-[10px] text-green-500">完了</span>}
                            </div>
                          </div>
                          <button onClick={() => toggleTask(group.id, t.id)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${t.completed ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"}`}>
                            {t.completed && <IconCheck size={12} stroke="white" sw={3} />}
                          </button>
                        </div>
                      );
                    })
                  )}
                  <button onClick={handleAddFromCal} className="flex items-center justify-center gap-2 w-full px-4 py-3.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors border-t border-gray-100"><IconPlus size={15} />新しいタスクを追加</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
