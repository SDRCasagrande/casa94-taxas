"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    DndContext, closestCenter, PointerSensor, TouchSensor, MouseSensor, KeyboardSensor, useSensor, useSensors,
    DragEndEvent, DragStartEvent, DragOverlay, useDroppable
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState, useMemo } from "react";
import {
    Circle, CheckCircle2, Star, Clock, Flag, GripVertical,
    Calendar, User as UserIcon, Users, Columns3, BarChart3
} from "lucide-react";
import { TaskData, UserOption, isOverdue, friendlyDate, initials } from "@/app/dashboard/tarefas/components/types";

interface KanbanBoardProps {
    tasks: TaskData[];
    users: UserOption[];
    currentUserId: string;
    onToggle: (taskId: string) => void;
    onUpdate: (taskId: string, data: Record<string, any>) => void;
    onSelect: (task: TaskData) => void;
}

const PRIORITY_COLUMNS = [
    { key: "high", label: "Alta Prioridade", color: "border-red-500/30", headerBg: "bg-red-500/10", headerText: "text-red-500", dot: "bg-red-500", emoji: "🔴" },
    { key: "medium", label: "Média Prioridade", color: "border-amber-500/30", headerBg: "bg-amber-500/10", headerText: "text-amber-500", dot: "bg-amber-500", emoji: "🟡" },
    { key: "low", label: "Baixa Prioridade", color: "border-[#00A868]/30", headerBg: "bg-[#00A868]/10", headerText: "text-[#00A868]", dot: "bg-[#00A868]", emoji: "🟢" },
];

const TEAM_COLORS = [
    { headerBg: "bg-blue-500/10", headerText: "text-blue-500", dot: "bg-blue-500", color: "border-blue-500/30" },
    { headerBg: "bg-purple-500/10", headerText: "text-purple-500", dot: "bg-purple-500", color: "border-purple-500/30" },
    { headerBg: "bg-amber-500/10", headerText: "text-amber-500", dot: "bg-amber-500", color: "border-amber-500/30" },
    { headerBg: "bg-pink-500/10", headerText: "text-pink-500", dot: "bg-pink-500", color: "border-pink-500/30" },
    { headerBg: "bg-cyan-500/10", headerText: "text-cyan-500", dot: "bg-cyan-500", color: "border-cyan-500/30" },
    { headerBg: "bg-indigo-500/10", headerText: "text-indigo-500", dot: "bg-indigo-500", color: "border-indigo-500/30" },
    { headerBg: "bg-[#00A868]/10", headerText: "text-[#00A868]", dot: "bg-[#00A868]", color: "border-[#00A868]/30" },
];

function SortableTask({ task, onToggle, onSelect, showAssignee = true, showPriority = false }: {
    task: TaskData; onToggle: (id: string) => void; onSelect: (t: TaskData) => void;
    showAssignee?: boolean; showPriority?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const overdue = isOverdue(task.date);
    const subtaskTotal = task.subtasks?.length || 0;
    const subtaskDone = task.subtasks?.filter(s => s.completed).length || 0;

    return (
        <div ref={setNodeRef} style={style}
            className={`group card-elevated rounded-xl p-3 cursor-pointer hover:shadow-md transition-all border ${task.completed ? "opacity-50" : ""} ${overdue ? "border-red-500/20" : "border-transparent hover:border-[#00A868]/20"}`}>
            <div className="flex items-start gap-2">
                <button {...attributes} {...listeners} className="mt-0.5 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
                    <GripVertical className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
                    className={`mt-0.5 shrink-0 ${task.completed ? "text-[#00A868]" : "text-muted-foreground hover:text-[#00A868]"} transition-colors`}>
                    {task.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0" onClick={() => onSelect(task)}>
                    <p className={`text-sm font-medium leading-tight ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {showPriority && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                task.priority === "high" ? "bg-red-500/10 text-red-500" :
                                task.priority === "low" ? "bg-[#00A868]/10 text-[#00A868]" :
                                "bg-amber-500/10 text-amber-500"
                            }`}>
                                <Flag className="w-2.5 h-2.5" /> {task.priority === "high" ? "Alta" : task.priority === "low" ? "Baixa" : "Média"}
                            </span>
                        )}
                        {task.date && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${overdue ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>
                                <Calendar className="w-2.5 h-2.5" /> {friendlyDate(task.date)}{task.time && ` ${task.time}`}
                            </span>
                        )}
                        {showAssignee && task.assignee && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                <UserIcon className="w-2.5 h-2.5" /> {task.assignee.name.split(" ")[0]}
                            </span>
                        )}
                        {subtaskTotal > 0 && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${subtaskDone === subtaskTotal ? "bg-[#00A868]/10 text-[#00A868]" : "bg-muted text-muted-foreground"}`}>
                                ✓ {subtaskDone}/{subtaskTotal}
                            </span>
                        )}
                    </div>
                </div>
                {task.starred && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 mt-0.5" />}
            </div>
        </div>
    );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div ref={setNodeRef} className={`transition-colors ${isOver ? "bg-[#00A868]/5" : ""}`}>
            {children}
        </div>
    );
}

export default function KanbanBoard({ tasks, users, currentUserId, onToggle, onUpdate, onSelect }: KanbanBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [mode, setMode] = useState<"priority" | "team">("priority");

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
        useSensor(KeyboardSensor)
    );

    const pendingTasks = tasks.filter(t => !t.completed);

    // ═══ PRIORITY MODE ═══
    const priorityColumnTasks: Record<string, TaskData[]> = {
        high: pendingTasks.filter(t => t.priority === "high"),
        medium: pendingTasks.filter(t => t.priority === "medium"),
        low: pendingTasks.filter(t => t.priority === "low"),
    };

    // ═══ TEAM MODE ═══
    const teamColumns = useMemo(() => {
        const cols: { key: string; label: string; tasks: TaskData[]; colorIdx: number }[] = [];

        // Current user first
        const myTasks = pendingTasks.filter(t => t.assigneeId === currentUserId || (!t.assigneeId && t.createdById === currentUserId));
        const currentUser = users.find(u => u.id === currentUserId);
        cols.push({ key: currentUserId, label: currentUser?.name?.split(" ")[0] || "Eu", tasks: myTasks, colorIdx: cols.length });

        // Other team members
        users.filter(u => u.id !== currentUserId).forEach(u => {
            const userTasks = pendingTasks.filter(t => t.assigneeId === u.id);
            if (userTasks.length > 0 || users.length <= 6) {
                cols.push({ key: u.id, label: u.name.split(" ")[0], tasks: userTasks, colorIdx: cols.length });
            }
        });

        // Unassigned
        const unassigned = pendingTasks.filter(t => !t.assigneeId && t.createdById !== currentUserId);
        if (unassigned.length > 0) {
            cols.push({ key: "unassigned", label: "Sem responsável", tasks: unassigned, colorIdx: cols.length });
        }

        return cols;
    }, [pendingTasks, users, currentUserId]);

    // ═══ WORKLOAD ═══
    const maxTasks = useMemo(() => Math.max(...teamColumns.map(c => c.tasks.length), 1), [teamColumns]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const taskId = active.id as string;
        const overId = over.id as string;

        if (mode === "priority") {
            // Check if dropped on a column header
            const targetColumn = PRIORITY_COLUMNS.find(c => c.key === overId);
            if (targetColumn) {
                const task = tasks.find(t => t.id === taskId);
                if (task && task.priority !== targetColumn.key) {
                    onUpdate(taskId, { priority: targetColumn.key });
                }
                return;
            }
            // Dropped on another task — inherit that task's priority
            const targetTask = tasks.find(t => t.id === overId);
            const sourceTask = tasks.find(t => t.id === taskId);
            if (targetTask && sourceTask && sourceTask.priority !== targetTask.priority) {
                onUpdate(taskId, { priority: targetTask.priority });
            }
        } else {
            // TEAM MODE — reassign
            // Check if dropped on column header (user id)
            const targetCol = teamColumns.find(c => c.key === overId);
            if (targetCol) {
                const newAssignee = targetCol.key === "unassigned" ? null : targetCol.key;
                onUpdate(taskId, { assigneeId: newAssignee });
                return;
            }
            // Dropped on another task — inherit that task's assignee
            const targetTask = tasks.find(t => t.id === overId);
            if (targetTask) {
                const newAssignee = targetTask.assigneeId;
                onUpdate(taskId, { assigneeId: newAssignee });
            }
        }
    };

    const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
    const completedCount = tasks.filter(t => t.completed).length;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mode Toggle + Workload Bar */}
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-1 bg-secondary/60 rounded-xl p-1">
                    <button onClick={() => setMode("priority")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "priority" ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:bg-muted"}`}>
                        <Columns3 className="w-3.5 h-3.5" /> Prioridade
                    </button>
                    <button onClick={() => setMode("team")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "team" ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:bg-muted"}`}>
                        <Users className="w-3.5 h-3.5" /> Equipe
                    </button>
                </div>

                {/* Workload mini bar (team mode) */}
                {mode === "team" && teamColumns.length > 1 && (
                    <div className="flex items-center gap-2 bg-secondary/40 rounded-xl px-3 py-2">
                        <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                        <div className="flex items-end gap-1">
                            {teamColumns.filter(c => c.key !== "unassigned").map((col, i) => {
                                const pct = (col.tasks.length / maxTasks) * 100;
                                const load = col.tasks.length;
                                const colorCls = load >= 8 ? "bg-red-500" : load >= 5 ? "bg-amber-500" : "bg-[#00A868]";
                                return (
                                    <div key={col.key} className="flex flex-col items-center gap-0.5" title={`${col.label}: ${load} tarefas`}>
                                        <div className="w-4 bg-muted rounded-full overflow-hidden" style={{ height: 24 }}>
                                            <div className={`w-full rounded-full transition-all duration-500 ${colorCls}`}
                                                style={{ height: `${Math.max(pct, 8)}%`, marginTop: `${100 - Math.max(pct, 8)}%` }} />
                                        </div>
                                        <span className="text-[8px] text-muted-foreground font-bold">{col.label.charAt(0)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-x-auto lg:overflow-x-auto">
                    <div className="flex flex-col lg:flex-row gap-3 lg:min-w-[768px] h-full">
                        {mode === "priority" ? (
                            /* ═══ PRIORITY COLUMNS ═══ */
                            PRIORITY_COLUMNS.map(col => {
                                const colTasks = priorityColumnTasks[col.key] || [];
                                return (
                                    <div key={col.key} className={`flex-1 rounded-2xl border ${col.color} bg-muted/20 flex flex-col min-w-[240px]`}>
                                        <DroppableColumn id={col.key}>
                                            <div className={`flex items-center justify-between px-4 py-3 rounded-t-2xl ${col.headerBg}`}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                                                    <h3 className={`text-xs font-bold uppercase tracking-wider ${col.headerText}`}>{col.label}</h3>
                                                </div>
                                                <span className={`text-xs font-black ${col.headerText}`}>{colTasks.length}</span>
                                            </div>
                                        </DroppableColumn>
                                        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[60vh]">
                                            <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                                {colTasks.length > 0 ? colTasks.map(task => (
                                                    <SortableTask key={task.id} task={task} onToggle={onToggle} onSelect={onSelect} showPriority={false} />
                                                )) : (
                                                    <div className="text-center py-8 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">
                                                        Arraste tarefas aqui
                                                    </div>
                                                )}
                                            </SortableContext>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            /* ═══ TEAM COLUMNS ═══ */
                            teamColumns.map((col, idx) => {
                                const tc = TEAM_COLORS[idx % TEAM_COLORS.length];
                                const load = col.tasks.length;
                                const loadLabel = load >= 8 ? "Sobrecarregado" : load >= 5 ? "Carregado" : "OK";
                                const loadColor = load >= 8 ? "text-red-500" : load >= 5 ? "text-amber-500" : "text-[#00A868]";
                                return (
                                    <div key={col.key} className={`flex-1 rounded-2xl border ${tc.color} bg-muted/20 flex flex-col min-w-[240px]`}>
                                        <DroppableColumn id={col.key}>
                                            <div className={`flex items-center justify-between px-4 py-3 rounded-t-2xl ${tc.headerBg}`}>
                                                <div className="flex items-center gap-2">
                                                    {col.key === "unassigned" ? (
                                                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                                            <UserIcon className="w-3 h-3 text-muted-foreground" />
                                                        </div>
                                                    ) : (
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${tc.dot}`}>
                                                            {initials(col.label)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h3 className={`text-xs font-bold ${tc.headerText}`}>{col.label}</h3>
                                                        <span className={`text-[9px] font-medium ${loadColor}`}>{loadLabel}</span>
                                                    </div>
                                                </div>
                                                <span className={`text-xs font-black ${tc.headerText}`}>{load}</span>
                                            </div>
                                        </DroppableColumn>
                                        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[60vh]">
                                            <SortableContext items={col.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                                {col.tasks.length > 0 ? col.tasks.map(task => (
                                                    <SortableTask key={task.id} task={task} onToggle={onToggle} onSelect={onSelect} showAssignee={false} showPriority={true} />
                                                )) : (
                                                    <div className="text-center py-8 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">
                                                        Arraste tarefas aqui
                                                    </div>
                                                )}
                                            </SortableContext>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Completed footer */}
                {completedCount > 0 && (
                    <div className="mt-3 text-center text-[10px] text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 inline mr-1" /> {completedCount} tarefa(s) concluída(s) — visíveis na view Board
                    </div>
                )}

                {/* Drag Overlay */}
                <DragOverlay>
                    {activeTask && (
                        <div className="card-elevated rounded-xl p-3 shadow-2xl border-2 border-[#00A868]/30 rotate-2 scale-105">
                            <div className="flex items-center gap-2">
                                <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                                <p className="text-sm font-medium text-foreground truncate">{activeTask.title}</p>
                            </div>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
