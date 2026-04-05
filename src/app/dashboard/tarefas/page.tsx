"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    Plus, Loader2, ListTodo, CalendarDays, MoreVertical,
    CheckSquare, Clock, Users, ArrowRight, UserPlus,
    X, Check, Trash2, Calendar, Star, PlayCircle, Grid, Settings2, Hash, Edit3, Save, Columns3, User, LogOut, ChevronLeft, ChevronRight, Share2, Copy, AlertTriangle
} from "lucide-react";
import KanbanBoard from "@/components/KanbanBoard";
import { useConfirm } from "@/components/ConfirmModal";
import {
    TaskDetailModal, AddTaskModal, ListColumn, CalendarView,
    TaskData, TaskListData, UserOption, today, initials, isOverdue,
    formatDateISO, computeEndTime, nextRoundedTime, RECURRENCE_OPTIONS
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
    const [newListShared, setNewListShared] = useState(false);
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [primaryTab, setPrimaryTab] = useState<"minha_carteira" | "franquia" | "avulsos" | "tudo">("tudo");
    const [sidebarFilter, setSidebarFilter] = useState<"all" | "starred" | "assigned" | string>("all");
    const [detailTask, setDetailTask] = useState<TaskData | null>(null);
    const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
    const [dateFilter, setDateFilter] = useState<"all" | "today" | "tomorrow" | "overdue" | "week">("all");

    // Global Add Task modal
    const [globalAdding, setGlobalAdding] = useState(false);
    const [globalAddListId, setGlobalAddListId] = useState<string>("");
    const [globalAddDate, setGlobalAddDate] = useState<string>("");
    const [globalAddTime, setGlobalAddTime] = useState<string>("");
    const [globalAddEndTime, setGlobalAddEndTime] = useState<string>("");

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

    const filteredAssignedToMe = useMemo(() => assignedToMe.filter(t => {
        if (primaryTab === "minha_carteira") return t.clientId && t.client?.userId === currentUserId;
        if (primaryTab === "franquia") return t.clientId && t.client?.userId !== currentUserId;
        if (primaryTab === "avulsos") return !t.clientId;
        return true;
    }), [assignedToMe, primaryTab, currentUserId]);

    const filteredLists = useMemo(() => lists.map(l => ({
        ...l,
        tasks: l.tasks.filter(t => {
            if (primaryTab === "minha_carteira") return t.clientId && t.client?.userId === currentUserId;
            if (primaryTab === "franquia") return t.clientId && t.client?.userId !== currentUserId;
            if (primaryTab === "avulsos") return !t.clientId;
            return true;
        })
    })), [lists, primaryTab, currentUserId]);

    const allTasks = useMemo(() => filteredLists.flatMap(l => l.tasks), [filteredLists]);

    // Date filter
    const dateFilteredTasks = useMemo(() => {
        if (dateFilter === "all") return allTasks;
        const todayStr = today();
        const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowStr = formatDateISO(tomorrowDate);
        const weekDate = new Date(); weekDate.setDate(weekDate.getDate() + 7);
        const weekStr = formatDateISO(weekDate);

        return allTasks.filter(t => {
            if (dateFilter === "today") return t.date === todayStr;
            if (dateFilter === "tomorrow") return t.date === tomorrowStr;
            if (dateFilter === "overdue") return !t.completed && ((t.dueDate && t.dueDate < todayStr) || (t.date && t.date < todayStr));
            if (dateFilter === "week") return t.date >= todayStr && t.date <= weekStr;
            return true;
        });
    }, [allTasks, dateFilter]);

    const totalPending = dateFilteredTasks.filter(t => !t.completed).length;
    const totalStarred = allTasks.filter(t => t.starred && !t.completed).length;

    const teamMembers = useMemo(() => users.filter(u => u.id !== currentUserId), [users, currentUserId]);
    const getTeamTasks = useCallback((userId: string) => allTasks.filter(t => t.assigneeId === userId), [allTasks]);

    // ═══ CRUD ═══
    const createList = async () => {
        if (!newListName.trim()) return;
        try {
            const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newListName.trim(), shared: newListShared }) });
            if (res.ok) { setNewListName(""); setNewListShared(false); setShowNewList(false); load(); }
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

    const addTask = async (listId: string, title: string, date?: string, time?: string, assigneeId?: string, priority?: string, description?: string, force = false, recurrence?: string) => {
        try { 
            const res = await fetch(`/api/tasks/${listId}/items`, { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ title, date, time, assigneeId, priority, description, force, recurrence }), 
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
                    await addTask(listId, title, date, time, assigneeId, priority, description, true, recurrence);
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

    // ═══ List column helpers ═══
    const moveTaskToList = async (taskId: string, targetListId: string) => {
        try { await fetch(`/api/tasks/item/${taskId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listId: targetListId }) }); load(); } catch { /* */ }
    };

    const makeListColumnProps = (list: { id: string; name: string; tasks: TaskData[] }, isSpecial = false, allowListActions = false, onOpenAdd?: () => void) => ({
        list: dateFilter === "all" ? list : { ...list, tasks: list.tasks.filter(t => dateFilteredTasks.some(dt => dt.id === t.id)) },
        users,
        onAdd: isSpecial ? (() => {}) : ((title: string, date?: string, time?: string, assigneeId?: string, priority?: string, description?: string, recurrence?: string) => addTask(list.id, title, date, time, assigneeId, priority, description, false, recurrence)),
        onToggle: (id: string) => { const t = (isSpecial ? list.tasks : allTasks).find(x => x.id === id) || assignedToMe.find(x => x.id === id); if (t) updateTask(id, { completed: !t.completed }); },
        onStar: (id: string) => { const t = (isSpecial ? list.tasks : allTasks).find(x => x.id === id) || assignedToMe.find(x => x.id === id); if (t) updateTask(id, { starred: !t.starred }); },
        onDelete: deleteTask,
        onSchedule: scheduleToCalendar,
        onAssign: (id: string, a: string | null) => updateTask(id, { assigneeId: a }),
        onOpenDetail: setDetailTask,
        isSpecialView: isSpecial,
        onMoveToList: isSpecial ? undefined : moveTaskToList,
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1 pb-3 sm:pb-4 gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#00A868] flex items-center justify-center text-white shadow-lg shadow-[#00A868]/20"><CheckSquare className="w-4 h-4" /></div>
                    <h1 className="text-lg font-bold text-foreground">Tarefas</h1>
                </div>
                
                {/* ═══ CONTEXT TABS (THE CRM MAGIC) ═══ */}
                <div className="flex items-center gap-1 bg-secondary/60 rounded-xl p-1 overflow-x-auto snap-x mx-auto sm:mx-0 order-last w-full sm:w-auto">
                    {(Object.entries({
                        tudo: "Visão Geral",
                        minha_carteira: "Minha Carteira",
                        franquia: "Base da Franquia",
                        avulsos: "Avulsos"
                    }) as [typeof primaryTab, string][]).map(([k, label]) => (
                        <button key={k} onClick={() => setPrimaryTab(k)} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all touch-target snap-start ${primaryTab === k ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:bg-muted"}`}>
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1 sm:gap-2 sm:order-last ml-auto">
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
                    {/* Date Filters First */}
                    <div className="mb-2 space-y-0.5">
                        <button onClick={() => setDateFilter("all")} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === "all" ? "bg-card border border-border shadow-sm text-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                            <ListTodo className="w-4 h-4" /> Todas as datas
                        </button>
                        <button onClick={() => setDateFilter("today")} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === "today" ? "bg-card border border-border shadow-sm text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}>
                            <CalendarDays className="w-4 h-4" /> Hoje
                        </button>
                        <button onClick={() => setDateFilter("tomorrow")} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === "tomorrow" ? "bg-card border border-border shadow-sm text-blue-500" : "text-muted-foreground hover:bg-muted"}`}>
                            <Clock className="w-4 h-4" /> Amanhã
                        </button>
                        <button onClick={() => setDateFilter("week")} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === "week" ? "bg-card border border-border shadow-sm text-purple-500" : "text-muted-foreground hover:bg-muted"}`}>
                            <Calendar className="w-4 h-4" /> Próximos 7 dias
                        </button>
                        <button onClick={() => setDateFilter("overdue")} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === "overdue" ? "bg-red-500/10 text-red-500" : "text-muted-foreground hover:bg-muted hover:text-red-400"}`}>
                            <AlertTriangle className="w-4 h-4" /> Atrasadas
                        </button>
                    </div>

                    <div className="h-px bg-border my-2 mx-2" />

                    <button onClick={() => setSidebarFilter("all")} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${sidebarFilter === "all" ? "bg-[#00A868] text-white" : "text-muted-foreground hover:bg-muted"}`}>
                        <CheckSquare className="w-4 h-4" /> Todas as listas
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

                    {/* ═══ WORKLOAD PANEL ═══ */}
                    {teamMembers.length > 0 && (
                        <div className="mt-3 mb-1 mx-1 p-2.5 rounded-xl bg-secondary/40 border border-border/50">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Users className="w-3 h-3 text-muted-foreground" />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Carga da Equipe</span>
                            </div>
                            {[{ id: currentUserId, name: "Eu" }, ...teamMembers].map(u => {
                                const uTaskCount = u.id === currentUserId
                                    ? allTasks.filter(t => !t.completed && (t.assigneeId === currentUserId || (!t.assigneeId && t.createdById === currentUserId))).length
                                    : allTasks.filter(t => !t.completed && t.assigneeId === u.id).length;
                                const maxLoad = 10;
                                const pct = Math.min((uTaskCount / maxLoad) * 100, 100);
                                const barColor = uTaskCount >= 8 ? "bg-red-500" : uTaskCount >= 5 ? "bg-amber-500" : "bg-[#00A868]";
                                return (
                                    <div key={u.id} className="flex items-center gap-2 mb-1.5 last:mb-0">
                                        <span className="text-[10px] font-medium text-muted-foreground w-12 truncate">{u.name.split(" ")[0]}</span>
                                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                                        </div>
                                        <span className={`text-[9px] font-bold w-4 text-right ${uTaskCount >= 8 ? "text-red-500" : uTaskCount >= 5 ? "text-amber-500" : "text-muted-foreground"}`}>{uTaskCount}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ═══ MINHAS LISTAS ═══ */}
                    {(() => {
                        const myLists = lists.filter(l => !l.shared);
                        const teamLists = lists.filter(l => l.shared);
                        return (<>
                            <div className="mt-4 mb-1"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3">Minhas Listas</span></div>
                            {myLists.map(l => (
                                <button key={l.id} onClick={() => setSidebarFilter(sidebarFilter === `list_${l.id}` ? "all" : `list_${l.id}`)}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${sidebarFilter === `list_${l.id}` ? "bg-[#00A868]/15 text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}>
                                    <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate flex-1 text-left">{l.name}</span>
                                    <span className="text-[10px] opacity-50">{l.tasks.filter(t => !t.completed).length}</span>
                                </button>
                            ))}
                            {teamLists.length > 0 && (<>
                                <div className="mt-3 mb-1"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3">Listas da Equipe</span></div>
                                {teamLists.map(l => (
                                    <button key={l.id} onClick={() => setSidebarFilter(sidebarFilter === `list_${l.id}` ? "all" : `list_${l.id}`)}
                                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${sidebarFilter === `list_${l.id}` ? "bg-blue-500/15 text-blue-500" : "text-muted-foreground hover:bg-muted"}`}>
                                        <Users className="w-3.5 h-3.5 shrink-0 text-blue-500/60" />
                                        <span className="truncate flex-1 text-left">{l.name}</span>
                                        <span className="text-[10px] opacity-50">{l.tasks.filter(t => !t.completed).length}</span>
                                    </button>
                                ))}
                            </>)}
                        </>);
                    })()}
                    <button onClick={() => setShowNewList(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"><Plus className="w-3.5 h-3.5" /> Criar nova lista</button>

                    {showNewList && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowNewList(false)}>
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                            <div className="relative w-full max-w-sm card-elevated shadow-2xl rounded-2xl p-5 animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
                                <h3 className="text-base font-bold text-foreground mb-4">Criar nova lista</h3>
                                <input value={newListName} onChange={e => setNewListName(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter" && newListName.trim()) createList(); if (e.key === "Escape") setShowNewList(false); }}
                                    autoFocus placeholder="Digite o nome"
                                    className="w-full text-sm text-foreground bg-transparent border-b-2 border-border focus:border-[#00A868] focus:outline-none pb-2 placeholder-muted-foreground/50 transition-colors mb-4" />
                                <label className="flex items-center gap-2 mb-5 cursor-pointer group">
                                    <input type="checkbox" checked={newListShared} onChange={e => setNewListShared(e.target.checked)}
                                        className="w-4 h-4 rounded border-border text-[#00A868] focus:ring-[#00A868]" />
                                    <div>
                                        <span className="text-sm font-medium text-foreground group-hover:text-[#00A868] transition-colors">Compartilhar com equipe</span>
                                        <p className="text-[10px] text-muted-foreground">Todos da organização poderão ver e adicionar tarefas</p>
                                    </div>
                                </label>
                                <div className="flex items-center justify-end gap-3">
                                    <button onClick={() => { setShowNewList(false); setNewListName(""); setNewListShared(false); }} className="px-4 py-2 text-sm font-medium text-[#00A868] hover:bg-muted rounded-xl transition-colors">Cancelar</button>
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
                            {sidebarFilter === "assigned" && <ListColumn {...makeListColumnProps({ id: "assigned", name: "Atribuídas a mim", tasks: filteredAssignedToMe }, true)} />}
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
                        users={users}
                        currentUserId={currentUserId}
                        onToggle={(id: string) => { const t = allTasks.find(x => x.id === id); if (t) updateTask(id, { completed: !t.completed }); }}
                        onUpdate={(id: string, data: Record<string, any>) => updateTask(id, data)}
                        onSelect={setDetailTask}
                    />
                )}

                {/* ═══ CALENDAR VIEW ═══ */}
                {view === "calendar" && (
                    <CalendarView
                        allTasks={allTasks}
                        gcalEvents={gcalEvents}
                        gcalConnected={gcalConnected}
                        onOpenAddTask={openAddTask}
                        onOpenDetail={setDetailTask}
                    />
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
