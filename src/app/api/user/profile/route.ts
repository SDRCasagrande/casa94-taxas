import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET current user profile
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { id: true, name: true, email: true, phone: true, notificationEmail: true, createdAt: true },
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        return NextResponse.json(user);
    } catch (error) {
        console.error('GET /api/user/profile error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// PUT update user profile
export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { name, email, phone, notificationEmail, currentPassword, newPassword } = body;

        const user = await prisma.user.findUnique({ where: { id: session.userId } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {};

        if (name !== undefined && name.trim()) {
            updateData.name = name.trim();
        }

        if (email !== undefined && email.trim() !== user.email) {
            const trimmed = email.trim().toLowerCase();
            const existing = await prisma.user.findUnique({ where: { email: trimmed } });
            if (existing && existing.id !== user.id) {
                return NextResponse.json({ error: 'Email já está em uso' }, { status: 409 });
            }
            updateData.email = trimmed;
        }

        if (phone !== undefined) {
            updateData.phone = phone.trim();
        }

        if (notificationEmail !== undefined) {
            updateData.notificationEmail = notificationEmail.trim();
        }

        if (newPassword) {
            if (!currentPassword) {
                return NextResponse.json({ error: 'Senha atual é obrigatória' }, { status: 400 });
            }
            const isValid = await bcrypt.compare(currentPassword, user.password);
            if (!isValid) {
                return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });
            }
            if (newPassword.length < 6) {
                return NextResponse.json({ error: 'Nova senha deve ter no mínimo 6 caracteres' }, { status: 400 });
            }
            updateData.password = await bcrypt.hash(newPassword, 12);
        }

        const updated = await prisma.user.update({
            where: { id: session.userId },
            data: updateData,
            select: { id: true, name: true, email: true, phone: true, notificationEmail: true },
        });

        // Reissue JWT with updated name/email so sidebar reflects changes immediately
        const newToken = await signToken({
            userId: updated.id,
            email: updated.email,
            name: updated.name,
        });

        const response = NextResponse.json(updated);
        response.cookies.set('auth-token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('PUT /api/user/profile error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
