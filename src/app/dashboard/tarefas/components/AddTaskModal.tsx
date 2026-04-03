"use client";

import { useState, useEffect } from "react";
import {
    Plus, CalendarDays, Clock, ListTodo, UserPlus,
    ChevronDown, Check, X, Flag, Sun, Repeat
} from "lucide-react";
import { TaskListData, UserOption, RECURRENCE_OPTIONS } from "./types";

export function AddTaskModal({ lists, users, defaultListId, defaultDate, defaultTime, defaultEndTime, onSave, onClose }: {
    lists: TaskListData[];
    users: UserOption[];
    defaultListId: string;
    defaultDate: string;
    defaultTime: string;
    defaultEndTime?: string;
    onSave: (listId: string, title: string, date?: string, time?: string, assigneeId?: string, priority?: string, description?: string) => void;
    onClose: () => void;
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState(defaultDate);
    const [time, setTime] = useState(defaultTime);
    const [endTime, setEndTime] = useState(defaultEndTime || "");
    const [allDay, setAllDay] = useState(false);
    const [priority, setPriority] = useState("medium");
    const [assignee, setAssignee] = useState("");
    const [listId, setListId] = useState(defaultListId);
    const [recurrence, setRecurrence] = useState("none");
    const [showRecurrence, setShowRecurrence] = useState(false);
    const [showListPicker, setShowListPicker] = useState(false);
    const [showAssigneePicker, setShowAssigneePicker] = useState(false);

    useEffect(() => { setDate(defaultDate); }, [defaultDate]);
    useEffect(() => { setTime(defaultTime); }, [defaultTime]);
    useEffect(() => { setEndTime(defaultEndTime || ""); }, [defaultEndTime]);
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl rounded-t-3xl sm:rounded-2xl animate-in slide-in-from-bottom sm:zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
                {/* Drag handle mobile */}
                <div className="sm:hidden flex justify-center pt-2 pb-1">
                    <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
                </div>

                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-5 py-3 sm:py-4 border-b border-border">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#00A868] flex items-center justify-center text-white shadow-lg shadow-[#00A868]/20">
                            <Plus className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">Nova Tarefa</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors touch-target">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
                    {/* Title */}
                    <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                        onKeyDown={e => { if (e.key === "Enter" && title.trim()) handleSave(); }}
                        placeholder="O que precisa ser feito?"
                        className="w-full text-lg font-medium text-foreground bg-transparent border-b-2 border-border focus:border-[#00A868] focus:outline-none pb-2 placeholder-muted-foreground/50 transition-colors" />

                    {/* Date & Time */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quando</label>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => (document.getElementById('addtask-date') as HTMLInputElement)?.showPicker?.()}
                                className="relative flex items-center gap-2 flex-1 min-w-[160px] h-11 px-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:border-[#00A868]/50 transition-colors cursor-pointer">
                                <CalendarDays className="w-4 h-4 text-[#00A868] shrink-0" />
                                <span>{date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Selecionar data"}</span>
                                <input id="addtask-date" type="date" value={date} onChange={e => setDate(e.target.value)}
                                    className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" />
                            </button>
                            {!allDay && (
                                <>
                                    <button onClick={() => (document.getElementById('addtask-time') as HTMLInputElement)?.showPicker?.()}
                                        className="relative flex items-center gap-2 min-w-[100px] h-11 px-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:border-[#00A868]/50 transition-colors cursor-pointer">
                                        <Clock className="w-4 h-4 text-[#00A868] shrink-0" />
                                        <span>{time || "Início"}</span>
                                        <input id="addtask-time" type="time" value={time} onChange={e => {
                                            setTime(e.target.value);
                                            if (e.target.value) {
                                                const [hh, mm] = e.target.value.split(":").map(Number);
                                                setEndTime(`${String((hh + 1) % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
                                            }
                                        }}
                                            className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" />
                                    </button>
                                    {endTime && (
                                        <>
                                            <span className="text-muted-foreground text-xs font-medium">até</span>
                                            <button onClick={() => (document.getElementById('addtask-endtime') as HTMLInputElement)?.showPicker?.()}
                                                className="relative flex items-center gap-2 min-w-[100px] h-11 px-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:border-[#00A868]/50 transition-colors cursor-pointer">
                                                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                                <span>{endTime}</span>
                                                <input id="addtask-endtime" type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                                                    className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" />
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                            <button onClick={() => setAllDay(!allDay)}
                                className={`flex items-center gap-1.5 h-11 px-3 rounded-xl text-xs font-medium border transition-all ${allDay ? "bg-[#00A868] text-white border-[#00A868] shadow-lg shadow-[#00A868]/20" : "bg-muted/50 text-muted-foreground border-border hover:border-[#00A868]/50"}`}>
                                <Sun className="w-3.5 h-3.5" />
                                Dia todo
                            </button>
                        </div>
                    </div>

                    {/* Recurrence */}
                    <div className="relative">
                        <button onClick={() => setShowRecurrence(!showRecurrence)}
                            className={`flex items-center gap-2 h-11 px-3 rounded-xl text-xs font-medium border transition-all w-full justify-between ${recurrence !== "none" ? "bg-purple-500/10 text-purple-500 border-purple-500/30" : "bg-muted/50 text-muted-foreground border-border hover:border-[#00A868]/50"}`}>
                            <span className="flex items-center gap-1.5">
                                <Repeat className="w-3.5 h-3.5" />
                                {RECURRENCE_OPTIONS.find(r => r.value === recurrence)?.label || "Não se repete"}
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRecurrence ? "rotate-180" : ""}`} />
                        </button>
                        {showRecurrence && (<>
                            <div className="fixed inset-0 z-10" onClick={() => setShowRecurrence(false)} />
                            <div className="absolute left-0 top-12 z-20 w-full bg-popover border border-border rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                {RECURRENCE_OPTIONS.map(opt => (
                                    <button key={opt.value} onClick={() => { setRecurrence(opt.value); setShowRecurrence(false); }}
                                        className={`w-full flex items-center gap-2 px-3 py-3 text-sm transition-colors ${recurrence === opt.value ? "text-[#00A868] font-bold bg-[#00A868]/5" : "text-foreground hover:bg-muted"}`}>
                                        {recurrence === opt.value && <Check className="w-3.5 h-3.5" />}
                                        <span className={recurrence === opt.value ? "" : "ml-5"}>{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </>)}
                    </div>

                    {/* Priority Pills */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prioridade</label>
                        <div className="flex gap-2">
                            {priorities.map(p => (
                                <button key={p.value} onClick={() => setPriority(p.value)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl text-xs font-bold border transition-all ${priority === p.value
                                        ? `${p.activeBg} ${p.activeText} border-transparent shadow-lg`
                                        : `${p.bg} ${p.color} ${p.border} hover:opacity-80`}`}>
                                    <Flag className="w-3.5 h-3.5" />
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* List Picker */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lista</label>
                        <div className="relative">
                            <button onClick={() => setShowListPicker(!showListPicker)}
                                className="w-full flex items-center gap-2 h-11 px-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:border-[#00A868]/50 transition-colors">
                                <ListTodo className="w-4 h-4 text-[#00A868] shrink-0" />
                                <span className="flex-1 text-left truncate">{selectedList?.name || "Selecionar lista"}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showListPicker ? "rotate-180" : ""}`} />
                            </button>
                            {showListPicker && (<>
                                <div className="fixed inset-0 z-10" onClick={() => setShowListPicker(false)} />
                                <div className="absolute left-0 top-12 z-20 w-full bg-popover border border-border rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150 max-h-48 overflow-y-auto">
                                    {lists.map(l => (
                                        <button key={l.id} onClick={() => { setListId(l.id); setShowListPicker(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-3 text-sm transition-colors ${listId === l.id ? "text-[#00A868] font-bold bg-[#00A868]/5" : "text-foreground hover:bg-muted"}`}>
                                            {listId === l.id && <Check className="w-3.5 h-3.5" />}
                                            <span className={listId === l.id ? "" : "ml-5"}>{l.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </>)}
                        </div>
                    </div>

                    {/* Assignee */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Responsável</label>
                        <div className="relative">
                            <button onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                                className="w-full flex items-center gap-2 h-11 px-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:border-[#00A868]/50 transition-colors">
                                <UserPlus className="w-4 h-4 text-[#00A868] shrink-0" />
                                <span className="flex-1 text-left truncate">{assignee ? users.find(u => u.id === assignee)?.name || "Responsável" : "Sem responsável"}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showAssigneePicker ? "rotate-180" : ""}`} />
                            </button>
                            {showAssigneePicker && (<>
                                <div className="fixed inset-0 z-10" onClick={() => setShowAssigneePicker(false)} />
                                <div className="absolute left-0 top-12 z-20 w-full bg-popover border border-border rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150 max-h-48 overflow-y-auto">
                                    <button onClick={() => { setAssignee(""); setShowAssigneePicker(false); }}
                                        className={`w-full flex items-center gap-2 px-3 py-3 text-sm transition-colors ${!assignee ? "text-[#00A868] font-bold bg-[#00A868]/5" : "text-foreground hover:bg-muted"}`}>
                                        {!assignee && <Check className="w-3.5 h-3.5" />}
                                        <span className={!assignee ? "" : "ml-5"}>Sem responsável</span>
                                    </button>
                                    {users.map(u => (
                                        <button key={u.id} onClick={() => { setAssignee(u.id); setShowAssigneePicker(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-3 text-sm transition-colors ${assignee === u.id ? "text-[#00A868] font-bold bg-[#00A868]/5" : "text-foreground hover:bg-muted"}`}>
                                            {assignee === u.id && <Check className="w-3.5 h-3.5" />}
                                            <span className={assignee === u.id ? "" : "ml-5"}>{u.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </>)}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)}
                            rows={3} placeholder="Adicionar detalhes, notas..."
                            className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50 resize-none" />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                        <CheckSquareIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{selectedList?.name || "Selecione uma lista"}</span>
                        {recurrence !== "none" && (
                            <span className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-500 font-medium shrink-0">
                                <Repeat className="w-3 h-3" />
                                {RECURRENCE_OPTIONS.find(r => r.value === recurrence)?.label}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={onClose}
                            className="px-4 h-10 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleSave} disabled={!title.trim() || !listId}
                            className="px-5 h-10 text-sm font-bold bg-[#00A868] text-white rounded-xl hover:bg-[#008f58] disabled:opacity-30 transition-all shadow-lg shadow-[#00A868]/20 active:scale-95">
                            Criar Tarefa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CheckSquareIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polyline points="9 11 12 14 24 2" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
    );
}
