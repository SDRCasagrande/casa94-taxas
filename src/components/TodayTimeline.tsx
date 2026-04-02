"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, CheckCircle2, ExternalLink, Circle, Calendar, Loader2, Sun } from "lucide-react";

interface TimelineTask {
    id: string; title: string; time: string; date: string; completed: boolean;
    priority: string; assignee?: { name: string } | null;
}
interface TimelineEvent {
    id: string; title: string; time: string; date: string;
    isGoogleEvent: boolean; isBitTask: boolean; htmlLink?: string;
}

function today() { return new Date().toISOString().split("T")[0]; }
function friendlyTime(t: string) {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hh = parseInt(h);
    return `${hh > 12 ? hh - 12 : hh}:${m}${hh >= 12 ? "pm" : "am"}`;
}

export default function TodayTimeline() {
    const [tasks, setTasks] = useState<TimelineTask[]>([]);
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());

    // Refresh "now" every minute
    useEffect(() => {
        const iv = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        const todayStr = today();
        Promise.all([
            fetch("/api/tasks").then(r => r.json()).catch(() => ({ lists: [] })),
            fetch(`/api/google-calendar/events?timeMin=${todayStr}&timeMax=${todayStr}`).then(r => r.json()).catch(() => ({ events: [] })),
        ]).then(([tasksData, gcalData]) => {
            // Get today's tasks from all lists
            const allTasks: TimelineTask[] = [];
            if (tasksData.lists) {
                for (const list of tasksData.lists) {
                    for (const t of list.tasks) {
                        if (t.date === todayStr || (!t.date && !t.completed)) {
                            allTasks.push(t);
                        }
                    }
                }
            }
            // Add assigned tasks to me
            if (tasksData.assignedTasks) {
                for (const t of tasksData.assignedTasks) {
                    if ((t.date === todayStr || !t.date) && !allTasks.find(x => x.id === t.id)) {
                        allTasks.push(t);
                    }
                }
            }
            setTasks(allTasks);

            if (Array.isArray(gcalData?.events)) {
                setEvents(gcalData.events.filter((e: TimelineEvent) => !e.isBitTask));
            }
            setLoading(false);
        });
    }, []);

    const toggleTask = async (id: string, completed: boolean) => {
        try {
            await fetch(`/api/tasks/item/${id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completed: !completed }),
            });
            setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
        } catch { /* */ }
    };

    // Combine and sort by time
    const timeline = useMemo(() => {
        const items: { type: "task" | "event"; time: string; data: any }[] = [];
        tasks.forEach(t => items.push({ type: "task", time: t.time || "", data: t }));
        events.forEach(e => items.push({ type: "event", time: e.time || "", data: e }));
        // Sort: items with time first (by time), then items without time
        return items.sort((a, b) => {
            if (a.time && b.time) return a.time.localeCompare(b.time);
            if (a.time && !b.time) return -1;
            if (!a.time && b.time) return 1;
            return 0;
        });
    }, [tasks, events]);

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const pendingCount = tasks.filter(t => !t.completed).length;
    const doneCount = tasks.filter(t => t.completed).length;
    const greeting = currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";

    if (loading) {
        return (
            <div className="card-elevated rounded-2xl p-5 flex items-center justify-center h-48">
                <Loader2 className="w-5 h-5 animate-spin text-[#00A868]" />
            </div>
        );
    }

    return (
        <div className="card-elevated rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                            <Sun className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Hoje</h3>
                            <p className="text-[10px] text-muted-foreground">
                                {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-black text-foreground tabular-nums">
                            {String(currentHour).padStart(2, "0")}:{String(currentMinute).padStart(2, "0")}
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex gap-3 mt-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00A868]/10 text-[#00A868]">
                        <Circle className="w-3 h-3" />
                        <span className="text-[11px] font-bold">{pendingCount} pendente{pendingCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="text-[11px] font-bold">{doneCount} feita{doneCount !== 1 ? "s" : ""}</span>
                    </div>
                    {events.length > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[11px] font-bold">{events.length} evento{events.length !== 1 ? "s" : ""}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Timeline */}
            <div className="px-5 py-3 space-y-1 max-h-[400px] overflow-y-auto">
                {timeline.length === 0 ? (
                    <div className="py-8 text-center">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground/50">Dia livre!</p>
                        <p className="text-[10px] text-muted-foreground/30">{greeting}, nenhuma tarefa ou evento.</p>
                    </div>
                ) : (
                    timeline.map((item, i) => {
                        const isTask = item.type === "task";
                        const task = isTask ? item.data as TimelineTask : null;
                        const event = !isTask ? item.data as TimelineEvent : null;

                        // Check if "now" marker should go before this item
                        const showNowBefore = i === 0 || (item.time && item.time > `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`
                            && (i === 0 || !timeline[i - 1].time || timeline[i - 1].time <= `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`));

                        return (
                            <div key={`${item.type}-${isTask ? task!.id : event!.id}`}>
                                {showNowBefore && i === timeline.findIndex(t =>
                                    t.time > `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`) && (
                                    <div className="flex items-center gap-2 py-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500 now-dot" />
                                        <div className="flex-1 h-px bg-red-500/30" />
                                        <span className="text-[9px] text-red-500 font-bold">AGORA</span>
                                    </div>
                                )}

                                <div className={`flex items-start gap-3 px-2 py-2 rounded-xl transition-colors hover:bg-muted/30 group ${task?.completed ? "opacity-40" : ""}`}>
                                    {/* Time */}
                                    <div className="w-12 shrink-0 text-right">
                                        {item.time ? (
                                            <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                                                {friendlyTime(item.time)}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground/30">—</span>
                                        )}
                                    </div>

                                    {/* Dot / Toggle */}
                                    <div className="mt-1 shrink-0">
                                        {isTask ? (
                                            <button onClick={() => toggleTask(task!.id, task!.completed)} className="transition-transform hover:scale-110">
                                                {task!.completed ? (
                                                    <CheckCircle2 className="w-4 h-4 text-[#00A868]" />
                                                ) : (
                                                    <Circle className={`w-4 h-4 ${task!.priority === "high" ? "text-red-400" : task!.priority === "low" ? "text-[#00A868]/50" : "text-amber-400/60"}`} />
                                                )}
                                            </button>
                                        ) : (
                                            <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-medium leading-tight truncate ${task?.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                            {isTask ? task!.title : event!.title}
                                        </p>
                                        {!isTask && event!.htmlLink && (
                                            <a href={event!.htmlLink} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-0.5 text-[9px] text-blue-500 hover:text-blue-400 mt-0.5">
                                                <ExternalLink className="w-2.5 h-2.5" /> Google Calendar
                                            </a>
                                        )}
                                    </div>

                                    {/* Badge */}
                                    <div className="shrink-0">
                                        {isTask ? (
                                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${task!.priority === "high" ? "bg-red-500/10 text-red-500" : task!.priority === "low" ? "bg-[#00A868]/10 text-[#00A868]" : "bg-amber-500/10 text-amber-500"}`}>
                                                {task!.priority === "high" ? "Alta" : task!.priority === "low" ? "Baixa" : "Média"}
                                            </span>
                                        ) : (
                                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                                                GCal
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
