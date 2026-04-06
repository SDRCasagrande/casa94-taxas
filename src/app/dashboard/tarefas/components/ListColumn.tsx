"use client";

import { useState } from "react";
import {
    CheckSquare, Circle, CheckCircle2, Calendar, Star,
    MoreVertical, ChevronDown, Pencil, Trash2, Copy,
    Check, UserPlus, ExternalLink, Plus, MessageSquare, Flag
} from "lucide-react";
import { TaskData, UserOption, PRIORITY_MAP, friendlyDate, isOverdue } from "./types";

export function ListColumn({ list, users, onAdd, onToggle, onStar, onDelete, onSchedule, onAssign, onOpenDetail, onDeleteList, onRenameList, onClearCompleted, isSpecialView, onOpenAddTask, onMoveToList }: {
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
    onMoveToList?: (taskId: string, targetListId: string) => void;
}) {
    const [showMenu, setShowMenu] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameName, setRenameName] = useState(list.name);
    const [dragOver, setDragOver] = useState(false);

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
        <div className={`w-full lg:w-72 shrink-0 card-elevated flex flex-col max-h-[70vh] lg:max-h-[calc(100vh-180px)] transition-all ${dragOver ? "ring-2 ring-[#00A868]/40 bg-[#00A868]/5" : ""}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const taskId = e.dataTransfer.getData("text/taskId");
                const sourceListId = e.dataTransfer.getData("text/sourceListId");
                if (taskId && sourceListId && sourceListId !== list.id && onMoveToList) {
                    onMoveToList(taskId, list.id);
                }
            }}>
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
                        <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground touch-target"><MoreVertical className="w-4 h-4" /></button>
                        {showMenu && (<>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 top-10 z-20 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[200px]">
                                {onRenameList && (
                                    <button onClick={() => { setRenaming(true); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-3 text-sm text-foreground hover:bg-muted transition-colors">
                                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Renomear lista
                                    </button>
                                )}
                                <button onClick={() => { navigator.clipboard.writeText(pending.map(t => `- ${t.title}`).join("\n")); setShowMenu(false); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-3 text-sm text-foreground hover:bg-muted transition-colors">
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Copiar tarefas
                                </button>
                                {completed.length > 0 && (
                                    <button onClick={() => { if (onClearCompleted) onClearCompleted(); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-3 text-sm text-foreground hover:bg-muted transition-colors">
                                        <Check className="w-3.5 h-3.5 text-muted-foreground" /> Limpar concluídas
                                    </button>
                                )}
                                <div className="h-px bg-border my-1" />
                                {onDeleteList && (
                                    <button onClick={() => { onDeleteList(); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
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
                    <button onClick={onOpenAddTask} className="w-full flex items-center gap-2 text-sm text-[#00A868] hover:text-[#008f58] py-2 touch-target"><Plus className="w-4 h-4" /> Adicionar uma tarefa</button>
                ) : null}
            </div>

            {/* Tasks */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                {pending.map(task => {
                    const pri = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                    const overdue = isOverdue(task.dueDate || "") || isOverdue(task.date);
                    const subtaskTotal = task.subtasks?.length || 0;
                    const subtaskDone = task.subtasks?.filter(s => s.completed).length || 0;
                    return (
                    <div key={task.id}
                        draggable={!isSpecialView}
                        onDragStart={(e) => { e.dataTransfer.setData("text/taskId", task.id); e.dataTransfer.setData("text/sourceListId", list.id); e.dataTransfer.effectAllowed = "move"; }}
                        className={`group flex items-start gap-2 px-2 py-2.5 rounded-xl hover:bg-muted/40 transition-colors relative cursor-pointer active:bg-muted/60 ${overdue ? "ring-1 ring-red-500/30 animate-pulse-subtle" : ""} ${!isSpecialView ? "cursor-grab active:cursor-grabbing" : ""}`}
                        onClick={() => onOpenDetail(task)}>
                        <button onClick={(e) => { e.stopPropagation(); onToggle(task.id); }} className="shrink-0 mt-0.5 text-muted-foreground hover:text-[#00A868] touch-target p-0.5"><Circle className="w-[18px] h-[18px]" /></button>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-snug">{task.title}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {task.priority && task.priority !== "medium" && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-medium ${pri.bg} ${pri.color}`}>{pri.label}</span>
                                )}
                                {task.date && (
                                    <span className={`text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg font-medium ${isOverdue(task.date) ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>
                                        <Calendar className="w-3 h-3" /> {friendlyDate(task.date)}{task.time && <> · {task.time}</>}
                                    </span>
                                )}
                                {task.assignee ? (
                                    <span className="text-[10px] bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded-lg font-medium flex items-center gap-0.5">
                                        <UserPlus className="w-3 h-3" /> {task.assignee.name.split(" ")[0]}
                                    </span>
                                ) : null}
                                {subtaskTotal > 0 && (
                                    <div className="w-full mt-1.5 space-y-1">
                                        <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                            <span className="flex items-center gap-1"><CheckSquare className="w-2.5 h-2.5" /> Checklist</span>
                                            <span className={subtaskDone === subtaskTotal ? "text-[#00A868]" : ""}>{subtaskDone}/{subtaskTotal}</span>
                                        </div>
                                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-[#00A868] rounded-full transition-all duration-300" style={{ width: `${(subtaskDone / subtaskTotal) * 100}%` }} />
                                        </div>
                                    </div>
                                )}
                                {task.description && (
                                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                                        <MessageSquare className="w-3 h-3" />
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Actions - visible on mobile, hover on desktop */}
                        <div className="flex items-center gap-0.5 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); onStar(task.id); }} className={`p-1.5 rounded-lg ${task.starred ? "text-amber-500 opacity-100" : "text-muted-foreground hover:text-amber-500"}`}>
                                <Star className={`w-3.5 h-3.5 ${task.starred ? "fill-amber-500" : ""}`} />
                            </button>
                        </div>
                        {task.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-500 absolute right-2 top-2 lg:group-hover:hidden" />}
                    </div>
                    );
                })}

                {pending.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40"><CheckSquare className="w-10 h-10 mb-2" /><p className="text-xs">Não há tarefas</p></div>
                )}

                {completed.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                        <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-1.5 px-2 py-2 text-xs font-medium text-muted-foreground hover:text-foreground touch-target">
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCompleted ? "" : "-rotate-90"}`} /> Concluída ({completed.length})
                        </button>
                        {showCompleted && <div className="space-y-0.5 mt-1">{completed.map(task => (
                            <div key={task.id} className="group flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-muted/40 opacity-50 cursor-pointer"
                                onClick={() => onOpenDetail(task)}>
                                <button onClick={(e) => { e.stopPropagation(); onToggle(task.id); }} className="shrink-0 text-[#00A868] touch-target p-0.5"><CheckCircle2 className="w-[18px] h-[18px]" /></button>
                                <span className="text-sm text-muted-foreground line-through truncate flex-1">{task.title}</span>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="p-1.5 rounded-lg text-muted-foreground lg:opacity-0 lg:group-hover:opacity-100 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}</div>}
                    </div>
                )}
            </div>
        </div>
    );
}
