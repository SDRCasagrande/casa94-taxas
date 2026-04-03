import { Flag } from "lucide-react";

export interface UserOption { id: string; name: string; email: string }
export interface TaskData {
    id: string; title: string; description: string; completed: boolean; date: string; time: string;
    dueDate?: string; starred: boolean; scheduled: boolean; priority: string; listId: string; createdById: string;
    assigneeId: string | null;
    assignee: UserOption | null;
    createdBy: { id: string; name: string };
    createdAt: string;
}
export interface TaskListData { id: string; name: string; tasks: TaskData[] }
export interface TaskComment { id: string; userId: string; userName: string; text: string; createdAt: string }

export function today() { return new Date().toISOString().split("T")[0]; }
export function friendlyDate(d: string) {
    if (!d) return "";
    const t = new Date(); const todayStr = t.toISOString().split("T")[0];
    t.setDate(t.getDate() + 1); const tomorrowStr = t.toISOString().split("T")[0];
    if (d === todayStr) return "Hoje";
    if (d === tomorrowStr) return "Amanhã";
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}
export function isOverdue(d: string) { return d ? d < today() : false; }
export function initials(name: string) { return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase(); }

export const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof Flag }> = {
    high: { label: "Alta", color: "text-red-500", bg: "bg-red-500/10", icon: Flag },
    medium: { label: "Média", color: "text-amber-500", bg: "bg-amber-500/10", icon: Flag },
    low: { label: "Baixa", color: "text-[#00A868]", bg: "bg-[#00A868]/10", icon: Flag },
};

export const RECURRENCE_OPTIONS = [
    { value: "none", label: "Não se repete" },
    { value: "daily", label: "Diariamente" },
    { value: "weekly", label: "Semanalmente" },
    { value: "monthly", label: "Mensalmente" },
    { value: "yearly", label: "Anualmente" },
];
