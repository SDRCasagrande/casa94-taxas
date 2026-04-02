"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
    DragEndEvent, DragStartEvent, DragOverlay
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import {
    Circle, CheckCircle2, Star, Clock, Flag, GripVertical,
    Calendar, User as UserIcon
} from "lucide-react";

interface TaskData {
    id: string; title: string; description: string; completed: boolean; date: string; time: string;
    dueDate?: string; starred: boolean; scheduled: boolean; priority: string; listId: string; createdById: string;
    assigneeId: string | null;
    assignee: { id: string; name: string; email: string } | null;
    createdBy: { id: string; name: string };
    createdAt: string;
}

interface KanbanBoardProps {
    tasks: TaskData[];
    onToggle: (taskId: string) => void;
    onUpdate: (taskId: string, data: Record<string, any>) => void;
    onSelect: (task: TaskData) => void;
}

const COLUMNS = [
    { key: "high", label: "🔴 Alta Prioridade", color: "border-red-500/30", headerBg: "bg-red-500/10", headerText: "text-red-500", dot: "bg-red-500" },
    { key: "medium", label: "🟡 Média Prioridade", color: "border-amber-500/30", headerBg: "bg-amber-500/10", headerText: "text-amber-500", dot: "bg-amber-500" },
    { key: "low", label: "🟢 Baixa Prioridade", color: "border-[#00A868]/30", headerBg: "bg-[#00A868]/10", headerText: "text-[#00A868]", dot: "bg-[#00A868]" },
];

function isOverdue(d: string) { return d ? d < new Date().toISOString().split("T")[0] : false; }
function friendlyDate(d: string) {
    if (!d) return "";
    const t = new Date(); const todayStr = t.toISOString().split("T")[0];
    t.setDate(t.getDate() + 1); const tomorrowStr = t.toISOString().split("T")[0];
    if (d === todayStr) return "Hoje";
    if (d === tomorrowStr) return "Amanhã";
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function SortableTask({ task, onToggle, onSelect }: { task: TaskData; onToggle: (id: string) => void; onSelect: (t: TaskData) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const overdue = isOverdue(task.date);

    return (
        <div ref={setNodeRef} style={style}
            className={`group card-elevated rounded-xl p-3 cursor-pointer hover:shadow-md transition-all border ${task.completed ? "opacity-50" : ""} ${overdue ? "border-red-500/20" : "border-transparent hover:border-[#00A868]/20"}`}>
            <div className="flex items-start gap-2">
                {/* Drag Handle */}
                <button {...attributes} {...listeners} className="mt-0.5 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
                    <GripVertical className="w-3.5 h-3.5" />
                </button>

                {/* Complete toggle */}
                <button onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
                    className={`mt-0.5 shrink-0 ${task.completed ? "text-[#00A868]" : "text-muted-foreground hover:text-[#00A868]"} transition-colors`}>
                    {task.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0" onClick={() => onSelect(task)}>
                    <p className={`text-sm font-medium leading-tight ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {task.date && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${overdue ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>
                                <Calendar className="w-2.5 h-2.5" /> {friendlyDate(task.date)}{task.time && ` ${task.time}`}
                            </span>
                        )}
                        {task.assignee && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                <UserIcon className="w-2.5 h-2.5" /> {task.assignee.name.split(" ")[0]}
                            </span>
                        )}
                    </div>
                </div>

                {/* Star */}
                {task.starred && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 mt-0.5" />}
            </div>
        </div>
    );
}

export default function KanbanBoard({ tasks, onToggle, onUpdate, onSelect }: KanbanBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const pendingTasks = tasks.filter(t => !t.completed);
    const columnTasks: Record<string, TaskData[]> = {
        high: pendingTasks.filter(t => t.priority === "high"),
        medium: pendingTasks.filter(t => t.priority === "medium"),
        low: pendingTasks.filter(t => t.priority === "low"),
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const taskId = active.id as string;
        const overId = over.id as string;

        // Check if dropped on a column header
        const targetColumn = COLUMNS.find(c => c.key === overId);
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
    };

    const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
    const completedCount = tasks.filter(t => t.completed).length;

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex-1 overflow-x-auto lg:overflow-x-auto">
                <div className="flex flex-col lg:flex-row gap-3 lg:min-w-[768px] h-full">
                    {COLUMNS.map(col => {
                        const colTasks = columnTasks[col.key] || [];
                        return (
                            <div key={col.key} className={`flex-1 rounded-2xl border ${col.color} bg-muted/20 flex flex-col min-w-[240px]`}>
                                {/* Column Header */}
                                <div id={col.key} className={`flex items-center justify-between px-4 py-3 rounded-t-2xl ${col.headerBg}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                                        <h3 className={`text-xs font-bold uppercase tracking-wider ${col.headerText}`}>{col.label.split(" ").slice(1).join(" ")}</h3>
                                    </div>
                                    <span className={`text-xs font-black ${col.headerText}`}>{colTasks.length}</span>
                                </div>

                                {/* Tasks */}
                                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[60vh]">
                                    <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                        {colTasks.length > 0 ? colTasks.map(task => (
                                            <SortableTask key={task.id} task={task} onToggle={onToggle} onSelect={onSelect} />
                                        )) : (
                                            <div className="text-center py-8 text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">
                                                Arraste tarefas aqui
                                            </div>
                                        )}
                                    </SortableContext>
                                </div>
                            </div>
                        );
                    })}
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
    );
}
