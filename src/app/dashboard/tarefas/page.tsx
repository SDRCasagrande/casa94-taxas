"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    CheckSquare, Plus, Trash2, Circle, CheckCircle2, Calendar,
    Star, ChevronLeft, ChevronRight, ListTodo, CalendarDays,
    ExternalLink, MoreVertical, ChevronDown, Loader2, UserPlus,
    Pencil, SortAsc, Copy, Check, X, Users, MessageSquare,
    AlertTriangle, Flag, Clock, Columns3
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
    const [sidebarFilter, setSidebarFilter] = useState<"all" | "starred" | "assigned" | string>("all");
    const [detailTask, setDetailTask] = useState<TaskData | null>(null);
    const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
    const [gcalConnecting, setGcalConnecting] = useState(false);

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
    useEffect(() => {
        fetch("/api/google-calendar/status").then(r => r.json()).then(d => {
            setGcalConnected(d.connected === true);
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
                        <CheckSquare className="w-4 h-4 shrink-0" /> Minhas Tarefas
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
                                        onClearCompleted={() => { list.tasks.filter(t => t.completed).forEach(t => deleteTask(t.id)); }} />
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
                    <div className="flex-1 overflow-auto space-y-3">
                        {/* Google Calendar Connection Banner */}
                        {gcalConnected === false && (
                            <div className="card-elevated p-4 flex flex-col sm:flex-row items-center gap-3 border-l-4 border-[#4285F4]">
                                <div className="w-10 h-10 rounded-xl bg-[#4285F4]/10 flex items-center justify-center shrink-0">
                                    <CalendarDays className="w-5 h-5 text-[#4285F4]" />
                                </div>
                                <div className="flex-1 min-w-0 text-center sm:text-left">
                                    <p className="text-sm font-bold text-foreground">Conectar Google Calendar</p>
                                    <p className="text-[11px] text-muted-foreground">Sincronize tarefas com sua agenda Google — bidirecional, em tempo real.</p>
                                </div>
                                <button
                                    onClick={() => { setGcalConnecting(true); window.location.href = "/api/google-calendar/auth"; }}
                                    disabled={gcalConnecting}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#4285F4] text-white hover:bg-[#3367D6] shadow-lg shadow-[#4285F4]/20 transition-all active:scale-95 shrink-0 disabled:opacity-50"
                                >
                                    {gcalConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                    {gcalConnecting ? "Conectando..." : "Conectar Google"}
                                </button>
                            </div>
                        )}
                        {gcalConnected === true && (
                            <div className="card-elevated p-3 flex items-center gap-3 border-l-4 border-[#00A868]">
                                <div className="w-8 h-8 rounded-lg bg-[#00A868]/10 flex items-center justify-center shrink-0">
                                    <CalendarDays className="w-4 h-4 text-[#00A868]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-[#00A868] flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A868] animate-pulse" />
                                        Google Calendar conectado
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="card-elevated overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                                <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} className="p-1.5 rounded-lg hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
                                <span className="text-sm font-bold text-foreground capitalize">{monthLabel}</span>
                                <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} className="p-1.5 rounded-lg hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase text-muted-foreground border-b border-border">
                                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => <div key={d} className="py-2">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7">
                                {calDays.map((cell, i) => {
                                    const isToday = cell.date === today();
                                    const totalItems = cell.tasks.length + (cell.gcalEvents?.length || 0);
                                    return (
                                        <div key={i} className={`min-h-[80px] border-b border-r border-border p-1.5 ${cell.day === 0 ? "bg-muted/10" : isToday ? "bg-[#00A868]/5" : ""}`}>
                                            {cell.day > 0 && (<>
                                                <span className={`text-xs font-bold ${isToday ? "bg-[#00A868] text-white w-6 h-6 rounded-full inline-flex items-center justify-center" : "text-foreground"}`}>{cell.day}</span>
                                                <div className="space-y-0.5 mt-1">
                                                    {cell.tasks.slice(0, 3).map(t => (
                                                        <div key={t.id} onClick={() => setDetailTask(t)} className={`text-[10px] truncate px-1.5 py-0.5 rounded-md font-medium cursor-pointer hover:opacity-80 ${t.starred ? "bg-amber-500/15 text-amber-600" : "bg-[#00A868]/10 text-[#00A868]"}`}>
                                                            {t.time && <span className="font-bold">{t.time} </span>}{t.title}
                                                        </div>
                                                    ))}
                                                    {cell.gcalEvents?.slice(0, Math.max(0, 3 - cell.tasks.length)).map(e => (
                                                        <div key={e.id} onClick={() => window.open(e.htmlLink, "_blank")}
                                                            className="text-[10px] truncate px-1.5 py-0.5 rounded-md font-medium cursor-pointer hover:opacity-80 bg-[#4285F4]/10 text-[#4285F4]">
                                                            {e.time && <span className="font-bold">{e.time} </span>}{e.title}
                                                        </div>
                                                    ))}
                                                    {totalItems > 3 && <span className="text-[10px] text-muted-foreground px-1">+{totalItems - 3}</span>}
                                                </div>
                                            </>)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

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
        fetch(`/api/tasks/${task.id}/comments`).then(r => r.json()).then(d => {
            if (Array.isArray(d)) setComments(d);
        }).catch(() => {}).finally(() => setLoadingComments(false));
    }, [task.id]);

    const addComment = async () => {
        if (!newComment.trim()) return;
        try {
            const res = await fetch(`/api/tasks/${task.id}/comments`, {
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
                fetch(`/api/tasks/${task.id}/comments`).then(r => r.json()).then(d => {
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
                        <h2 onClick={() => setEditingTitle(true)} className={`text-lg font-bold cursor-pointer hover:text-[#00A868] transition-colors ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{title || task.title}</h2>
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
                            <input type="date" value={date} onChange={e => { setDate(e.target.value); markDirty(); }}
                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark]" />
                        </div>

                        {/* Time */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Horário</label>
                            <input type="time" value={time} onChange={e => { setTime(e.target.value); markDirty(); }}
                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark]" />
                        </div>

                        {/* Deadline */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prazo</label>
                            <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); markDirty(); }}
                                className={`w-full px-3 py-2 bg-muted/50 border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark] ${
                                    dueDate && new Date(dueDate + 'T23:59:59') < new Date() ? 'border-red-500/50 text-red-400' : 'border-border'
                                }`} />
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
function ListColumn({ list, users, onAdd, onToggle, onStar, onDelete, onSchedule, onAssign, onOpenDetail, onDeleteList, onRenameList, onClearCompleted, isSpecialView }: {
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
}) {
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newDate, setNewDate] = useState("");
    const [newTime, setNewTime] = useState("");
    const [newAssignee, setNewAssignee] = useState("");
    const [newPriority, setNewPriority] = useState("medium");
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

    const handleAdd = () => {
        if (!newTitle.trim()) return;
        onAdd(newTitle.trim(), newDate, newTime, newAssignee || undefined, newPriority, newDesc || undefined);
        setNewTitle(""); setNewDesc(""); setNewDate(""); setNewTime(""); setNewAssignee(""); setNewPriority("medium");
        setAdding(false);
    };

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
                {!isSpecialView ? (
                    <button onClick={() => setAdding(true)} className="w-full flex items-center gap-2 text-sm text-[#00A868] hover:text-[#008f58] py-1"><Plus className="w-4 h-4" /> Adicionar uma tarefa</button>
                ) : null}
            </div>

            {/* Add Task Modal — Google Tasks Style */}
            {adding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAdding(false)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative w-full max-w-md card-elevated shadow-2xl rounded-2xl animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
                        {/* Close button */}
                        <button onClick={() => setAdding(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted text-muted-foreground z-10">
                            <X className="w-4 h-4" />
                        </button>

                        <div className="p-5 space-y-4">
                            {/* Title */}
                            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus
                                onKeyDown={e => { if (e.key === "Enter" && newTitle.trim()) handleAdd(); }}
                                placeholder="Adicionar título"
                                className="w-full text-lg font-medium text-foreground bg-transparent border-b-2 border-border focus:border-[#00A868] focus:outline-none pb-2 placeholder-muted-foreground/50 transition-colors" />

                            {/* Date & Time row */}
                            <div className="flex items-center gap-3">
                                <div className="text-muted-foreground"><Clock className="w-4 h-4" /></div>
                                <div className="flex gap-2 flex-1">
                                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                                        className="px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark]" />
                                    <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                                        className="px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark]" />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="flex items-start gap-3">
                                <div className="text-muted-foreground mt-2"><MessageSquare className="w-4 h-4" /></div>
                                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
                                    rows={3} placeholder="Adicionar uma descrição"
                                    className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50 resize-none" />
                            </div>

                            {/* Assignee & Priority row */}
                            <div className="flex gap-2">
                                <div className="flex items-center gap-2 flex-1">
                                    <UserPlus className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <select value={newAssignee} onChange={e => setNewAssignee(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none">
                                        <option value="">Sem responsável</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
                                    className="px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none">
                                    <option value="high">🔴 Alta</option>
                                    <option value="medium">🟡 Média</option>
                                    <option value="low">🔵 Baixa</option>
                                </select>
                            </div>

                            {/* List indicator */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                                <ListTodo className="w-3.5 h-3.5" />
                                <span>{list.name}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
                            <button onClick={() => { setAdding(false); setNewTitle(""); setNewDesc(""); }}
                                className="px-4 py-2 text-sm font-medium text-[#00A868] hover:bg-muted rounded-xl transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleAdd} disabled={!newTitle.trim()}
                                className="px-5 py-2 text-sm font-bold bg-[#00A868] text-white rounded-xl hover:bg-[#008f58] disabled:opacity-30 transition-all shadow-lg shadow-[#00A868]/20">
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

                {pending.length === 0 && !adding && (
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
