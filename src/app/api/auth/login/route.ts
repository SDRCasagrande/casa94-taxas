import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

const RATE_LIMIT_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; expiresAt: number }>();

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
        }

        // Anti-Bruteforce Logic
        const now = Date.now();
        const attempt = loginAttempts.get(email);
        if (attempt && attempt.expiresAt > now) {
            if (attempt.count >= MAX_ATTEMPTS) {
                return NextResponse.json({ error: 'Muitas tentativas falhas. Tente novamente em 5 minutos.' }, { status: 429 });
            }
        } else if (attempt && attempt.expiresAt <= now) {
            loginAttempts.delete(email); // Reset after expiration
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: { org: { select: { id: true, isActive: true } } },
        });
        if (!user || !user.isActive) {
            recordWait(email);
            return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
        }

        // Check if org is active (super_admin has no org)
        if (user.orgId && user.org && !user.org.isActive) {
            return NextResponse.json({ error: 'Sua organização está desativada. Entre em contato com o suporte.' }, { status: 403 });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            recordWait(email);
            return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
        }

        // Success - clear failed attempts
        loginAttempts.delete(email);

        const token = await signToken({
            userId: user.id,
            email: user.email,
            name: user.name,
            orgId: user.orgId || '',
            userRole: user.userRole || 'agent',
        });

        const response = NextResponse.json({
            user: { id: user.id, name: user.name, email: user.email, userRole: user.userRole },
        });

        const cookieDomain = process.env.COOKIE_DOMAIN || undefined; // e.g. ".bittask.com.br" for cross-subdomain
        response.cookies.set('auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
            ...(cookieDomain ? { domain: cookieDomain } : {}),
        });

        return response;
    } catch {
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

function recordWait(email: string) {
    const attempt = loginAttempts.get(email);
    const now = Date.now();
    if (attempt) {
        attempt.count += 1;
        attempt.expiresAt = now + RATE_LIMIT_DURATION;
    } else {
        loginAttempts.set(email, { count: 1, expiresAt: now + RATE_LIMIT_DURATION });
    }
}
