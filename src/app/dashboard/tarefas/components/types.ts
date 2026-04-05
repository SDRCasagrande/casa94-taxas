import { Flag } from "lucide-react";

export interface UserOption { id: string; name: string; email: string }
export interface SubTask { id: string; title: string; completed: boolean; order: number; taskId: string; createdAt: string }
export interface TaskData {
    id: string; title: string; description: string; completed: boolean; date: string; time: string;
    dueDate?: string; starred: boolean; scheduled: boolean; priority: string; listId: string; createdById: string;
    recurrence?: string; recurrenceEnd?: string;
    assigneeId: string | null;
    clientId?: string | null;
    negotiationId?: string | null;
    client?: { id: string; name: string, userId: string } | null;
    assignee: UserOption | null;
    createdBy: { id: string; name: string };
    subtasks?: SubTask[];
    createdAt: string;
}
export interface TaskListData { id: string; name: string; shared: boolean; userId: string; user?: { id: string; name: string }; tasks: TaskData[] }
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

/** Centralized ISO date formatting — replaces ~15 template literals across the codebase */
export function formatDateISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Compute end time (1h after start). Used by AddTaskModal and page.tsx */
export function computeEndTime(startTime: string): string {
    const [hh, mm] = startTime.split(":").map(Number);
    return `${String((hh + 1) % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Get next rounded time slot (for default time in calendar) */
export function nextRoundedTime(): string {
    const now = new Date();
    const mins = now.getMinutes();
    const roundedMins = mins < 30 ? 30 : 0;
    const h = mins < 30 ? now.getHours() : now.getHours() + 1;
    return `${String(h % 24).padStart(2, "0")}:${String(roundedMins).padStart(2, "0")}`;
}

export const TASK_TEMPLATES = [
    {
        name: "Visita de Retenção",
        title: "Visita presencial — Retenção",
        description: "Objetivo: visitar o cliente para apresentar proposta de retenção com melhores taxas.\n\nChecklist:\n- Preparar proposta no simulador\n- Levar comparativo de taxas\n- Verificar TPV dos últimos 3 meses",
        priority: "high",
        daysUntilDue: 3,
    },
    {
        name: "Follow-up Pós-Proposta",
        title: "Follow-up — Retorno de proposta",
        description: "Ligar para o cliente verificando se teve tempo de analisar a proposta enviada.\n\nDicas:\n- Perguntar se ficou alguma dúvida\n- Reforçar os diferenciais\n- Se necessário, ajustar taxas",
        priority: "high",
        daysUntilDue: 2,
    },
    {
        name: "Cadastro Completo",
        title: "Completar cadastro do cliente",
        description: "Preencher todos os dados do cliente no sistema.\n\nDados necessários:\n- CNPJ e Razão Social\n- Stone Code\n- Telefone e Email\n- TPV mensal estimado\n- Taxas atuais (se tiver concorrente)",
        priority: "medium",
        daysUntilDue: 5,
    },
    {
        name: "Renegociação Mensal",
        title: "Renegociação periódica",
        description: "Análise mensal do cliente para verificar se as taxas estão competitivas e se há risco de churn.\n\nVerificar:\n- TPV do último mês vs meta\n- Comparar taxas com mercado\n- Satisfação geral do cliente",
        priority: "medium",
        daysUntilDue: 7,
        recurrence: "monthly",
    },
    {
        name: "Primeiro Contato",
        title: "Primeiro contato com lead",
        description: "Realizar primeiro contato com novo lead/prospect.\n\nRoteiro:\n- Apresentar a empresa\n- Entender as dores do cliente\n- Solicitar extrato de taxas atual\n- Agendar visita presencial",
        priority: "high",
        daysUntilDue: 1,
    },
];
