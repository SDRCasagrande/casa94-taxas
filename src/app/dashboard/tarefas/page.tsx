"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    CheckSquare, Plus, Calendar, Star, ChevronLeft, ChevronRight,
    CalendarDays, Loader2, UserPlus, ListTodo, Columns3
} from "lucide-react";
import KanbanBoard from "@/components/KanbanBoard";
import { useConfirm } from "@/components/ConfirmModal";
import {
    TaskDetailModal, AddTaskModal, ListColumn,
    TaskData, TaskListData, UserOption, today, initials
} from "./components";

interface GCalEvent { id: string; title: string; date: string; time: string; isGoogleEvent: boolean; isBitTask: boolean; htmlLink: string }

export default function TarefasPage() {
    const confirmAction = useConfirm();
    const [lists, setLists] = useState<TaskListData[]>([]);
    const [assignedToMe, setAssignedToMe] = useState<TaskData[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [currentUserId, setCurrentUserId] = useState("");
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<"board" | "calendar" | "kanban">("board");
    const [showNewList, setShowNewList] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [calView, setCalView] = useState<"day" | "week" | "month">("week");
    const [calDate, setCalDate] = useState(new Date());
    const [sidebarFilter, setSidebarFilter] = useState<"all" | "starred" | "assigned" | string>("all");
    const [detailTask, setDetailTask] = useState<TaskData | null>(null);
    const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);

    // Global Add Task modal
    const [globalAdding, setGlobalAdding] = useState(false);
    const [globalAddListId, setGlobalAddListId] = useState<string>("");
    const [globalAddDate, setGlobalAddDate] = useState<string>("");
    const [globalAddTime, setGlobalAddTime] = useState<string>("");
    const [globalAddEndTime, setGlobalAddEndTime] = useState<string>("");

    function nextRoundedTime() {
        const now = new Date();
        const mins = now.getMinutes();
        const roundedMins = mins < 30 ? 30 : 0;
        const h = mins < 30 ? now.getHours() : now.getHours() + 1;
        return `${String(h % 24).padStart(2, "0")}:${String(roundedMins).padStart(2, "0")}`;
    }

    function computeEndTime(startTime: string): string {
        const [hh, mm] = startTime.split(":").map(Number);
        const endH = (hh + 1) % 24;
        return `${String(endH).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }

    function openAddTask(listId?: string, date?: string, time?: string) {
        setGlobalAddListId(listId || (lists.length > 0 ? lists[0].id : ""));
        setGlobalAddDate(date || "");
        setGlobalAddTime(time || "");
        setGlobalAddEndTime(time ? computeEndTime(time) : "");
        setGlobalAdding(true);
    }

    const load = useCallback(async () => {
        try {
            const [tasksRes, usersRes, meRes] = await Promise.all([
                fetch("/api/tasks"), fetch("/api/admin/users"), fetch("/api/auth/me")
            ]);
            const tasksData = await tasksRes.json();
            const usersData = await usersRes.json();
            const meData = await meRes.json();
            if (tasksData.lists) setLists(tasksData.lists);
            if (tasksData.assignedTasks) setAssignedToMe(tasksData.assignedTasks);
            if (Array.isArray(usersData)) setUsers(usersData.map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
            if (meData?.id) setCurrentUserId(meData.id);
        } catch { /* */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Google Calendar
    const [gcalEmail, setGcalEmail] = useState("");
    useEffect(() => {
        fetch("/api/google-calendar/status").then(r => r.json()).then(d => {
            setGcalConnected(d.connected === true);
            if (d.googleEmail) setGcalEmail(d.googleEmail);
        }).catch(() => setGcalConnected(false));
    }, []);

    const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
    useEffect(() => {
        if (!gcalConnected) return;
        const timeMin = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
        const timeMax = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${lastDay}`;
        fetch(`/api/google-calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`)
            .then(r => r.json())
            .then(d => { if (Array.isArray(d.events)) setGcalEvents(d.events); })
            .catch(() => {});
    }, [gcalConnected, calMonth, calYear]);

    const allTasks = useMemo(() => lists.flatMap(l => l.tasks), [lists]);
    const totalPending = allTasks.filter(t => !t.completed).length;
    const totalStarred = allTasks.filter(t => t.starred && !t.completed).length;

    const teamMembers = useMemo(() => users.filter(u => u.id !== currentUserId), [users, currentUserId]);
    const getTeamTasks = useCallback((userId: string) => allTasks.filter(t => t.assigneeId === userId), [allTasks]);

    // ═══ CRUD ═══
    const createList = async () => {
        if (!newListName.trim()) return;
        try {
            const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newListName.trim() }) });
            if (res.ok) { setNewListName(""); setShowNewList(false); load(); }
        } catch { /* */ }
    };

    const renameList = async (listId: string, newName: string) => {
        if (!newName.trim()) return;
        try { await fetch(`/api/tasks/${listId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim() }) }); load(); } catch { /* */ }
    };

    const deleteList = async (listId: string, name: string) => {
        const { confirmed } = await confirmAction({ title: "Excluir lista", message: `Tem certeza que deseja excluir a lista "${name}" e todas as suas tarefas?`, variant: "danger", confirmText: "Excluir Lista" });
        if (!confirmed) return;
        try { await fetch(`/api/tasks/${listId}`, { method: "DELETE" }); setSidebarFilter("all"); load(); } catch { /* */ }
    };

    const addTask = async (listId: string, title: string, date?: string, time?: string, assigneeId?: string, priority?: string, description?: string, force = false) => {
        try { 
            const res = await fetch(`/api/tasks/${listId}/items`, { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ title, date, time, assigneeId, priority, description, force }) 
            }); 
            
            if (res.status === 409) {
                const data = await res.json();
                const { confirmed } = await confirmAction({
                    title: "Choque de Horários ⚠️",
                    message: `${data.message}\n\nConflitos detectados:\n• ${data.conflicts.join('\n• ')}\n\nDeseja agendar mesmo assim?`,
                    variant: "warning",
                    confirmText: "Agendar mesmo assim"
                });
                if (confirmed) {
                    await addTask(listId, title, date, time, assigneeId, priority, description, true);
                }
                return;
            }
            
            load(); 
        } catch { /* */ }
    };

    const updateTask = async (taskId: string, data: Record<string, any>) => {
        try { await fetch(`/api/tasks/item/${taskId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); load(); } catch { /* */ }
    };

    const deleteTask = async (taskId: string) => {
        try { await fetch(`/api/tasks/item/${taskId}`, { method: "DELETE" }); load(); } catch { /* */ }
    };

    const scheduleToCalendar = (task: TaskData) => {
        const title = encodeURIComponent(task.title);
        let url = `https://calendar.google.com/calendar/r/eventedit?text=${title}&details=${encodeURIComponent("Tarefa BitTask")}`;
        if (task.date) { const d = task.date.replace(/-/g, ""); url += task.time ? `&dates=${d}T${task.time.replace(":", "")}00/${d}T${task.time.replace(":", "")}00` : `&dates=${d}/${d}`; }
        window.open(url, "_blank");
        updateTask(task.id, { scheduled: true });
    };

    // ═══ Calendar helpers ═══
    const calDays = useMemo(() => {
        const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
        const startDow = new Date(calYear, calMonth, 1).getDay();
        const days: { day: number; date: string; tasks: TaskData[]; gcalEvents: GCalEvent[] }[] = [];
        for (let i = 0; i < startDow; i++) days.push({ day: 0, date: "", tasks: [], gcalEvents: [] });
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dayGcalEvents = gcalEvents.filter(e => e.date === dateStr && !e.isBitTask);
            days.push({ day: d, date: dateStr, tasks: allTasks.filter(t => t.date === dateStr && !t.completed), gcalEvents: dayGcalEvents });
        }
        return days;
    }, [calMonth, calYear, allTasks, gcalEvents]);
    const monthLabel = new Date(calYear, calMonth).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    const getWeekDays = useMemo(() => {
        const d = new Date(calDate);
        const dayOfWeek = d.getDay();
        const start = new Date(d); start.setDate(d.getDate() - dayOfWeek);
        return Array.from({ length: 7 }, (_, i) => {
            const dd = new Date(start); dd.setDate(start.getDate() + i);
            const dateStr = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
            return { date: dateStr, day: dd.getDate(), dow: dd.getDay(), label: dd.toLocaleDateString("pt-BR", { weekday: "short" }), full: dd };
        });
    }, [calDate]);

    const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
    const calDateStr = `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, "0")}-${String(calDate.getDate()).padStart(2, "0")}`;
    const getTasksForDate = useCallback((dateStr: string) => allTasks.filter(t => t.date === dateStr && !t.completed), [allTasks]);
    const getEventsForDate = useCallback((dateStr: string) => gcalEvents.filter(e => e.date === dateStr && !e.isBitTask), [gcalEvents]);

    const navigateCal = (dir: number) => {
        if (calView === "month") {
            if (dir > 0) { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }
            else { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }
        } else if (calView === "week") {
            const d = new Date(calDate); d.setDate(d.getDate() + dir * 7); setCalDate(d);
        } else {
            const d = new Date(calDate); d.setDate(d.getDate() + dir); setCalDate(d);
        }
    };
    const calTitle = calView === "month" ? monthLabel
        : calView === "week" ? `${getWeekDays[0].full.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} — ${getWeekDays[6].full.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`
        : calDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const goToday = () => { const now = new Date(); setCalDate(now); setCalMonth(now.getMonth()); setCalYear(now.getFullYear()); };

    // ═══ List column helpers ═══
    const makeListColumnProps = (list: { id: string; name: string; tasks: TaskData[] }, isSpecial = false, allowListActions = false, onOpenAdd?: () => void) => ({
        list, users,
        onAdd: isSpecial ? (() => {}) : ((title: string, date?: string, time?: string, assigneeId?: string, priority?: string, description?: string) => addTask(list.id, title, date, time, assigneeId, priority, description)),
        onToggle: (id: string) => { const t = (isSpecial ? list.tasks : allTasks).find(x => x.id === id) || assignedToMe.find(x => x.id === id); if (t) updateTask(id, { completed: !t.completed }); },
        onStar: (id: string) => { const t = (isSpecial ? list.tasks : allTasks).find(x => x.id === id) || assignedToMe.find(x => x.id === id); if (t) updateTask(id, { starred: !t.starred }); },
        onDelete: deleteTask,
        onSchedule: scheduleToCalendar,
        onAssign: (id: string, a: string | null) => updateTask(id, { assigneeId: a }),
        onOpenDetail: setDetailTask,
        isSpecialView: isSpecial,
        ...(allowListActions ? {
            onDeleteList: lists.length > 1 ? () => deleteList(list.id, list.name) : undefined,
            onRenameList: (newName: string) => renameList(list.id, newName),
            onClearCompleted: () => { list.tasks.filter(t => t.completed).forEach(t => deleteTask(t.id)); },
            onOpenAddTask: onOpenAdd,
        } : {}),
    });

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#00A868]" /></div>;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-1 pb-3 sm:pb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#00A868] flex items-center justify-center text-white shadow-lg shadow-[#00A868]/20"><CheckSquare className="w-4 h-4" /></div>
                    <h1 className="text-lg font-bold text-foreground">Tarefas</h1>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <button onClick={() => setView("board")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${view === "board" ? "bg-[#00A868]/10 text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}><ListTodo className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Board</span></button>
                    <button onClick={() => setView("kanban")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${view === "kanban" ? "bg-[#00A868]/10 text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}><Columns3 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Kanban</span></button>
                    <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${view === "calendar" ? "bg-[#00A868]/10 text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}><CalendarDays className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Calendário</span></button>
                </div>
            </div>

            <div className="flex flex-1 gap-4 min-h-0 overflow-hidden flex-col lg:flex-row">
                {/* ═══ Mobile Filter Strip ═══ */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden shrink-0 -mx-1 px-1 snap-x">
                    <button onClick={() => setSidebarFilter("all")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all snap-start ${sidebarFilter === "all" ? "bg-[#00A868] text-white" : "bg-secondary text-muted-foreground"}`}>
                        <CheckSquare className="w-3.5 h-3.5" /> Todas {totalPending > 0 && <span className="opacity-70">{totalPending}</span>}
                    </button>
                    <button onClick={() => setSidebarFilter("starred")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all snap-start ${sidebarFilter === "starred" ? "bg-amber-500/20 text-amber-500" : "bg-secondary text-muted-foreground"}`}>
                        <Star className="w-3.5 h-3.5" /> Estrela {totalStarred > 0 && <span className="opacity-70">{totalStarred}</span>}
                    </button>
                    <button onClick={() => setSidebarFilter("assigned")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all snap-start ${sidebarFilter === "assigned" ? "bg-purple-500/20 text-purple-500" : "bg-secondary text-muted-foreground"}`}>
                        <UserPlus className="w-3.5 h-3.5" /> Minhas {assignedToMe.filter(t => !t.completed).length > 0 && <span className="opacity-70">{assignedToMe.filter(t => !t.completed).length}</span>}
                    </button>
                    {lists.map(l => (
                        <button key={l.id} onClick={() => setSidebarFilter(sidebarFilter === `list_${l.id}` ? "all" : `list_${l.id}`)}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all snap-start ${sidebarFilter === `list_${l.id}` ? "bg-[#00A868] text-white" : "bg-secondary text-muted-foreground"}`}>
                            {l.name} <span className="opacity-50">{l.tasks.filter(t => !t.completed).length}</span>
                        </button>
                    ))}
                </div>

                {/* ═══ Desktop Sidebar ═══ */}
                <div className="w-52 shrink-0 hidden lg:flex flex-col gap-0.5 overflow-y-auto">
                    <button onClick={() => setSidebarFilter("all")} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${sidebarFilter === "all" ? "bg-[#00A868] text-white" : "text-muted-foreground hover:bg-muted"}`}>
                        <CheckSquare className="w-4 h-4" /> Todas as tarefas
                        {totalPending > 0 && <span className="ml-auto text-[10px] opacity-70">{totalPending}</span>}
                    </button>
                    <button onClick={() => setSidebarFilter("starred")} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${sidebarFilter === "starred" ? "bg-amber-500/20 text-amber-500" : "text-muted-foreground hover:bg-muted"}`}>
                        <Star className="w-4 h-4" /> Com estrela
                        {totalStarred > 0 && <span className="ml-auto text-[10px] opacity-70">{totalStarred}</span>}
                    </button>
                    <button onClick={() => setSidebarFilter("assigned")} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${sidebarFilter === "assigned" ? "bg-purple-500/20 text-purple-500" : "text-muted-foreground hover:bg-muted"}`}>
                        <UserPlus className="w-4 h-4" /> Minhas Tarefas
                        <span className="ml-auto text-[10px] opacity-70">{assignedToMe.filter(t => !t.completed).length}</span>
                    </button>

                    {teamMembers.length > 0 && (<>
                        <div className="mt-4 mb-1"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3">Equipe</span></div>
                        {teamMembers.map(u => {
                            const teamTasksCount = getTeamTasks(u.id).filter(t => !t.completed).length;
                            return (
                                <button key={u.id} onClick={() => setSidebarFilter(`team_${u.id}`)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${sidebarFilter === `team_${u.id}` ? "bg-[#00A868]/20 text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}>
                                    <div className="w-5 h-5 rounded-full bg-[#00A868] flex items-center justify-center text-[8px] text-white font-bold shrink-0">{initials(u.name)}</div>
                                    <span className="truncate">{u.name.split(" ")[0]}</span>
                                    {teamTasksCount > 0 && <span className="ml-auto text-[10px] opacity-70">{teamTasksCount}</span>}
                                </button>
                            );
                        })}
                    </>)}

                    <div className="mt-4 mb-1"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3">Listas</span></div>
                    {lists.map(l => (
                        <button key={l.id} onClick={() => setSidebarFilter(sidebarFilter === `list_${l.id}` ? "all" : `list_${l.id}`)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${sidebarFilter === `list_${l.id}` ? "bg-[#00A868]/15 text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}>
                            <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate flex-1 text-left">{l.name}</span>
                            <span className="text-[10px] opacity-50">{l.tasks.filter(t => !t.completed).length}</span>
                        </button>
                    ))}
                    <button onClick={() => setShowNewList(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"><Plus className="w-3.5 h-3.5" /> Criar nova lista</button>

                    {showNewList && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowNewList(false)}>
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                            <div className="relative w-full max-w-sm card-elevated shadow-2xl rounded-2xl p-5 animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
                                <h3 className="text-base font-bold text-foreground mb-4">Criar nova lista</h3>
                                <input value={newListName} onChange={e => setNewListName(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter" && newListName.trim()) createList(); if (e.key === "Escape") setShowNewList(false); }}
                                    autoFocus placeholder="Digite o nome"
                                    className="w-full text-sm text-foreground bg-transparent border-b-2 border-border focus:border-[#00A868] focus:outline-none pb-2 placeholder-muted-foreground/50 transition-colors mb-6" />
                                <div className="flex items-center justify-end gap-3">
                                    <button onClick={() => { setShowNewList(false); setNewListName(""); }} className="px-4 py-2 text-sm font-medium text-[#00A868] hover:bg-muted rounded-xl transition-colors">Cancelar</button>
                                    <button onClick={createList} disabled={!newListName.trim()} className="px-4 py-2 text-sm font-medium text-[#00A868] hover:bg-muted rounded-xl transition-colors disabled:opacity-30">Concluir</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ BOARD VIEW ═══ */}
                {view === "board" && (
                    <div className="flex-1 overflow-x-auto">
                        <div className="flex flex-col lg:flex-row gap-4 min-h-full pb-4" style={{ minWidth: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${Math.max(lists.length + 1, 2) * 320}px` : 'auto' }}>
                            {sidebarFilter === "starred" && <ListColumn {...makeListColumnProps({ id: "starred", name: "Com estrela", tasks: allTasks.filter(t => t.starred) }, true)} />}
                            {sidebarFilter === "assigned" && <ListColumn {...makeListColumnProps({ id: "assigned", name: "Atribuídas a mim", tasks: assignedToMe }, true)} />}
                            {sidebarFilter.startsWith("team_") && (() => {
                                const userId = sidebarFilter.replace("team_", "");
                                const user = users.find(u => u.id === userId);
                                const tasks = getTeamTasks(userId);
                                return <ListColumn {...makeListColumnProps({ id: `team-${userId}`, name: `Tarefas ${user?.name.split(" ")[0] || ""}`, tasks }, true)} />;
                            })()}
                            {(sidebarFilter === "all" || sidebarFilter.startsWith("list_")) && (() => {
                                const visibleLists = sidebarFilter.startsWith("list_") ? lists.filter(l => l.id === sidebarFilter.replace("list_", "")) : lists;
                                return visibleLists.map(list => (
                                    <ListColumn key={list.id} {...makeListColumnProps(list, false, true, () => openAddTask(list.id))} />
                                ));
                            })()}
                            {sidebarFilter === "all" && (() => {
                                const ownTaskIds = new Set(allTasks.map(t => t.id));
                                const extraAssigned = assignedToMe.filter(t => !ownTaskIds.has(t.id));
                                if (extraAssigned.length === 0) return null;
                                return <ListColumn {...makeListColumnProps({ id: "assigned-inline", name: "Atribuídas a mim", tasks: extraAssigned }, true)} />;
                            })()}
                            {sidebarFilter === "all" && (
                                <div className="w-full lg:w-72 shrink-0">
                                    <button onClick={() => setShowNewList(true)} className="w-full flex items-center gap-2 px-4 py-3 bg-card/50 border border-dashed border-border rounded-2xl text-sm text-muted-foreground hover:text-foreground transition-all"><Plus className="w-4 h-4" /> Nova lista</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ KANBAN VIEW ═══ */}
                {view === "kanban" && (
                    <KanbanBoard
                        tasks={allTasks}
                        onToggle={(id) => { const t = allTasks.find(x => x.id === id); if (t) updateTask(id, { completed: !t.completed }); }}
                        onUpdate={(id, data) => updateTask(id, data)}
                        onSelect={setDetailTask}
                    />
                )}

                {/* ═══ CALENDAR VIEW ═══ */}
                {view === "calendar" && (
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-border card-elevated">
                            {/* Calendar Toolbar */}
                            <div className="flex items-center justify-between px-3 lg:px-4 py-2 border-b border-border bg-card shrink-0 gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 lg:gap-3">
                                    <button onClick={() => navigateCal(-1)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors touch-target"><ChevronLeft className="w-4 h-4" /></button>
                                    <h3 className="text-xs lg:text-sm font-bold text-foreground capitalize min-w-0 text-center truncate">{calTitle}</h3>
                                    <button onClick={() => navigateCal(1)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors touch-target"><ChevronRight className="w-4 h-4" /></button>
                                    <button onClick={goToday} className="px-2 py-1.5 rounded-lg text-[10px] lg:text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors">Hoje</button>
                                </div>
                                <div className="flex items-center gap-1">
                                    {(["day", "week", "month"] as const).map(v => (
                                        <button key={v} onClick={() => setCalView(v)}
                                            className={`px-2 lg:px-2.5 py-1.5 rounded-lg text-[10px] lg:text-[11px] font-medium transition-all ${calView === v ? "bg-[#00A868]/10 text-[#00A868] font-bold" : "text-muted-foreground hover:bg-muted"}`}>
                                            {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
                                        </button>
                                    ))}
                                    <div className="w-px h-4 bg-border mx-1" />
                                    <button onClick={() => openAddTask()}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] lg:text-[11px] font-bold bg-[#00A868] text-white hover:bg-[#008f58] shadow-sm transition-all active:scale-95">
                                        <Plus className="w-3 h-3" /> <span className="hidden sm:inline">Nova Tarefa</span>
                                    </button>
                                    {gcalConnected && <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4] animate-pulse" />}
                                    {gcalConnected === false && (
                                        <button onClick={() => { window.location.href = "/api/google-calendar/auth"; }}
                                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium text-[#4285F4] bg-[#4285F4]/10 hover:bg-[#4285F4]/20 transition-colors">
                                            <CalendarDays className="w-3 h-3" /> <span className="hidden sm:inline">Google</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* DAY/WEEK/MONTH views omitted for brevity — they remain exactly the same as original */}
                            {/* Importing calendar views would require another component split — keeping inline for now */}
                            
                            {calView === "day" && (
                                <div className="flex-1 overflow-y-auto">
                                    <div className="relative">
                                        {HOURS.map(h => {
                                            const tasksAtH = getTasksForDate(calDateStr).filter(t => t.time && parseInt(t.time.split(":")[0]) === h);
                                            const eventsAtH = getEventsForDate(calDateStr).filter(e => e.time && parseInt(e.time.split(":")[0]) === h);
                                            return (
                                                <div key={h} className="flex border-b border-border min-h-[60px] group">
                                                    <div className="w-14 lg:w-16 shrink-0 text-[10px] text-muted-foreground font-medium pt-1 text-right pr-2 border-r border-border">{String(h).padStart(2, "0")}:00</div>
                                                    <div className="flex-1 relative">
                                                        <div onClick={() => openAddTask(undefined, calDateStr, `${String(h).padStart(2, "0")}:00`)}
                                                            className="h-[30px] border-b border-border/30 hover:bg-[#00A868]/5 cursor-pointer transition-colors flex items-center gap-1 px-2">
                                                            {tasksAtH.filter(t => parseInt(t.time!.split(":")[1]) < 30).map(t => (
                                                                <button key={t.id} onClick={(e) => { e.stopPropagation(); setDetailTask(t); }}
                                                                    className={`px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-[200px] ${t.priority === "high" ? "bg-red-500/15 text-red-500" : t.priority === "medium" ? "bg-amber-500/15 text-amber-500" : "bg-[#00A868]/15 text-[#00A868]"}`}>
                                                                    {t.time} {t.title}
                                                                </button>
                                                            ))}
                                                            {eventsAtH.filter(e => parseInt(e.time!.split(":")[1]) < 30).map(ev => (
                                                                <button key={ev.id} onClick={(e) => { e.stopPropagation(); if (ev.htmlLink) window.open(ev.htmlLink, "_blank"); }}
                                                                    className="px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-[200px] bg-[#4285F4]/15 text-[#4285F4]">
                                                                    {ev.time} {ev.title}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div onClick={() => openAddTask(undefined, calDateStr, `${String(h).padStart(2, "0")}:30`)}
                                                            className="h-[30px] hover:bg-[#00A868]/5 cursor-pointer transition-colors flex items-center gap-1 px-2">
                                                            {tasksAtH.filter(t => parseInt(t.time!.split(":")[1]) >= 30).map(t => (
                                                                <button key={t.id} onClick={(e) => { e.stopPropagation(); setDetailTask(t); }}
                                                                    className={`px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-[200px] ${t.priority === "high" ? "bg-red-500/15 text-red-500" : t.priority === "medium" ? "bg-amber-500/15 text-amber-500" : "bg-[#00A868]/15 text-[#00A868]"}`}>
                                                                    {t.time} {t.title}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {calView === "week" && (
                                <div className="flex-1 overflow-y-auto overflow-x-auto">
                                    <div className="flex sticky top-0 z-10 bg-card border-b border-border">
                                        <div className="w-14 lg:w-16 shrink-0 border-r border-border" />
                                        {getWeekDays.map(wd => {
                                            const isToday = wd.date === today();
                                            return (
                                                <div key={wd.date} className={`flex-1 min-w-[80px] lg:min-w-[100px] text-center py-2 border-r border-border ${isToday ? "bg-[#00A868]/5" : ""}`}>
                                                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{wd.label}</div>
                                                    <button onClick={() => { setCalDate(wd.full); setCalView("day"); }}
                                                        className={`text-sm font-bold mt-0.5 w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-colors ${isToday ? "bg-[#00A868] text-white" : "text-foreground hover:bg-muted"}`}>
                                                        {wd.day}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {HOURS.map(h => (
                                        <div key={h} className="flex border-b border-border">
                                            <div className="w-14 lg:w-16 shrink-0 text-[10px] text-muted-foreground font-medium pt-1 text-right pr-2 border-r border-border">{String(h).padStart(2, "0")}:00</div>
                                            {getWeekDays.map(wd => {
                                                const isToday = wd.date === today();
                                                const tasksAtH = getTasksForDate(wd.date).filter(t => t.time && parseInt(t.time.split(":")[0]) === h);
                                                const eventsAtH = getEventsForDate(wd.date).filter(e => e.time && parseInt(e.time.split(":")[0]) === h);
                                                return (
                                                    <div key={wd.date} className={`flex-1 min-w-[80px] lg:min-w-[100px] border-r border-border ${isToday ? "bg-[#00A868]/3" : ""}`}>
                                                        <div onClick={() => openAddTask(undefined, wd.date, `${String(h).padStart(2, "0")}:00`)}
                                                            className="h-[28px] border-b border-border/20 hover:bg-[#00A868]/5 cursor-pointer transition-colors px-0.5 flex items-center gap-0.5 overflow-hidden">
                                                            {tasksAtH.filter(t => parseInt(t.time!.split(":")[1]) < 30).map(t => (
                                                                <button key={t.id} onClick={(e) => { e.stopPropagation(); setDetailTask(t); }}
                                                                    className={`px-1 py-0 rounded text-[8px] lg:text-[9px] font-medium truncate ${t.priority === "high" ? "bg-red-500/20 text-red-500" : t.priority === "medium" ? "bg-amber-500/20 text-amber-500" : "bg-[#00A868]/20 text-[#00A868]"}`}>
                                                                    {t.title}
                                                                </button>
                                                            ))}
                                                            {eventsAtH.filter(e => parseInt(e.time!.split(":")[1]) < 30).map(ev => (
                                                                <button key={ev.id} onClick={(e) => { e.stopPropagation(); if (ev.htmlLink) window.open(ev.htmlLink, "_blank"); }}
                                                                    className="px-1 rounded text-[8px] lg:text-[9px] font-medium truncate bg-[#4285F4]/20 text-[#4285F4]">{ev.title}</button>
                                                            ))}
                                                        </div>
                                                        <div onClick={() => openAddTask(undefined, wd.date, `${String(h).padStart(2, "0")}:30`)}
                                                            className="h-[28px] hover:bg-[#00A868]/5 cursor-pointer transition-colors px-0.5 flex items-center gap-0.5 overflow-hidden">
                                                            {tasksAtH.filter(t => parseInt(t.time!.split(":")[1]) >= 30).map(t => (
                                                                <button key={t.id} onClick={(e) => { e.stopPropagation(); setDetailTask(t); }}
                                                                    className={`px-1 rounded text-[8px] lg:text-[9px] font-medium truncate ${t.priority === "high" ? "bg-red-500/20 text-red-500" : t.priority === "medium" ? "bg-amber-500/20 text-amber-500" : "bg-[#00A868]/20 text-[#00A868]"}`}>{t.title}</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {calView === "month" && (
                                <div className="flex-1 overflow-y-auto">
                                    <div className="grid grid-cols-7 border-b border-border bg-muted/30">
                                        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                                            <div key={d} className="px-2 py-1.5 text-[9px] lg:text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 flex-1">
                                        {calDays.map((cell, idx) => {
                                            const isToday = cell.date === today();
                                            return (
                                                <div key={idx}
                                                    onClick={() => { if (cell.day > 0) { setCalDate(new Date(cell.date + "T12:00:00")); setCalView("day"); } }}
                                                    className={`min-h-[80px] lg:min-h-[110px] border-b border-r border-border p-1 transition-colors cursor-pointer group
                                                        ${cell.day === 0 ? "bg-muted/20 cursor-default" : "hover:bg-[#00A868]/5"}
                                                        ${isToday ? "bg-[#00A868]/5" : ""}`}>
                                                    {cell.day > 0 && (<>
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <span className={`text-[10px] lg:text-xs font-bold w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center ${isToday ? "bg-[#00A868] text-white" : "text-foreground"}`}>{cell.day}</span>
                                                            <button onClick={(e) => { e.stopPropagation(); openAddTask(undefined, cell.date); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"><Plus className="w-3 h-3 text-[#00A868]" /></button>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            {cell.tasks.slice(0, 3).map(t => (
                                                                <button key={t.id} onClick={(e) => { e.stopPropagation(); setDetailTask(t); }}
                                                                    className={`w-full text-left px-1 py-0 rounded text-[9px] lg:text-[10px] font-medium truncate transition-colors hover:opacity-80
                                                                        ${t.priority === "high" ? "bg-red-500/15 text-red-500" : t.priority === "medium" ? "bg-amber-500/15 text-amber-500" : "bg-[#00A868]/15 text-[#00A868]"}`}>
                                                                    {t.time && <span className="opacity-60 mr-0.5">{t.time}</span>}{t.title}
                                                                </button>
                                                            ))}
                                                            {cell.gcalEvents.slice(0, 2).map(ev => (
                                                                <button key={ev.id} onClick={(e) => { e.stopPropagation(); if (ev.htmlLink) window.open(ev.htmlLink, "_blank"); }}
                                                                    className="w-full text-left px-1 rounded text-[9px] lg:text-[10px] font-medium truncate bg-[#4285F4]/15 text-[#4285F4] hover:opacity-80">
                                                                    {ev.time && <span className="opacity-60 mr-0.5">{ev.time}</span>}{ev.title}
                                                                </button>
                                                            ))}
                                                            {(cell.tasks.length + cell.gcalEvents.length) > 4 && (
                                                                <span className="text-[8px] text-muted-foreground font-medium px-1">+{(cell.tasks.length + cell.gcalEvents.length) - 4}</span>
                                                            )}
                                                        </div>
                                                    </>)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Legend */}
                            <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border bg-muted/20 text-[9px] lg:text-[10px] text-muted-foreground shrink-0">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#00A868]/40" /> BitTask</span>
                                {gcalConnected && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#4285F4]/40" /> Google</span>}
                                <span className="ml-auto">Clique para criar tarefa</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Global Add Task Modal */}
            {globalAdding && (
                <AddTaskModal
                    lists={lists} users={users}
                    defaultListId={globalAddListId}
                    defaultDate={globalAddDate || today()}
                    defaultTime={globalAddTime || nextRoundedTime()}
                    defaultEndTime={globalAddEndTime}
                    onSave={(listId, title, date, time, assigneeId, priority, description) => {
                        addTask(listId, title, date, time, assigneeId, priority, description);
                        setGlobalAdding(false);
                    }}
                    onClose={() => setGlobalAdding(false)}
                />
            )}

            {/* Detail Modal */}
            {detailTask && (
                <TaskDetailModal task={detailTask} users={users}
                    onUpdate={(data) => { updateTask(detailTask.id, data); setDetailTask({ ...detailTask, ...data }); }}
                    onDelete={() => { deleteTask(detailTask.id); setDetailTask(null); }}
                    onClose={() => setDetailTask(null)} />
            )}
        </div>
    );
}
