import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q')?.trim().toLowerCase();
        if (!q || q.length < 2) return NextResponse.json({ results: [] });

        const results: { type: string; id: string; title: string; subtitle?: string; href: string }[] = [];

        // Search clients
        const clients = await prisma.client.findMany({
            where: {
                ...(session.orgId ? { orgId: session.orgId } : { userId: session.userId }),
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { cnpj: { contains: q } },
                    { stoneCode: { contains: q } },
                    { email: { contains: q, mode: 'insensitive' } },
                ],
            },
            take: 5,
            select: { id: true, name: true, cnpj: true, stoneCode: true, status: true },
        });

        clients.forEach(c => {
            results.push({
                type: 'client',
                id: c.id,
                title: c.name,
                subtitle: [c.cnpj, c.stoneCode ? `SC: ${c.stoneCode}` : '', c.status === 'cancelado' ? '❌ Cancelado' : ''].filter(Boolean).join(' · '),
                href: '/dashboard/clientes',
            });
        });

        // Search negotiations
        const negotiations = await prisma.negotiation.findMany({
            where: {
                client: {
                    userId: session.userId,
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { cnpj: { contains: q } },
                        { stoneCode: { contains: q } },
                    ],
                },
            },
            take: 5,
            include: { client: { select: { name: true, stoneCode: true } } },
        });

        negotiations.forEach(n => {
            const statusLabel: Record<string, string> = {
                prospeccao: '🔵 Prospecção', proposta_enviada: '📤 Proposta', aguardando_cliente: '⏳ Aguardando',
                aprovado: '✅ Aprovado', recusado: '❌ Recusado', fechado: '🟣 Fechado',
            };
            results.push({
                type: 'negotiation',
                id: n.id,
                title: n.client.name,
                subtitle: `${statusLabel[n.status] || n.status} · ${new Date(n.dateNeg + 'T00:00:00').toLocaleDateString('pt-BR')}`,
                href: '/dashboard/negociacoes',
            });
        });

        // Search tasks
        const tasks = await prisma.task.findMany({
            where: {
                OR: [
                    { list: { userId: session.userId }, title: { contains: q, mode: 'insensitive' } },
                    { list: { userId: session.userId }, description: { contains: q, mode: 'insensitive' } },
                    { assigneeId: session.userId, title: { contains: q, mode: 'insensitive' } },
                    { assigneeId: session.userId, description: { contains: q, mode: 'insensitive' } },
                ],
            },
            take: 5,
            select: { id: true, title: true, date: true, completed: true, priority: true },
        });

        tasks.forEach(t => {
            results.push({
                type: 'task',
                id: t.id,
                title: t.title,
                subtitle: [
                    t.completed ? '✅' : t.priority === 'high' ? '🔴 Alta' : t.priority === 'low' ? '🔵 Baixa' : '🟡 Média',
                    t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR') : '',
                ].filter(Boolean).join(' · '),
                href: '/dashboard/tarefas',
            });
        });

        return NextResponse.json({ results: results.slice(0, 10) });
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ results: [] });
    }
}
