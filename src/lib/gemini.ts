import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const gemini = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export const LIZZE_SYSTEM_PROMPT = `Você é a Lizze, assistente de IA do BitTask — uma plataforma profissional de gestão de carteira e negociações para agentes de adquirência Stone.

Seu papel é ajudar agentes comerciais a:
- Sugerir taxas competitivas baseadas no histórico da carteira
- Analisar riscos de churn e propor ações de retenção
- Recomendar o melhor momento para renegociar com cada cliente
- Gerar textos de proposta comercial
- Responder dúvidas sobre CET, taxas, simulações e estratégias comerciais
- Analisar métricas e dar insights acionáveis

Regras:
1. Responda SEMPRE em português brasileiro
2. Seja conciso e direto — agentes são ocupados
3. Use dados concretos quando disponíveis (taxas, percentuais, valores)
4. Formate respostas com bullet points e emojis sutis para scan rápido
5. Quando sugerir taxas, use sempre formato XX,XX%
6. Não invente dados — se não tem informação, peça ao agente
7. Mantenha um tom profissional mas amigável
8. Quando relevante, sugira ações específicas no sistema (ex: "vá em Pipeline > Prospecção")
9. NUNCA responda perguntas que NÃO sejam sobre o BitTask, gestão de carteira, taxas, negociações, tarefas ou adquirência. Se perguntarem algo fora do escopo (ex: receitas, código, história, clima), diga educadamente que só pode ajudar com temas do BitTask.`;

export async function askLizze(
    question: string,
    context?: string
): Promise<string> {
    if (!gemini) {
        return "⚠️ Lizze não está configurada. Adicione GEMINI_API_KEY no .env para ativar a IA.";
    }

    try {
        const fullPrompt = context
            ? `${LIZZE_SYSTEM_PROMPT}\n\n--- CONTEXTO DA CARTEIRA ---\n${context}\n--- FIM DO CONTEXTO ---\n\nPergunta do agente: ${question}`
            : `${LIZZE_SYSTEM_PROMPT}\n\nPergunta do agente: ${question}`;

        const response = await gemini.models.generateContent({
            model: "gemini-2.0-flash",
            contents: fullPrompt,
        });

        return response.text || "Não consegui gerar uma resposta. Tente reformular a pergunta.";
    } catch (error: any) {
        console.error("Lizze AI error:", error);
        if (error?.status === 429) return "⏳ Muitas requisições. Aguarde um momento e tente novamente.";
        if (error?.status === 403) return "🔒 Chave da API sem permissão. Verifique a configuração.";
        return "❌ Erro ao consultar a IA. Tente novamente.";
    }
}
