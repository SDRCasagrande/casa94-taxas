"use client";

import { useState, useEffect, useMemo } from "react";
import {
    CheckSquare, Plus, Trash2, Circle, CheckCircle2, Calendar,
    Star, ChevronLeft, ChevronRight, Clock, ListTodo, CalendarDays,
    ExternalLink, MoreVertical, ChevronDown, X, Pencil
} from "lucide-react";

interface Task {
    id: string;
    title: string;
    completed: boolean;
    date: string;
    time: string;
    starred: boolean;
    list: string;
    scheduled: boolean;
    createdAt: number;
}

const STORAGE_KEY = "bitkaiser_tasks_v2";
const LISTS_KEY = "bitkaiser_task_lists";

function today() { return new Date().toISOString().split("T")[0]; }
function friendlyDate(d: string) {
    if (!d) return "";
    const t = new Date();
    const todayStr = t.toISOString().split("T")[0];
    t.setDate(t.getDate() + 1);
    const tomorrowStr = t.toISOString().split("T")[0];
    if (d === todayStr) return "Hoje";
    if (d === tomorrowStr) return "Amanhã";
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}
function isOverdue(d: string) {
    if (!d) return false;
    return d < today();
}

export default function TarefasPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [lists, setLists] = useState<string[]>(["As minhas tarefas"]);
    const [view, setView] = useState<"board" | "calendar">("board");
    const [showNewList, setShowNewList] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [sidebarFilter, setSidebarFilter] = useState<"all" | "starred">("all");

    useEffect(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            if (s) setTasks(JSON.parse(s));
            const l = localStorage.getItem(LISTS_KEY);
            if (l) setLists(JSON.parse(l));
        } catch { /* */ }
    }, []);

    useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch { /* */ } }, [tasks]);
    useEffect(() => { try { localStorage.setItem(LISTS_KEY, JSON.stringify(lists)); } catch { /* */ } }, [lists]);

    const addTask = (listName: string, title: string, date?: string, time?: string) => {
        if (!title.trim()) return;
        setTasks(prev => [...prev, {
            id: crypto.randomUUID(), title: title.trim(), completed: false,
            date: date || "", time: time || "", starred: false, list: listName,
            scheduled: false, createdAt: Date.now(),
        }]);
    };

    const toggleTask = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    const toggleStar = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t));
    const deleteTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));
    const updateTaskDate = (id: string, date: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, date } : t));

    const scheduleToCalendar = (task: Task) => {
        const title = encodeURIComponent(task.title);
        let url = `https://calendar.google.com/calendar/r/eventedit?text=${title}&details=${encodeURIComponent("Tarefa BitKaiser")}`;
        if (task.date) {
            const d = task.date.replace(/-/g, "");
            if (task.time) { const t = task.time.replace(":", "") + "00"; url += `&dates=${d}T${t}/${d}T${t}`; }
            else url += `&dates=${d}/${d}`;
        }
        window.open(url, "_blank");
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, scheduled: true } : t));
    };

    const addList = () => {
        if (!newListName.trim() || lists.includes(newListName.trim())) return;
        setLists(prev => [...prev, newListName.trim()]);
        setNewListName(""); setShowNewList(false);
    };

    const deleteList = (name: string) => {
        if (lists.length <= 1) return;
        if (!confirm(`Excluir a lista "${name}" e todas as suas tarefas?`)) return;
        setLists(prev => prev.filter(l => l !== name));
        setTasks(prev => prev.filter(t => t.list !== name));
    };

    const filteredTasks = useMemo(() => {
        if (sidebarFilter === "starred") return tasks.filter(t => t.starred);
        return tasks;
    }, [tasks, sidebarFilter]);

    const totalPending = tasks.filter(t => !t.completed).length;
    const totalStarred = tasks.filter(t => t.starred && !t.completed).length;

    // Calendar
    const calDays = useMemo(() => {
        const first = new Date(calYear, calMonth, 1);
        const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
        const startDow = first.getDay();
        const days: { day: number; date: string; tasks: Task[] }[] = [];
        for (let i = 0; i < startDow; i++) days.push({ day: 0, date: "", tasks: [] });
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            days.push({ day: d, date: dateStr, tasks: tasks.filter(t => t.date === dateStr && !t.completed) });
        }
        return days;
    }, [calMonth, calYear, tasks]);
    const monthLabel = new Date(calYear, calMonth).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    return (
        <div className="h-full flex flex-col">
            {/* ═══ Top Bar ═══ */}
            <div className="flex items-center justify-between px-1 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                        <CheckSquare className="w-4.5 h-4.5" />
                    </div>
                    <h1 className="text-lg font-bold text-foreground">Tarefas</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setView("board")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === "board" ? "bg-blue-500/10 text-blue-500" : "text-muted-foreground hover:bg-muted"}`}>
                        <ListTodo className="w-3.5 h-3.5" /> Board
                    </button>
                    <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === "calendar" ? "bg-blue-500/10 text-blue-500" : "text-muted-foreground hover:bg-muted"}`}>
                        <CalendarDays className="w-3.5 h-3.5" /> Calendário
                    </button>
                </div>
            </div>

            <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
                {/* ═══ Left Sidebar ═══ */}
                <div className="w-48 shrink-0 hidden lg:flex flex-col gap-1">
                    <button onClick={() => setSidebarFilter("all")}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${sidebarFilter === "all" ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                        <CheckSquare className="w-4 h-4" /> Todas as tarefas
                        {totalPending > 0 && <span className="ml-auto text-[10px] opacity-70">{totalPending}</span>}
                    </button>
                    <button onClick={() => setSidebarFilter("starred")}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${sidebarFilter === "starred" ? "bg-amber-500/20 text-amber-500" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                        <Star className="w-4 h-4" /> Com estrela
                        {totalStarred > 0 && <span className="ml-auto text-[10px] opacity-70">{totalStarred}</span>}
                    </button>

                    <div className="mt-4 mb-1 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3">Listas</span>
                    </div>
                    {lists.map(l => (
                        <div key={l} className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate flex-1">{l}</span>
                            <span className="text-[10px] opacity-50">{tasks.filter(t => t.list === l && !t.completed).length}</span>
                        </div>
                    ))}
                    {showNewList ? (
                        <div className="px-1 mt-1 flex gap-1">
                            <input value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === "Enter" && addList()} autoFocus placeholder="Nome..."
                                className="flex-1 px-2 py-1 bg-muted/50 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-blue-500/50 min-w-0" />
                            <button onClick={addList} className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs">OK</button>
                        </div>
                    ) : (
                        <button onClick={() => setShowNewList(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Criar nova lista
                        </button>
                    )}
                </div>

                {/* ═══ Main Area ═══ */}
                {view === "board" ? (
                    <div className="flex-1 overflow-x-auto">
                        <div className="flex gap-4 min-h-full pb-4" style={{ minWidth: `${lists.length * 320}px` }}>
                            {(sidebarFilter === "starred" ? ["Com estrela"] : lists).map(listName => (
                                <ListColumn
                                    key={listName}
                                    name={listName}
                                    tasks={sidebarFilter === "starred"
                                        ? filteredTasks.filter(t => !t.completed).sort((a, b) => b.createdAt - a.createdAt)
                                        : filteredTasks.filter(t => t.list === listName)
                                    }
                                    onAdd={(title, date, time) => addTask(listName, title, date, time)}
                                    onToggle={toggleTask}
                                    onStar={toggleStar}
                                    onDelete={deleteTask}
                                    onSchedule={scheduleToCalendar}
                                    onUpdateDate={updateTaskDate}
                                    onDeleteList={lists.length > 1 ? () => deleteList(listName) : undefined}
                                    isStarredView={sidebarFilter === "starred"}
                                />
                            ))}
                            {/* Add list column (mobile + desktop) */}
                            {sidebarFilter === "all" && (
                                <div className="w-72 shrink-0">
                                    {showNewList ? (
                                        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
                                            <input value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === "Enter" && addList()} autoFocus placeholder="Nome da lista..."
                                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-blue-500/50" />
                                            <div className="flex gap-2">
                                                <button onClick={addList} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium">Criar</button>
                                                <button onClick={() => { setShowNewList(false); setNewListName(""); }} className="px-4 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm">Cancelar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowNewList(true)}
                                            className="w-full flex items-center gap-2 px-4 py-3 bg-card/50 border border-dashed border-border rounded-2xl text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-card transition-all">
                                            <Plus className="w-4 h-4" /> Nova lista
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ═══ CALENDAR VIEW ═══ */
                    <div className="flex-1 overflow-auto">
                        <div className="bg-card border border-border rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                                <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}
                                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                                <span className="text-sm font-bold text-foreground capitalize">{monthLabel}</span>
                                <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
                                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase text-muted-foreground border-b border-border">
                                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => <div key={d} className="py-2">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7">
                                {calDays.map((cell, i) => {
                                    const isToday = cell.date === today();
                                    return (
                                        <div key={i} className={`min-h-[80px] border-b border-r border-border p-1.5 ${cell.day === 0 ? "bg-muted/10" : isToday ? "bg-blue-500/5" : ""}`}>
                                            {cell.day > 0 && (
                                                <>
                                                    <span className={`text-xs font-bold inline-block ${isToday ? "bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center" : "text-foreground"}`}>{cell.day}</span>
                                                    <div className="space-y-0.5 mt-1">
                                                        {cell.tasks.slice(0, 3).map(t => (
                                                            <div key={t.id} className={`text-[9px] truncate px-1.5 py-0.5 rounded-md font-medium ${t.starred ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
                                                                {t.time && <span className="font-bold">{t.time} </span>}{t.title}
                                                            </div>
                                                        ))}
                                                        {cell.tasks.length > 3 && <span className="text-[9px] text-muted-foreground px-1">+{cell.tasks.length - 3}</span>}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   LIST COLUMN — Google Tasks style card
   ═══════════════════════════════════════════════════ */
function ListColumn({ name, tasks, onAdd, onToggle, onStar, onDelete, onSchedule, onUpdateDate, onDeleteList, isStarredView }: {
    name: string;
    tasks: Task[];
    onAdd: (title: string, date?: string, time?: string) => void;
    onToggle: (id: string) => void;
    onStar: (id: string) => void;
    onDelete: (id: string) => void;
    onSchedule: (t: Task) => void;
    onUpdateDate: (id: string, date: string) => void;
    onDeleteList?: () => void;
    isStarredView?: boolean;
}) {
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDate, setNewDate] = useState("");
    const [newTime, setNewTime] = useState("");
    const [showMenu, setShowMenu] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const pending = tasks.filter(t => !t.completed).sort((a, b) => {
        if (a.starred !== b.starred) return Number(b.starred) - Number(a.starred);
        return a.createdAt - b.createdAt;
    });
    const completed = tasks.filter(t => t.completed);

    const handleAdd = () => {
        if (!newTitle.trim()) return;
        onAdd(newTitle.trim(), newDate, newTime);
        setNewTitle(""); setNewDate(""); setNewTime("");
        // Keep adding mode open for rapid entry
    };

    return (
        <div className="w-72 shrink-0 bg-card border border-border rounded-2xl flex flex-col max-h-[calc(100vh-180px)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
                <h3 className="text-sm font-bold text-foreground truncate">{name}</h3>
                {!isStarredView && (
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                            <MoreVertical className="w-4 h-4" />
                        </button>
                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                <div className="absolute right-0 top-8 z-20 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
                                    {onDeleteList && (
                                        <button onClick={() => { onDeleteList(); setShowMenu(false); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" /> Excluir lista
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Inline Add Task */}
            <div className="px-3 pt-3 pb-1 shrink-0">
                {adding ? (
                    <div className="space-y-2 mb-2">
                        <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setNewTitle(""); } }}
                            autoFocus placeholder="Título da tarefa..."
                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-blue-500/50" />
                        <div className="flex gap-1.5">
                            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                                className="flex-1 px-2 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-blue-500/50" />
                            <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                                className="w-20 px-2 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-blue-500/50" />
                        </div>
                        <div className="flex gap-1.5">
                            <button onClick={handleAdd} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors">Adicionar</button>
                            <button onClick={() => { setAdding(false); setNewTitle(""); setNewDate(""); setNewTime(""); }}
                                className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs hover:bg-muted/80 transition-colors">Cancelar</button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setAdding(true)}
                        className="w-full flex items-center gap-2 text-sm text-blue-500 hover:text-blue-400 transition-colors py-1">
                        <Plus className="w-4 h-4" /> Adicionar uma tarefa
                    </button>
                )}
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                {pending.map(task => (
                    <div key={task.id} className="group flex items-start gap-2 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors relative">
                        <button onClick={() => onToggle(task.id)} className="shrink-0 mt-0.5 text-muted-foreground hover:text-blue-500 transition-colors">
                            <Circle className="w-[18px] h-[18px]" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-snug">{task.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {task.date && (
                                    <span className={`text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium ${
                                        isOverdue(task.date) ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"
                                    }`}>
                                        <Calendar className="w-3 h-3" /> {friendlyDate(task.date)}
                                        {task.time && <> · {task.time}</>}
                                    </span>
                                )}
                                {task.scheduled && (
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5">
                                        <CheckCircle2 className="w-3 h-3" /> Agendado
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onStar(task.id)} className={`p-1 rounded-md transition-colors ${task.starred ? "text-amber-500 opacity-100" : "text-muted-foreground hover:text-amber-500"}`}>
                                <Star className={`w-3.5 h-3.5 ${task.starred ? "fill-amber-500" : ""}`} />
                            </button>
                            <button onClick={() => onSchedule(task)} className="p-1 rounded-md text-muted-foreground hover:text-blue-500 transition-colors" title="Agendar no Google Calendar">
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => onDelete(task.id)} className="p-1 rounded-md text-muted-foreground hover:text-red-500 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {/* Star indicator - always visible when starred */}
                        {task.starred && (
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500 absolute right-2 top-2 group-hover:hidden" />
                        )}
                    </div>
                ))}

                {pending.length === 0 && !adding && (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
                        <CheckSquare className="w-10 h-10 mb-2" />
                        <p className="text-xs text-center">Não há tarefas</p>
                    </div>
                )}

                {/* Completed Section */}
                {completed.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                        <button onClick={() => setShowCompleted(!showCompleted)}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCompleted ? "" : "-rotate-90"}`} />
                            Concluída ({completed.length})
                        </button>
                        {showCompleted && (
                            <div className="space-y-0.5 mt-1">
                                {completed.map(task => (
                                    <div key={task.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted/40 transition-colors opacity-50">
                                        <button onClick={() => onToggle(task.id)} className="shrink-0 text-emerald-500">
                                            <CheckCircle2 className="w-[18px] h-[18px]" />
                                        </button>
                                        <span className="text-sm text-muted-foreground line-through truncate flex-1">{task.title}</span>
                                        <button onClick={() => onDelete(task.id)} className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
