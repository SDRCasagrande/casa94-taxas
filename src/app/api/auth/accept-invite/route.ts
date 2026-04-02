import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// POST /api/auth/accept-invite — Accept invite, create account
export async function POST(request: Request) {
    try {
        const { token, name, password } = await request.json();

        if (!token || !name?.trim() || !password || password.length < 6) {
            return NextResponse.json({ error: 'Token, nome e senha (min 6 chars) são obrigatórios' }, { status: 400 });
        }

        const invite = await prisma.invite.findUnique({ where: { token } });
        if (!invite) return NextResponse.json({ error: 'Convite inválido' }, { status: 404 });
        if (invite.usedAt) return NextResponse.json({ error: 'Convite já utilizado' }, { status: 400 });
        if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'Convite expirado' }, { status: 400 });

        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { email: invite.email } });
        if (existing) return NextResponse.json({ error: 'Já existe uma conta com este email' }, { status: 409 });

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                email: invite.email,
                name: name.trim(),
                password: hashedPassword,
                orgId: invite.orgId,
                userRole: invite.role,
            },
        });

        // Mark invite as used
        await prisma.invite.update({
            where: { id: invite.id },
            data: { usedAt: new Date() },
        });

        return NextResponse.json({ 
            success: true, 
            user: { id: user.id, name: user.name, email: user.email } 
        });
    } catch (error) {
        console.error('Accept invite error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
