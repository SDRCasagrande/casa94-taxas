import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/auth/invite/[token] — Validate invite token
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await params;

        const invite = await prisma.invite.findUnique({ where: { token } });
        if (!invite) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 });
        if (invite.usedAt) return NextResponse.json({ error: 'Convite já utilizado' }, { status: 400 });
        if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'Convite expirado' }, { status: 400 });

        // Get org name for display
        const org = await prisma.organization.findUnique({ 
            where: { id: invite.orgId },
            select: { name: true },
        });

        return NextResponse.json({
            email: invite.email,
            role: invite.role,
            orgName: org?.name || '',
        });
    } catch (error) {
        console.error('Validate invite error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
