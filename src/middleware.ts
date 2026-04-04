import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_build';
const secretKey = new TextEncoder().encode(JWT_SECRET);

const ADMIN_HOSTNAME = process.env.ADMIN_HOSTNAME || 'admin.bittask.com.br';

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('auth-token')?.value;
    const { pathname } = request.nextUrl;
    
    // Proxy-safe host resolution
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.hostname;
    const hostname = hostHeader.split(':')[0]; // isolate domain

    async function getPayload(t: string | undefined) {
        if (!t) return null;
        try {
            const { payload } = await jwtVerify(t, secretKey);
            return payload;
        } catch {
            return null;
        }
    }

    const payload = await getPayload(token);
    const isAuth = !!payload;
    const isSuperAdmin = payload?.userRole === 'super_admin';

    // ─── ADMIN SUBDOMAIN: admin.bittask.com.br ───
    const isAdminHost = hostname === ADMIN_HOSTNAME || hostname === 'admin.localhost';

    if (isAdminHost) {
        // Public admin paths
        if (pathname === '/login') {
            if (isAuth && isSuperAdmin) {
                return NextResponse.redirect(new URL('/admin', request.url));
            }
            return NextResponse.next();
        }

        // Shared APIs allowed
        if (pathname.startsWith('/api/')) {
            return NextResponse.next();
        }

        // Everything else requires auth and super_admin
        if (!isAuth) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        if (!isSuperAdmin) {
            return NextResponse.json({ error: 'Acesso negado: Requer privilégios de Admin.' }, { status: 403 });
        }

        // Force exactly the /admin ecosystem. Block /dashboard to avoid confusion.
        if (!pathname.startsWith('/admin')) {
            return NextResponse.redirect(new URL('/admin', request.url));
        }

        return NextResponse.next();
    }

    // ─── APP SUBDOMAIN: app.bittask.com.br ───

    // Deny access to /admin on the User Domain to keep it sandboxed
    if (pathname.startsWith('/admin')) {
        // We do not auto-redirect cross-domain to prevent confusion, just block it
        return NextResponse.json({ error: 'Por favor acesse o painel Admin pelo subdomínio correto.' }, { status: 403 });
    }

    // Public App Paths
    const publicPaths = ['/login', '/convite', '/primeiro-acesso', '/api/auth/login', '/api/auth/forgot-password', '/api/seed', '/api/google-calendar/callback', '/api/billing/webhook'];
    if (publicPaths.some(p => pathname.startsWith(p))) {
        if (pathname === '/login' && isAuth) {
            // Se logar num App e for SuperAdmin mas estiver no App, vai pro dashboard normalmente
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.next();
    }

    // Root -> redirect based on Auth
    if (pathname === '/') {
        if (isAuth) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Protected App Routes
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
        if (!isAuth) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/login', '/dashboard/:path*', '/api/:path*', '/admin/:path*', '/convite/:path*', '/primeiro-acesso/:path*'],
};
