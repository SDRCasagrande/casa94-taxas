import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isAdmin } from '@/lib/auth';

// POST /api/teams/invite — Send invite to join org
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Apenas admins podem convidar membros' }, { status: 403 });
        }

        if (!session.orgId) {
            return NextResponse.json({ error: 'Organização não encontrada' }, { status: 400 });
        }

        const { email, role } = await request.json();
        if (!email?.trim()) return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
        if (!['admin', 'agent'].includes(role)) return NextResponse.json({ error: 'Cargo inválido' }, { status: 400 });

        // Check if user already exists in this org
        const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
        if (existing) {
            return NextResponse.json({ error: 'Já existe um usuário com este email' }, { status: 409 });
        }

        // Check for existing active invite
        const existingInvite = await prisma.invite.findFirst({
            where: { email: email.trim().toLowerCase(), orgId: session.orgId, usedAt: null },
        });
        if (existingInvite) {
            return NextResponse.json({ error: 'Já existe um convite pendente para este email' }, { status: 409 });
        }

        // Create invite (expires in 7 days)
        const invite = await prisma.invite.create({
            data: {
                orgId: session.orgId,
                email: email.trim().toLowerCase(),
                role,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        // TODO: Send email via Resend with invite link
        // For now, return the invite link directly
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.bittask.com.br';
        const inviteLink = `${baseUrl}/convite/${invite.token}`;

        return NextResponse.json({
            success: true,
            inviteLink,
            message: `Convite criado para ${email}. Link: ${inviteLink}`,
        });
    } catch (error) {
        console.error('POST /api/teams/invite error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

// GET /api/teams/invite — List pending invites
export async function GET() {
    try {
        const session = await getSession();
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!session.orgId) return NextResponse.json([]);

        const invites = await prisma.invite.findMany({
            where: { orgId: session.orgId },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(invites);
    } catch (error) {
        console.error('GET /api/teams/invite error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
