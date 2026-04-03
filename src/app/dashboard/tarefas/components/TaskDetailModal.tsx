"use client";

import { useState, useEffect } from "react";
import {
    CheckCircle2, Circle, Calendar, Star, Trash2,
    CalendarDays, Pencil, X, Check, Users,
    MessageSquare, AlertTriangle, Flag, Clock
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmModal";
import { TaskData, UserOption, TaskComment, PRIORITY_MAP } from "./types";

export function TaskDetailModal({ task, users, onUpdate, onDelete, onClose }: {
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] bg-card border border-border shadow-2xl flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 fade-in duration-200 rounded-t-3xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
                {/* Drag handle mobile */}
                <div className="sm:hidden flex justify-center pt-2 pb-1">
                    <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 sm:py-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => onUpdate({ completed: !task.completed })}
                            className={`${task.completed ? "text-[#00A868]" : "text-muted-foreground hover:text-[#00A868]"} transition-colors touch-target`}>
                            {task.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        </button>
                        <span className="text-sm font-bold text-foreground">Detalhes da Tarefa</span>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground touch-target"><X className="w-4 h-4" /></button>
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
                                className="w-full h-11 px-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50">
                                <option value="high">🔴 Alta</option>
                                <option value="medium">🟡 Média</option>
                                <option value="low">🔵 Baixa</option>
                            </select>
                        </div>

                        {/* Assignee */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Responsável</label>
                            <select value={assigneeId} onChange={e => { setAssigneeId(e.target.value); markDirty(); }}
                                className="w-full h-11 px-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50">
                                <option value="">Sem responsável</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>

                        {/* Date */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data</label>
                            <input type="date" value={date} onChange={e => { setDate(e.target.value); markDirty(); }}
                                className="w-full h-11 px-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark]" />
                            <div className="flex gap-1">
                                {[{ label: "Hoje", days: 0 }, { label: "Amanhã", days: 1 }, { label: "+1 sem", days: 7 }].map(s => {
                                    const d = new Date(); d.setDate(d.getDate() + s.days);
                                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                    return (
                                        <button key={s.label} type="button" onClick={() => { setDate(val); markDirty(); }}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${date === val ? "bg-[#00A868] text-white" : "bg-muted text-muted-foreground hover:bg-[#00A868]/10 hover:text-[#00A868]"}`}>
                                            {s.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Time */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Horário</label>
                            <input type="time" value={time} onChange={e => { setTime(e.target.value); markDirty(); }}
                                className="w-full h-11 px-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark]" />
                            <div className="flex gap-1">
                                {["09:00", "10:00", "14:00", "18:00"].map(t => (
                                    <button key={t} type="button" onClick={() => { setTime(t); markDirty(); }}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${time === t ? "bg-[#00A868] text-white" : "bg-muted text-muted-foreground hover:bg-[#00A868]/10 hover:text-[#00A868]"}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Deadline */}
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prazo</label>
                            <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); markDirty(); }}
                                className={`w-full h-11 px-3 bg-muted/50 border rounded-xl text-sm text-foreground focus:outline-none focus:border-[#00A868]/50 [color-scheme:dark] ${dueDate && new Date(dueDate + 'T23:59:59') < new Date() ? 'border-red-500/50 text-red-400' : 'border-border'}`} />
                            <div className="flex gap-1 flex-wrap">
                                {[{ label: "+3d", days: 3 }, { label: "+1 sem", days: 7 }, { label: "+15d", days: 15 }, { label: "+30d", days: 30 }].map(s => {
                                    const d = new Date(); d.setDate(d.getDate() + s.days);
                                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                    return (
                                        <button key={s.label} type="button" onClick={() => { setDueDate(val); markDirty(); }}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${dueDate === val ? "bg-[#00A868] text-white" : "bg-muted text-muted-foreground hover:bg-[#00A868]/10 hover:text-[#00A868]"}`}>
                                            {s.label}
                                        </button>
                                    );
                                })}
                                {dueDate && (
                                    <button type="button" onClick={() => { setDueDate(""); markDirty(); }}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
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

                    {/* Comments */}
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
                                className="flex-1 h-10 px-3 bg-muted/50 border border-border rounded-xl text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50 min-w-0" />
                            <button onClick={addComment} disabled={!newComment.trim()}
                                className="h-10 px-4 rounded-xl text-xs font-bold bg-[#00A868] text-white hover:bg-[#008f58] disabled:opacity-30 transition-all shrink-0">
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
                        className={`flex items-center gap-1 px-3 h-10 rounded-xl text-xs font-medium touch-target ${task.starred ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground hover:text-amber-500"}`}>
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
                        className="flex items-center gap-1 px-3 h-10 rounded-xl text-xs font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 touch-target">
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
                        className="flex items-center gap-1 px-3 h-10 rounded-xl text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 touch-target">
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>

                    <div className="ml-auto">
                    {dirty ? (
                        <button onClick={handleSave}
                            className="flex items-center gap-1.5 px-4 h-10 rounded-xl text-xs font-bold bg-[#00A868] text-white shadow-lg shadow-[#00A868]/20 hover:bg-[#008f58] animate-pulse transition-all">
                            <Check className="w-3.5 h-3.5" /> Salvar
                        </button>
                    ) : saved ? (
                        <span className="flex items-center gap-1.5 px-4 h-10 rounded-xl text-xs font-bold bg-[#00A868]/15 text-[#00A868]">
                            <Check className="w-3.5 h-3.5" /> Salvo!
                        </span>
                    ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
