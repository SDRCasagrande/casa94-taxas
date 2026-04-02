"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    CheckSquare, Plus, Trash2, Circle, CheckCircle2, Calendar,
    Star, ChevronLeft, ChevronRight, ListTodo, CalendarDays,
    ExternalLink, MoreVertical, ChevronDown, Loader2, UserPlus,
    Pencil, SortAsc, Copy, Check, X, Users, MessageSquare,
    AlertTriangle, Flag, Clock, Columns3, Repeat, Sun
} from "lucide-react";
import KanbanBoard from "@/components/KanbanBoard";
import { useConfirm } from "@/components/ConfirmModal";

interface UserOption { id: string; name: string; email: string }
interface TaskData {
    id: string; title: string; description: string; completed: boolean; date: string; time: string;
    dueDate?: string; starred: boolean; scheduled: boolean; priority: string; listId: string; createdById: string;
    assigneeId: string | null;
    assignee: UserOption | null;
    createdBy: { id: string; name: string };
    createdAt: string;
}
interface TaskListData { id: string; name: string; tasks: TaskData[] }

function today() { return new Date().toISOString().split("T")[0]; }
function friendlyDate(d: string) {
    if (!d) return "";
    const t = new Date(); const todayStr = t.toISOString().split("T")[0];
    t.setDate(t.getDate() + 1); const tomorrowStr = t.toISOString().split("T")[0];
    if (d === todayStr) return "Hoje";
    if (d === tomorrowStr) return "Amanhã";
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}
function isOverdue(d: string) { return d ? d < today() : false; }
function initials(name: string) { return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase(); }

const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof Flag }> = {
    high: { label: "Alta", color: "text-red-500", bg: "bg-red-500/10", icon: Flag },
    medium: { label: "Média", color: "text-amber-500", bg: "bg-amber-500/10", icon: Flag },
    low: { label: "Baixa", color: "text-[#00A868]", bg: "bg-[#00A868]/10", icon: Flag },
};

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
    const [gcalConnecting, setGcalConnecting] = useState(false);

    // ═══ Global "Add Task" modal state (elevated to page level) ═══
    const [globalAdding, setGlobalAdding] = useState(false);
    const [globalAddListId, setGlobalAddListId] = useState<string>("");
    const [globalAddDate, setGlobalAddDate] = useState<string>("");
    const [globalAddTime, setGlobalAddTime] = useState<string>("");

    function nextRoundedTime() {
        const now = new Date();
        const mins = now.getMinutes();
        const roundedMins = mins < 30 ? 30 : 0;
        const h = mins < 30 ? now.getHours() : now.getHours() + 1;
        return `${String(h % 24).padStart(2, "0")}:${String(roundedMins).padStart(2, "0")}`;
    }

    function openAddTask(listId?: string, date?: string, time?: string) {
        setGlobalAddListId(listId || (lists.length > 0 ? lists[0].id : ""));
        setGlobalAddDate(date || "");
        setGlobalAddTime(time || "");
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

    // Check Google Calendar status
    const [gcalEmail, setGcalEmail] = useState("");
    useEffect(() => {
        fetch("/api/google-calendar/status").then(r => r.json()).then(d => {
            setGcalConnected(d.connected === true);
            if (d.googleEmail) setGcalEmail(d.googleEmail);
        }).catch(() => setGcalConnected(false));
    }, []);

    // Google Calendar events
    interface GCalEvent { id: string; title: string; date: string; time: string; isGoogleEvent: boolean; isBitTask: boolean; htmlLink: string }
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

    // Team tasks: group by user for supervisor view
    const teamMembers = useMemo(() => {
        return users.filter(u => u.id !== currentUserId);
    }, [users, currentUserId]);

    // Get tasks for a specific team member (tasks assigned to them)
    const getTeamTasks = useCallback((userId: string) => {
        return allTasks.filter(t => t.assigneeId === userId);
    }, [allTasks]);

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
        const { confirmed } = await confirmAction({
            title: "Excluir lista",
            message: `Tem certeza que deseja excluir a lista "${name}" e todas as suas tarefas? Esta ação não pode ser desfeita.`,
            variant: "danger",
            confirmText: "Excluir Lista",
        });
        if (!confirmed) return;
        try { await fetch(`/api/tasks/${listId}`, { method: "DELETE" }); setSidebarFilter("all"); load(); } catch { /* */ }
    };

    const addTask = async (listId: string, title: string, date?: string, time?: string, assigneeId?: string, priority?: string, description?: string) => {
        try {
            await fetch(`/api/tasks/${listId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, date, time, assigneeId, priority, description }) });
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

    // Calendar
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

    // Week helpers
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

    const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00
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

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#00A868]" /></div>;

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-1 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#00A868] flex items-center justify-center text-white shadow-lg shadow-[#00A868]/20"><CheckSquare className="w-4 h-4" /></div>
                    <h1 className="text-lg font-bold text-foreground">Tarefas</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setView("board")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === "board" ? "bg-[#00A868]/10 text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}><ListTodo className="w-3.5 h-3.5" /> Board</button>
                    <button onClick={() => setView("kanban")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === "kanban" ? "bg-[#00A868]/10 text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}><Columns3 className="w-3.5 h-3.5" /> Kanban</button>
                    <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === "calendar" ? "bg-[#00A868]/10 text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}><CalendarDays className="w-3.5 h-3.5" /> Calendário</button>
                </div>
            </div>

            <div className="flex flex-1 gap-4 min-h-0 overflow-hidden flex-col lg:flex-row">
                {/* ═══ Mobile Filter Strip ═══ */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden shrink-0 -mx-1 px-1">
                    <button onClick={() => setSidebarFilter("all")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${sidebarFilter === "all" ? "bg-[#00A868] text-white" : "bg-secondary text-muted-foreground"}`}>
                        <CheckSquare className="w-3.5 h-3.5" /> Todas {totalPending > 0 && <span className="opacity-70">{totalPending}</span>}
                    </button>
                    <button onClick={() => setSidebarFilter("starred")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${sidebarFilter === "starred" ? "bg-amber-500/20 text-amber-500" : "bg-secondary text-muted-foreground"}`}>
                        <Star className="w-3.5 h-3.5" /> Estrela {totalStarred > 0 && <span className="opacity-70">{totalStarred}</span>}
                    </button>
                    <button onClick={() => setSidebarFilter("assigned")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${sidebarFilter === "assigned" ? "bg-purple-500/20 text-purple-500" : "bg-secondary text-muted-foreground"}`}>
                        <UserPlus className="w-3.5 h-3.5" /> Minhas {assignedToMe.filter(t => !t.completed).length > 0 && <span className="opacity-70">{assignedToMe.filter(t => !t.completed).length}</span>}
                    </button>
                    {lists.map(l => (
                        <button key={l.id} onClick={() => setSidebarFilter(sidebarFilter === `list_${l.id}` ? "all" : `list_${l.id}`)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${sidebarFilter === `list_${l.id}` ? "bg-[#00A868] text-white" : "bg-secondary text-muted-foreground"}`}>
                            {l.name} <span className="opacity-50">{l.tasks.filter(t => !t.completed).length}</span>
                        </button>
                    ))}
                </div>

                {/* Sidebar */}
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

                    {/* Team Section */}
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
                    <button onClick={() => setSidebarFilter("assigned")}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${sidebarFilter === "assigned" ? "bg-purple-500/20 text-purple-500 border border-purple-500/20" : "text-muted-foreground hover:bg-muted/50 border border-transparent"}`}>
                        <UserPlus className="w-4 h-4 shrink-0" /> Atribuídas a mim
                        <span className="ml-auto text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-full font-bold">{assignedToMe.filter(t => !t.completed).length}</span>
                    </button>
                    {lists.map(l => (
                        <button key={l.id} onClick={() => setSidebarFilter(sidebarFilter === `list_${l.id}` ? "all" : `list_${l.id}`)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${sidebarFilter === `list_${l.id}` ? "bg-[#00A868]/15 text-[#00A868]" : "text-muted-foreground hover:bg-muted"}`}>
                            <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate flex-1 text-left">{l.name}</span>
                            <span className="text-[10px] opacity-50">{l.tasks.filter(t => !t.completed).length}</span>
                        </button>
                    ))}
                    <button onClick={() => setShowNewList(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"><Plus className="w-3.5 h-3.5" /> Criar nova lista</button>

                    {/* Create List Modal — Google Tasks Style */}
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
                                    <button onClick={() => { setShowNewList(false); setNewListName(""); }}
                                        className="px-4 py-2 text-sm font-medium text-[#00A868] hover:bg-muted rounded-xl transition-colors">
                                        Cancelar
                                    </button>
                                    <button onClick={createList} disabled={!newListName.trim()}
                                        className="px-4 py-2 text-sm font-medium text-[#00A868] hover:bg-muted rounded-xl transition-colors disabled:opacity-30">
                                        Concluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main */}
                {view === "board" && (
                    <div className="flex-1 overflow-x-auto">
                        <div className="flex flex-col lg:flex-row gap-4 min-h-full pb-4" style={{ minWidth: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${Math.max(lists.length + 1, 2) * 320}px` : 'auto' }}>
                            {sidebarFilter === "starred" && (
                                <ListColumn key="starred" list={{ id: "starred", name: "Com estrela", tasks: allTasks.filter(t => t.starred) }} users={users}
                                    onAdd={() => {}} onToggle={(id) => { const t = allTasks.find(x => x.id === id); if (t) updateTask(id, { completed: !t.completed }); }}
                                    onStar={(id) => { const t = allTasks.find(x => x.id === id); if (t) updateTask(id, { starred: !t.starred }); }}
                                    onDelete={deleteTask} onSchedule={scheduleToCalendar} onAssign={(id, a) => updateTask(id, { assigneeId: a })}
                                    onOpenDetail={setDetailTask} isSpecialView />
                            )}
                            {sidebarFilter === "assigned" && (
                                <ListColumn key="assigned" list={{ id: "assigned", name: "Atribuídas a mim", tasks: assignedToMe }} users={users}
                                    onAdd={() => {}} onToggle={(id) => { const t = assignedToMe.find(x => x.id === id); if (t) updateTask(id, { completed: !t.completed }); }}
                                    onStar={(id) => { const t = assignedToMe.find(x => x.id === id); if (t) updateTask(id, { starred: !t.starred }); }}
                                    onDelete={deleteTask} onSchedule={scheduleToCalendar} onAssign={(id, a) => updateTask(id, { assigneeId: a })}
                                    onOpenDetail={setDetailTask} isSpecialView />
                            )}
                            {/* Team member view */}
                            {sidebarFilter.startsWith("team_") && (() => {
                                const userId = sidebarFilter.replace("team_", "");
                                const user = users.find(u => u.id === userId);
                                const tasks = getTeamTasks(userId);
                                return (
                                    <ListColumn key={`team-${userId}`} list={{ id: `team-${userId}`, name: `Tarefas ${user?.name.split(" ")[0] || ""}`, tasks }} users={users}
                                        onAdd={() => {}} onToggle={(id) => { const t = tasks.find(x => x.id === id); if (t) updateTask(id, { completed: !t.completed }); }}
                                        onStar={(id) => { const t = tasks.find(x => x.id === id); if (t) updateTask(id, { starred: !t.starred }); }}
                                        onDelete={deleteTask} onSchedule={scheduleToCalendar} onAssign={(id, a) => updateTask(id, { assigneeId: a })}
                                        onOpenDetail={setDetailTask} isSpecialView />
                                );
                            })()}
                            {(sidebarFilter === "all" || sidebarFilter.startsWith("list_")) && (() => {
                                const visibleLists = sidebarFilter.startsWith("list_")
                                    ? lists.filter(l => l.id === sidebarFilter.replace("list_", ""))
                                    : lists;
                                return visibleLists.map(list => (
                                    <ListColumn key={list.id} list={list} users={users}
                                        onAdd={(title, date, time, assigneeId, priority, description) => addTask(list.id, title, date, time, assigneeId, priority, description)}
                                        onToggle={(id) => { const t = allTasks.find(x => x.id === id) || assignedToMe.find(x => x.id === id); if (t) updateTask(id, { completed: !t.completed }); }}
                                        onStar={(id) => { const t = allTasks.find(x => x.id === id) || assignedToMe.find(x => x.id === id); if (t) updateTask(id, { starred: !t.starred }); }}
                                        onDelete={deleteTask} onSchedule={scheduleToCalendar} onAssign={(id, a) => updateTask(id, { assigneeId: a })}
                                        onOpenDetail={setDetailTask}
                                        onDeleteList={lists.length > 1 ? () => deleteList(list.id, list.name) : undefined}
                                        onRenameList={(newName) => renameList(list.id, newName)}
                                        onClearCompleted={() => { list.tasks.filter(t => t.completed).forEach(t => deleteTask(t.id)); }}
                                        onOpenAddTask={() => openAddTask(list.id)} />
                                ));
                            })()}
                            {/* Show assigned-to-me tasks that are NOT in user's own lists */}
                            {sidebarFilter === "all" && (() => {
                                const ownTaskIds = new Set(allTasks.map(t => t.id));
                                const extraAssigned = assignedToMe.filter(t => !ownTaskIds.has(t.id));
                                if (extraAssigned.length === 0) return null;
                                return (
                                    <ListColumn key="assigned-inline" list={{ id: "assigned-inline", name: "Atribuídas a mim", tasks: extraAssigned }} users={users}
                                        onAdd={() => {}} onToggle={(id) => { const t = extraAssigned.find(x => x.id === id); if (t) updateTask(id, { completed: !t.completed }); }}
                                        onStar={(id) => { const t = extraAssigned.find(x => x.id === id); if (t) updateTask(id, { starred: !t.starred }); }}
                                        onDelete={deleteTask} onSchedule={scheduleToCalendar} onAssign={(id, a) => updateTask(id, { assigneeId: a })}
                                        onOpenDetail={setDetailTask} isSpecialView />
                                );
                            })()}
                            {sidebarFilter === "all" && (
                                <div className="w-72 shrink-0">
                                    {showNewList ? (
                                        <div className="card-elevated p-4 space-y-2">
                                            <input value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === "Enter" && createList()} autoFocus placeholder="Nome da lista..."
                                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none" />
                                            <div className="flex gap-2">
                                                <button onClick={createList} className="px-4 py-1.5 bg-[#00A868] text-white rounded-lg text-sm font-medium">Criar</button>
                                                <button onClick={() => { setShowNewList(false); setNewListName(""); }} className="px-4 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm">Cancelar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowNewList(true)} className="w-full flex items-center gap-2 px-4 py-3 bg-card/50 border border-dashed border-border rounded-2xl text-sm text-muted-foreground hover:text-foreground transition-all"><Plus className="w-4 h-4" /> Nova lista</button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {view === "kanban" && (
                    <KanbanBoard
                        tasks={allTasks}
                        onToggle={(id) => { const t = allTasks.find(x => x.id === id); if (t) updateTask(id, { completed: !t.completed }); }}
                        onUpdate={(id, data) => updateTask(id, data)}
                        onSelect={setDetailTask}
                    />
                )}

                {view === "calendar" && (
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-border card-elevated">
                            {/* ═══ Calendar Toolbar ═══ */}
                            <div className="flex items-center justify-between px-3 lg:px-4 py-2 border-b border-border bg-card shrink-0 gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 lg:gap-3">
                                    <button onClick={() => navigateCal(-1)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <h3 className="text-xs lg:text-sm font-bold text-foreground capitalize min-w-0 text-center truncate">{calTitle}</h3>
                                    <button onClick={() => navigateCal(1)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button onClick={goToday} className="px-2 py-1 rounded-lg text-[10px] lg:text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors">Hoje</button>
                                </div>
                                <div className="flex items-center gap-1">
                                    {/* View toggles */}
                                    {(["day", "week", "month"] as const).map(v => (
                                        <button key={v} onClick={() => setCalView(v)}
                                            className={`px-2 lg:px-2.5 py-1 rounded-lg text-[10px] lg:text-[11px] font-medium transition-all ${calView === v ? "bg-[#00A868]/10 text-[#00A868] font-bold" : "text-muted-foreground hover:bg-muted"}`}>
                                            {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
                                        </button>
                                    ))}
                                    <div className="w-px h-4 bg-border mx-1" />
                                    <button onClick={() => openAddTask()}
                                        className="flex items-center gap-1 px-2 lg:px-3 py-1 rounded-lg text-[10px] lg:text-[11px] font-bold bg-[#00A868] text-white hover:bg-[#008f58] shadow-sm transition-all active:scale-95">
                                        <Plus className="w-3 h-3" /> <span className="hidden sm:inline">Nova Tarefa</span>
                                    </button>
                                    {gcalConnected && <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4] animate-pulse" />}
                                    {gcalConnected === false && (
                                        <button onClick={() => { window.location.href = "/api/google-calendar/auth"; }}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[#4285F4] bg-[#4285F4]/10 hover:bg-[#4285F4]/20 transition-colors">
                                            <CalendarDays className="w-3 h-3" /> <span className="hidden sm:inline">Google</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ═══ DAY VIEW ═══ */}
                            {calView === "day" && (
                                <div className="flex-1 overflow-y-auto">
                                    <div className="relative">
                                        {HOURS.map(h => {
                                            const tasksAtH = getTasksForDate(calDateStr).filter(t => t.time && parseInt(t.time.split(":")[0]) === h);
                                            const eventsAtH = getEventsForDate(calDateStr).filter(e => e.time && parseInt(e.time.split(":")[0]) === h);
                                            return (
                                                <div key={h} className="flex border-b border-border min-h-[60px] group">
                                                    <div className="w-14 lg:w-16 shrink-0 text-[10px] text-muted-foreground font-medium pt-1 text-right pr-2 border-r border-border">
                                                        {String(h).padStart(2, "0")}:00
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        {/* :00 slot */}
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
                                                            <span className="opacity-0 group-hover:opacity-40 text-[9px] text-muted-foreground ml-auto">+</span>
                                                        </div>
                                                        {/* :30 slot */}
                                                        <div onClick={() => openAddTask(undefined, calDateStr, `${String(h).padStart(2, "0")}:30`)}
                                                            className="h-[30px] hover:bg-[#00A868]/5 cursor-pointer transition-colors flex items-center gap-1 px-2">
                                                            {tasksAtH.filter(t => parseInt(t.time!.split(":")[1]) >= 30).map(t => (
                                                                <button key={t.id} onClick={(e) => { e.stopPropagation(); setDetailTask(t); }}
                                                                    className={`px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-[200px] ${t.priority === "high" ? "bg-red-500/15 text-red-500" : t.priority === "medium" ? "bg-amber-500/15 text-amber-500" : "bg-[#00A868]/15 text-[#00A868]"}`}>
                                                                    {t.time} {t.title}
                                                                </button>
                                                            ))}
                                                            {eventsAtH.filter(e => parseInt(e.time!.split(":")[1]) >= 30).map(ev => (
                                                                <button key={ev.id} onClick={(e) => { e.stopPropagation(); if (ev.htmlLink) window.open(ev.htmlLink, "_blank"); }}
                                                                    className="px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-[200px] bg-[#4285F4]/15 text-[#4285F4]">
                                                                    {ev.time} {ev.title}
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

                            {/* ═══ WEEK VIEW ═══ */}
                            {calView === "week" && (
                                <div className="flex-1 overflow-y-auto overflow-x-auto">
                                    {/* Week header */}
                                    <div className="flex sticky top-0 z-10 bg-card border-b border-border">
                                        <div className="w-14 lg:w-16 shrink-0 border-r border-border" />
                                        {getWeekDays.map(wd => {
                                            const isToday = wd.date === today();
                                            return (
                                                <div key={wd.date} className={`flex-1 min-w-[80px] lg:min-w-[100px] text-center py-2 border-r border-border ${isToday ? "bg-[#00A868]/5" : ""}`}>
                                                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{wd.label}</div>
                                                    <button onClick={() => { setCalDate(wd.full); setCalView("day"); }}
                                                        className={`text-sm font-bold mt-0.5 w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-colors
                                                            ${isToday ? "bg-[#00A868] text-white" : "text-foreground hover:bg-muted"}`}>
                                                        {wd.day}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Time grid */}
                                    {HOURS.map(h => (
                                        <div key={h} className="flex border-b border-border">
                                            <div className="w-14 lg:w-16 shrink-0 text-[10px] text-muted-foreground font-medium pt-1 text-right pr-2 border-r border-border">
                                                {String(h).padStart(2, "0")}:00
                                            </div>
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
                                                                    className="px-1 rounded text-[8px] lg:text-[9px] font-medium truncate bg-[#4285F4]/20 text-[#4285F4]">
                                                                    {ev.title}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div onClick={() => openAddTask(undefined, wd.date, `${String(h).padStart(2, "0")}:30`)}
                                                            className="h-[28px] hover:bg-[#00A868]/5 cursor-pointer transition-colors px-0.5 flex items-center gap-0.5 overflow-hidden">
                                                            {tasksAtH.filter(t => parseInt(t.time!.split(":")[1]) >= 30).map(t => (
                                                                <button key={t.id} onClick={(e) => { e.stopPropagation(); setDetailTask(t); }}
                                                                    className={`px-1 rounded text-[8px] lg:text-[9px] font-medium truncate ${t.priority === "high" ? "bg-red-500/20 text-red-500" : t.priority === "medium" ? "bg-amber-500/20 text-amber-500" : "bg-[#00A868]/20 text-[#00A868]"}`}>
                                                                    {t.title}
                                                                </button>
                                                            ))}
                                                            {eventsAtH.filter(e => parseInt(e.time!.split(":")[1]) >= 30).map(ev => (
                                                                <button key={ev.id} onClick={(e) => { e.stopPropagation(); if (ev.htmlLink) window.open(ev.htmlLink, "_blank"); }}
                                                                    className="px-1 rounded text-[8px] lg:text-[9px] font-medium truncate bg-[#4285F4]/20 text-[#4285F4]">
                                                                    {ev.title}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ═══ MONTH VIEW ═══ */}
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
                                                        ${isToday ? "bg-[#00A868]/5" : ""}`}
                                                >
                                                    {cell.day > 0 && (
                                                        <>
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <span className={`text-[10px] lg:text-xs font-bold w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center
                                                                    ${isToday ? "bg-[#00A868] text-white" : "text-foreground"}`}>
                                                                    {cell.day}
                                                                </span>
                                                                <button onClick={(e) => { e.stopPropagation(); openAddTask(undefined, cell.date); }}
                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted">
                                                                    <Plus className="w-3 h-3 text-[#00A868]" />
                                                                </button>
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
                                                        </>
                                                    )}
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
                    lists={lists}
                    users={users}
                    defaultListId={globalAddListId}
                    defaultDate={globalAddDate || today()}
                    defaultTime={globalAddTime || nextRoundedTime()}
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

/* ═══ TASK DETAIL MODAL (Centered + Save Button) ═══ */
function TaskDetailModal({ task, users, onUpdate, onDelete, onClose }: {
    task: TaskData; users: UserOption[];
    onUpdate: (data: Record<string, any>) => void; onDelete: () => void; onClose: () => void;
}) {
    const confirmAction = useConfirm();
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || "");
    const [priority, setPriority] = useState(task.priority || "medium");
    const [date, setDate] = useState(task.date);
    const [time, setTime] = useState(task.time);
    const [assigneeId, setAssigneeId] = useState(task.assigneeId || "");
    const [dueDate, setDueDate] = useState(task.dueDate || "");
    const [editingTitle, setEditingTitle] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Comments/updates
    interface TaskComment { id: string; userId: string; userName: string; text: string; createdAt: string }
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [loadingComments, setLoadingComments] = useState(true);

    useEffect(() => {
        fetch(`/api/tasks/item/${task.id}/comments`).then(r => r.json()).then(d => {
            if (Array.isArray(d)) setComments(d);
        }).catch(() => {}).finally(() => setLoadingComments(false));
    }, [task.id]);

    const addComment = async () => {
        if (!newComment.trim()) return;
        try {
            const res = await fetch(`/api/tasks/item/${task.id}/comments`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: newComment.trim() }),
            });
            if (res.ok) {
                const c = await res.json();
                setComments(prev => [...prev, c]);
                setNewComment("");
            }
        } catch { /* */ }
    };

    // Track changes
    const markDirty = () => { if (!dirty) setDirty(true); };

    function handleSave() {
        const updates: Record<string, any> = {};
        if (title.trim() && title !== task.title) updates.title = title.trim();
        if (description !== (task.description || "")) updates.description = description;
        if (priority !== task.priority) updates.priority = priority;
        if (date !== task.date) updates.date = date;
        if (time !== task.time) updates.time = time;
        if (dueDate !== (task.dueDate || "")) updates.dueDate = dueDate;
        const newAssignee = assigneeId || null;
        if (newAssignee !== task.assigneeId) updates.assigneeId = newAssignee;

        if (Object.keys(updates).length > 0) {
            onUpdate(updates);
            // Refresh comments after save (in case auto-log triggers)
            setTimeout(() => {
                fetch(`/api/tasks/item/${task.id}/comments`).then(r => r.json()).then(d => {
                    if (Array.isArray(d)) setComments(d);
                }).catch(() => {});
            }, 500);
        }

        setSaved(true);
        setDirty(false);
    }

    const pri = PRIORITY_MAP[priority] || PRIORITY_MAP.medium;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-lg max-h-[90vh] card-elevated shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => onUpdate({ completed: !task.completed })}
                            className={`${task.completed ? "text-[#00A868]" : "text-muted-foreground hover:text-[#00A868]"} transition-colors`}>
                            {task.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        </button>
                        <span className="text-sm font-bold text-foreground">Detalhes da Tarefa</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Title */}
                    {editingTitle ? (
                        <input value={title} onChange={e => { setTitle(e.target.value); markDirty(); }} autoFocus
                            onBlur={() => setEditingTitle(false)}
                            onKeyDown={e => { if (e.key === "Enter") setEditingTitle(false); if (e.key === "Escape") { setTitle(task.title); setEditingTitle(false); } }}
                            className="w-full text-lg font-bold text-foreground bg-transparent border-b-2 border-[#00A868] focus:outline-none pb-1" />
                    ) : (
                        <h2 onClick={() => setEditingTitle(true)} className={`text-lg font-bold cursor-pointer hover:text-[#00A868] transition-colors break-words ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{title || task.title}</h2>
                    )}

                    {/* Meta Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Priority */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prioridade</label>
                            <select value={priority} onChange={e => { setPriority(e.target.value); markDirty(); }}
                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50">
                                <option value="high">🔴 Alta</option>
                                <option value="medium">🟡 Média</option>
                                <option value="low">🔵 Baixa</option>
                            </select>
                        </div>

                        {/* Assignee */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Responsável</label>
                            <select value={assigneeId} onChange={e => { setAssigneeId(e.target.value); markDirty(); }}
                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50">
                                <option value="">Sem responsável</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>

                        {/* Date */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data</label>
                            <div className="relative">
                                <input type="date" value={date} onChange={e => { setDate(e.target.value); markDirty(); }}
                                    id="task-date-input"
                                    className="w-full px-3 py-2 pr-9 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark]" />
                                <button type="button" onClick={() => { const el = document.getElementById('task-date-input') as HTMLInputElement; el?.showPicker?.(); el?.focus(); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-[#00A868]/10 text-muted-foreground hover:text-[#00A868] transition-colors">
                                    <CalendarDays className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex gap-1">
                                {[
                                    { label: "Hoje", days: 0 },
                                    { label: "Amanhã", days: 1 },
                                    { label: "+1 sem", days: 7 },
                                ].map(s => {
                                    const d = new Date(); d.setDate(d.getDate() + s.days);
                                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                    return (
                                        <button key={s.label} type="button" onClick={() => { setDate(val); markDirty(); }}
                                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors ${date === val ? "bg-[#00A868] text-white" : "bg-muted text-muted-foreground hover:bg-[#00A868]/10 hover:text-[#00A868]"}`}>
                                            {s.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Time */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Horário</label>
                            <div className="relative">
                                <input type="time" value={time} onChange={e => { setTime(e.target.value); markDirty(); }}
                                    id="task-time-input"
                                    className="w-full px-3 py-2 pr-9 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark]" />
                                <button type="button" onClick={() => { const el = document.getElementById('task-time-input') as HTMLInputElement; el?.showPicker?.(); el?.focus(); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-[#00A868]/10 text-muted-foreground hover:text-[#00A868] transition-colors">
                                    <Clock className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex gap-1">
                                {["09:00", "10:00", "14:00", "18:00"].map(t => (
                                    <button key={t} type="button" onClick={() => { setTime(t); markDirty(); }}
                                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors ${time === t ? "bg-[#00A868] text-white" : "bg-muted text-muted-foreground hover:bg-[#00A868]/10 hover:text-[#00A868]"}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Deadline */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prazo</label>
                            <div className="relative">
                                <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); markDirty(); }}
                                    id="task-due-input"
                                    className={`w-full px-3 py-2 pr-9 bg-muted/50 border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark] ${
                                        dueDate && new Date(dueDate + 'T23:59:59') < new Date() ? 'border-red-500/50 text-red-400' : 'border-border'
                                    }`} />
                                <button type="button" onClick={() => { const el = document.getElementById('task-due-input') as HTMLInputElement; el?.showPicker?.(); el?.focus(); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-[#00A868]/10 text-muted-foreground hover:text-[#00A868] transition-colors">
                                    <CalendarDays className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex gap-1">
                                {[
                                    { label: "+3d", days: 3 },
                                    { label: "+1 sem", days: 7 },
                                    { label: "+15d", days: 15 },
                                    { label: "+30d", days: 30 },
                                ].map(s => {
                                    const d = new Date(); d.setDate(d.getDate() + s.days);
                                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                    return (
                                        <button key={s.label} type="button" onClick={() => { setDueDate(val); markDirty(); }}
                                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors ${dueDate === val ? "bg-[#00A868] text-white" : "bg-muted text-muted-foreground hover:bg-[#00A868]/10 hover:text-[#00A868]"}`}>
                                            {s.label}
                                        </button>
                                    );
                                })}
                                {dueDate && (
                                    <button type="button" onClick={() => { setDueDate(""); markDirty(); }}
                                        className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                                        Limpar
                                    </button>
                                )}
                            </div>
                            {dueDate && new Date(dueDate + 'T23:59:59') < new Date() && (
                                <p className="text-[10px] text-red-400 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Prazo vencido</p>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição / Notas</label>
                        <textarea value={description} onChange={e => { setDescription(e.target.value); markDirty(); }}
                            rows={4} placeholder="Adicione detalhes, observações..."
                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50 resize-none" />
                    </div>

                    {/* Atualizações */}
                    <div className="space-y-2 pt-3 border-t border-border/50">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Atualizações
                        </label>
                        <div className="max-h-40 overflow-y-auto space-y-1.5">
                            {loadingComments ? (
                                <p className="text-[10px] text-muted-foreground">Carregando...</p>
                            ) : comments.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground italic">Nenhuma atualização</p>
                            ) : comments.map(c => (
                                <div key={c.id} className="flex gap-2 items-start">
                                    <div className="w-5 h-5 rounded-full bg-[#00A868]/20 text-[#00A868] flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">
                                        {c.userName.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] text-foreground"><span className="font-bold">{c.userName}</span> <span className="text-muted-foreground">· {new Date(c.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></p>
                                        <p className="text-xs text-foreground/80">{c.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-1.5 mt-1">
                            <input value={newComment} onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                                placeholder="Escreva uma atualização..."
                                className="flex-1 px-3 py-1.5 bg-muted/50 border border-border rounded-xl text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50 min-w-0" />
                            <button onClick={addComment} disabled={!newComment.trim()}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#00A868] text-white hover:bg-[#008f58] disabled:opacity-30 transition-all shrink-0">
                                Enviar
                            </button>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-2 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" /> Criada em {new Date(task.createdAt).toLocaleString("pt-BR")}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="w-3.5 h-3.5" /> Por {task.createdBy.name}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-t border-border shrink-0">
                    <button onClick={() => { onUpdate({ starred: !task.starred }); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium ${task.starred ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground hover:text-amber-500"}`}>
                        <Star className={`w-3.5 h-3.5 ${task.starred ? "fill-amber-500" : ""}`} /> {task.starred ? "Favorita" : "Favoritar"}
                    </button>
                    <button onClick={() => {
                        const t = encodeURIComponent(title || task.title);
                        const desc = encodeURIComponent(`${description || ""}\n\n— BitTask`);
                        let url = `https://calendar.google.com/calendar/r/eventedit?text=${t}&details=${desc}`;
                        if (date) {
                            const d = date.replace(/-/g, "");
                            if (time) {
                                const startTime = `${d}T${time.replace(":", "")}00`;
                                const endH = parseInt(time.split(":")[0]) + 1;
                                const endTime = `${d}T${String(endH).padStart(2, "0")}${time.split(":")[1]}00`;
                                url += `&dates=${startTime}/${endTime}`;
                            } else {
                                url += `&dates=${d}/${d}`;
                            }
                        }
                        window.open(url, "_blank");
                        onUpdate({ scheduled: true });
                    }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                        <Calendar className="w-3.5 h-3.5" /> Agendar
                    </button>
                    <button onClick={async () => {
                        const { confirmed } = await confirmAction({
                            title: "Excluir tarefa",
                            message: `Tem certeza que deseja excluir "${title || task.title}"?`,
                            variant: "danger",
                            confirmText: "Excluir",
                        });
                        if (confirmed) onDelete();
                    }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20">
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>

                    {/* Save Button — pushed to right */}
                    <div className="ml-auto">
                    {dirty ? (
                        <button onClick={handleSave}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#00A868] text-white shadow-lg shadow-[#00A868]/20 hover:bg-[#008f58] animate-pulse transition-all">
                            <Check className="w-3.5 h-3.5" /> Salvar
                        </button>
                    ) : saved ? (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#00A868]/15 text-[#00A868]">
                            <Check className="w-3.5 h-3.5" /> Salvo!
                        </span>
                    ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══ LIST COLUMN ═══ */
function ListColumn({ list, users, onAdd, onToggle, onStar, onDelete, onSchedule, onAssign, onOpenDetail, onDeleteList, onRenameList, onClearCompleted, isSpecialView, onOpenAddTask }: {
    list: { id: string; name: string; tasks: TaskData[] };
    users: UserOption[];
    onAdd: (title: string, date?: string, time?: string, assigneeId?: string, priority?: string, description?: string) => void;
    onToggle: (id: string) => void;
    onStar: (id: string) => void;
    onDelete: (id: string) => void;
    onSchedule: (t: TaskData) => void;
    onAssign: (id: string, assigneeId: string | null) => void;
    onOpenDetail: (t: TaskData) => void;
    onDeleteList?: () => void;
    onRenameList?: (newName: string) => void;
    onClearCompleted?: () => void;
    isSpecialView?: boolean;
    onOpenAddTask?: () => void;
}) {
    const [showMenu, setShowMenu] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [renaming, setRenaming] = useState(false);
    const [renameName, setRenameName] = useState(list.name);

    const pending = list.tasks.filter(t => !t.completed).sort((a, b) => {
        if (a.starred !== b.starred) return Number(b.starred) - Number(a.starred);
        const priOrder = { high: 0, medium: 1, low: 2 };
        const pa = priOrder[a.priority as keyof typeof priOrder] ?? 1;
        const pb = priOrder[b.priority as keyof typeof priOrder] ?? 1;
        if (pa !== pb) return pa - pb;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const completed = list.tasks.filter(t => t.completed);

    return (
        <div className="w-72 shrink-0 card-elevated flex flex-col max-h-[calc(100vh-180px)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
                {renaming ? (
                    <input value={renameName} onChange={e => setRenameName(e.target.value)} autoFocus
                        onBlur={() => { if (renameName.trim() && renameName !== list.name && onRenameList) onRenameList(renameName.trim()); setRenaming(false); }}
                        onKeyDown={e => { if (e.key === "Enter") { if (renameName.trim() && renameName !== list.name && onRenameList) onRenameList(renameName.trim()); setRenaming(false); } if (e.key === "Escape") { setRenameName(list.name); setRenaming(false); } }}
                        className="flex-1 text-sm font-bold text-foreground bg-transparent border-b-2 border-[#00A868] focus:outline-none mr-2" />
                ) : (
                    <h3 className="text-sm font-bold text-foreground truncate">{list.name}</h3>
                )}
                <span className="text-[10px] text-muted-foreground mr-auto ml-2">{pending.length}</span>
                {!isSpecialView && (
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                        {showMenu && (<>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 top-8 z-20 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[200px]">
                                {onRenameList && (
                                    <button onClick={() => { setRenaming(true); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Renomear lista
                                    </button>
                                )}
                                <button onClick={() => { navigator.clipboard.writeText(pending.map(t => `- ${t.title}`).join("\n")); setShowMenu(false); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Copiar tarefas
                                </button>
                                {completed.length > 0 && (
                                    <button onClick={() => { if (onClearCompleted) onClearCompleted(); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                                        <Check className="w-3.5 h-3.5 text-muted-foreground" /> Limpar concluídas
                                    </button>
                                )}
                                <div className="h-px bg-border my-1" />
                                {onDeleteList && (
                                    <button onClick={() => { onDeleteList(); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" /> Excluir lista
                                    </button>
                                )}
                            </div>
                        </>)}
                    </div>
                )}
            </div>

            {/* Add Task */}
            <div className="px-3 pt-3 pb-1 shrink-0">
                {!isSpecialView && onOpenAddTask ? (
                    <button onClick={onOpenAddTask} className="w-full flex items-center gap-2 text-sm text-[#00A868] hover:text-[#008f58] py-1"><Plus className="w-4 h-4" /> Adicionar uma tarefa</button>
                ) : null}
            </div>

            {/* Tasks */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                {pending.map(task => {
                    const pri = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                    return (
                    <div key={task.id} className="group flex items-start gap-2 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors relative cursor-pointer"
                        onClick={() => onOpenDetail(task)}>
                        <button onClick={(e) => { e.stopPropagation(); onToggle(task.id); }} className="shrink-0 mt-0.5 text-muted-foreground hover:text-[#00A868]"><Circle className="w-[18px] h-[18px]" /></button>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-snug">{task.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {/* Priority badge */}
                                {task.priority && task.priority !== "medium" && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${pri.bg} ${pri.color}`}>{pri.label}</span>
                                )}
                                {task.date && (
                                    <span className={`text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium ${isOverdue(task.date) ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>
                                        <Calendar className="w-3 h-3" /> {friendlyDate(task.date)}{task.time && <> · {task.time}</>}
                                    </span>
                                )}
                                {task.assignee ? (
                                    <span className="text-[10px] bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5">
                                        <UserPlus className="w-3 h-3" /> {task.assignee.name.split(" ")[0]}
                                    </span>
                                ) : null}
                                {task.description && (
                                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                        <MessageSquare className="w-3 h-3" />
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); onStar(task.id); }} className={`p-1 rounded-md ${task.starred ? "text-amber-500 opacity-100" : "text-muted-foreground hover:text-amber-500"}`}>
                                <Star className={`w-3.5 h-3.5 ${task.starred ? "fill-amber-500" : ""}`} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onSchedule(task); }} className="p-1 rounded-md text-muted-foreground hover:text-[#00A868]" title="Google Calendar"><ExternalLink className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="p-1 rounded-md text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        {task.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-500 absolute right-2 top-2 group-hover:hidden" />}
                    </div>
                    );
                })}

                {pending.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40"><CheckSquare className="w-10 h-10 mb-2" /><p className="text-xs">Não há tarefas</p></div>
                )}

                {completed.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                        <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCompleted ? "" : "-rotate-90"}`} /> Concluída ({completed.length})
                        </button>
                        {showCompleted && <div className="space-y-0.5 mt-1">{completed.map(task => (
                            <div key={task.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted/40 opacity-50 cursor-pointer"
                                onClick={() => onOpenDetail(task)}>
                                <button onClick={(e) => { e.stopPropagation(); onToggle(task.id); }} className="shrink-0 text-[#00A868]"><CheckCircle2 className="w-[18px] h-[18px]" /></button>
                                <span className="text-sm text-muted-foreground line-through truncate flex-1">{task.title}</span>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}</div>}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ═══ ADD TASK MODAL — Premium Redesigned ═══ */
const RECURRENCE_OPTIONS = [
    { value: "none", label: "Não se repete" },
    { value: "daily", label: "Diariamente" },
    { value: "weekly", label: "Semanalmente" },
    { value: "monthly", label: "Mensalmente" },
    { value: "yearly", label: "Anualmente" },
];

function AddTaskModal({ lists, users, defaultListId, defaultDate, defaultTime, onSave, onClose }: {
    lists: TaskListData[];
    users: UserOption[];
    defaultListId: string;
    defaultDate: string;
    defaultTime: string;
    onSave: (listId: string, title: string, date?: string, time?: string, assigneeId?: string, priority?: string, description?: string) => void;
    onClose: () => void;
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState(defaultDate);
    const [time, setTime] = useState(defaultTime);
    const [allDay, setAllDay] = useState(false);
    const [priority, setPriority] = useState("medium");
    const [assignee, setAssignee] = useState("");
    const [listId, setListId] = useState(defaultListId);
    const [recurrence, setRecurrence] = useState("none");
    const [showRecurrence, setShowRecurrence] = useState(false);
    const [showListPicker, setShowListPicker] = useState(false);
    const [showAssigneePicker, setShowAssigneePicker] = useState(false);

    // Sync props → state when modal re-opens with new defaults
    useEffect(() => { setDate(defaultDate); }, [defaultDate]);
    useEffect(() => { setTime(defaultTime); }, [defaultTime]);
    useEffect(() => { setListId(defaultListId); }, [defaultListId]);

    const handleSave = () => {
        if (!title.trim() || !listId) return;
        onSave(listId, title.trim(), date || undefined, allDay ? undefined : time || undefined, assignee || undefined, priority, description || undefined);
    };

    const priorities = [
        { value: "low", label: "Baixa", color: "text-[#00A868]", bg: "bg-[#00A868]/10", border: "border-[#00A868]/30", activeBg: "bg-[#00A868]", activeText: "text-white" },
        { value: "medium", label: "Média", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", activeBg: "bg-amber-500", activeText: "text-white" },
        { value: "high", label: "Alta", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", activeBg: "bg-red-500", activeText: "text-white" },
    ];

    const selectedList = lists.find(l => l.id === listId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col card-elevated shadow-2xl rounded-2xl animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#00A868] flex items-center justify-center text-white shadow-lg shadow-[#00A868]/20">
                            <Plus className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">Nova Tarefa</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
                    {/* Title */}
                    <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                        onKeyDown={e => { if (e.key === "Enter" && title.trim()) handleSave(); }}
                        placeholder="O que precisa ser feito?"
                        className="w-full text-lg font-medium text-foreground bg-transparent border-b-2 border-border focus:border-[#00A868] focus:outline-none pb-2 placeholder-muted-foreground/50 transition-colors" />

                    {/* ── Date & Time ── */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quando</label>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => (document.getElementById('addtask-date') as HTMLInputElement)?.showPicker?.()}
                                className="relative flex items-center gap-2 flex-1 min-w-[160px] px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:border-[#00A868]/50 transition-colors cursor-pointer">
                                <CalendarDays className="w-4 h-4 text-[#00A868] shrink-0" />
                                <span>{date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Selecionar data"}</span>
                                <input id="addtask-date" type="date" value={date} onChange={e => setDate(e.target.value)}
                                    className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" />
                            </button>
                            {!allDay && (
                                <button onClick={() => (document.getElementById('addtask-time') as HTMLInputElement)?.showPicker?.()}
                                    className="relative flex items-center gap-2 min-w-[120px] px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:border-[#00A868]/50 transition-colors cursor-pointer">
                                    <Clock className="w-4 h-4 text-[#00A868] shrink-0" />
                                    <span>{time || "Horário"}</span>
                                    <input id="addtask-time" type="time" value={time} onChange={e => setTime(e.target.value)}
                                        className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" />
                                </button>
                            )}
                            <button onClick={() => setAllDay(!allDay)}
                                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${allDay ? "bg-[#00A868] text-white border-[#00A868] shadow-lg shadow-[#00A868]/20" : "bg-muted/50 text-muted-foreground border-border hover:border-[#00A868]/50"}`}>
                                <Sun className="w-3.5 h-3.5" />
                                Dia todo
                            </button>
                        </div>
                    </div>

                    {/* ── Recurrence ── */}
                    <div className="relative">
                        <button onClick={() => setShowRecurrence(!showRecurrence)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all w-full justify-between ${recurrence !== "none" ? "bg-purple-500/10 text-purple-500 border-purple-500/30" : "bg-muted/50 text-muted-foreground border-border hover:border-[#00A868]/50"}`}>
                            <span className="flex items-center gap-1.5">
                                <Repeat className="w-3.5 h-3.5" />
                                {RECURRENCE_OPTIONS.find(r => r.value === recurrence)?.label || "Não se repete"}
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRecurrence ? "rotate-180" : ""}`} />
                        </button>
                        {showRecurrence && (<>
                            <div className="fixed inset-0 z-10" onClick={() => setShowRecurrence(false)} />
                            <div className="absolute left-0 top-11 z-20 w-full bg-popover border border-border rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                {RECURRENCE_OPTIONS.map(opt => (
                                    <button key={opt.value} onClick={() => { setRecurrence(opt.value); setShowRecurrence(false); }}
                                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${recurrence === opt.value ? "text-[#00A868] font-bold bg-[#00A868]/5" : "text-foreground hover:bg-muted"}`}>
                                        {recurrence === opt.value && <Check className="w-3.5 h-3.5" />}
                                        <span className={recurrence === opt.value ? "" : "ml-5"}>{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </>)}
                    </div>

                    {/* ── Priority Pills ── */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prioridade</label>
                        <div className="flex gap-2">
                            {priorities.map(p => (
                                <button key={p.value} onClick={() => setPriority(p.value)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${priority === p.value
                                        ? `${p.activeBg} ${p.activeText} border-transparent shadow-lg`
                                        : `${p.bg} ${p.color} ${p.border} hover:opacity-80`}`}>
                                    <Flag className="w-3.5 h-3.5" />
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── List Picker (Custom Dropdown) ── */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lista</label>
                        <div className="relative">
                            <button onClick={() => setShowListPicker(!showListPicker)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:border-[#00A868]/50 transition-colors">
                                <ListTodo className="w-4 h-4 text-[#00A868] shrink-0" />
                                <span className="flex-1 text-left truncate">{selectedList?.name || "Selecionar lista"}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showListPicker ? "rotate-180" : ""}`} />
                            </button>
                            {showListPicker && (<>
                                <div className="fixed inset-0 z-10" onClick={() => setShowListPicker(false)} />
                                <div className="absolute left-0 top-11 z-20 w-full bg-popover border border-border rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150 max-h-48 overflow-y-auto">
                                    {lists.map(l => (
                                        <button key={l.id} onClick={() => { setListId(l.id); setShowListPicker(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${listId === l.id ? "text-[#00A868] font-bold bg-[#00A868]/5" : "text-foreground hover:bg-muted"}`}>
                                            {listId === l.id && <Check className="w-3.5 h-3.5" />}
                                            <span className={listId === l.id ? "" : "ml-5"}>{l.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </>)}
                        </div>
                    </div>

                    {/* ── Assignee (Custom Dropdown) ── */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Responsável</label>
                        <div className="relative">
                            <button onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:border-[#00A868]/50 transition-colors">
                                <UserPlus className="w-4 h-4 text-[#00A868] shrink-0" />
                                <span className="flex-1 text-left truncate">{assignee ? users.find(u => u.id === assignee)?.name || "Responsável" : "Sem responsável"}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showAssigneePicker ? "rotate-180" : ""}`} />
                            </button>
                            {showAssigneePicker && (<>
                                <div className="fixed inset-0 z-10" onClick={() => setShowAssigneePicker(false)} />
                                <div className="absolute left-0 top-11 z-20 w-full bg-popover border border-border rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150 max-h-48 overflow-y-auto">
                                    <button onClick={() => { setAssignee(""); setShowAssigneePicker(false); }}
                                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${!assignee ? "text-[#00A868] font-bold bg-[#00A868]/5" : "text-foreground hover:bg-muted"}`}>
                                        {!assignee && <Check className="w-3.5 h-3.5" />}
                                        <span className={!assignee ? "" : "ml-5"}>Sem responsável</span>
                                    </button>
                                    {users.map(u => (
                                        <button key={u.id} onClick={() => { setAssignee(u.id); setShowAssigneePicker(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${assignee === u.id ? "text-[#00A868] font-bold bg-[#00A868]/5" : "text-foreground hover:bg-muted"}`}>
                                            {assignee === u.id && <Check className="w-3.5 h-3.5" />}
                                            <span className={assignee === u.id ? "" : "ml-5"}>{u.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </>)}
                        </div>
                    </div>

                    {/* ── Description ── */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)}
                            rows={3} placeholder="Adicionar detalhes, notas..."
                            className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50 resize-none" />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>{selectedList?.name || "Selecione uma lista"}</span>
                        {recurrence !== "none" && (
                            <span className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-500 font-medium">
                                <Repeat className="w-3 h-3" />
                                {RECURRENCE_OPTIONS.find(r => r.value === recurrence)?.label}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleSave} disabled={!title.trim() || !listId}
                            className="px-5 py-2 text-sm font-bold bg-[#00A868] text-white rounded-xl hover:bg-[#008f58] disabled:opacity-30 transition-all shadow-lg shadow-[#00A868]/20 active:scale-95">
                            Criar Tarefa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
