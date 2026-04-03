import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_build';
const secretKey = new TextEncoder().encode(JWT_SECRET);

const ADMIN_HOSTNAME = process.env.ADMIN_HOSTNAME || 'admin.bittask.com.br';

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('auth-token')?.value;
    const { pathname, hostname } = request.nextUrl;

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

    // ─── ADMIN SUBDOMAIN (admin.bittask.com.br) ───
    const isAdminHost = hostname === ADMIN_HOSTNAME || hostname === 'admin.localhost';

    if (isAdminHost) {
        // Public admin paths
        if (pathname === '/login') {
            if (isAuth && isSuperAdmin) {
                return NextResponse.redirect(new URL('/admin', request.url));
            }
            return NextResponse.next();
        }

        // API routes — allow through (they handle their own auth)
        if (pathname.startsWith('/api/')) {
            return NextResponse.next();
        }

        // All admin routes require super_admin
        if (!isAuth) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        if (!isSuperAdmin) {
            return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
        }

        // Force admin panel — block dashboard and other app routes
        if (!pathname.startsWith('/admin')) {
            return NextResponse.redirect(new URL('/admin', request.url));
        }

        return NextResponse.next();
    }

    // ─── APP SUBDOMAIN (app.bittask.com.br) ───

    // Block /admin on main domain — must use admin.bittask.com.br
    if (pathname.startsWith('/admin')) {
        const adminUrl = new URL(pathname, `https://${ADMIN_HOSTNAME}`);
        adminUrl.search = request.nextUrl.search;
        return NextResponse.redirect(adminUrl);
    }

    // Public paths
    const publicPaths = ['/login', '/convite', '/primeiro-acesso', '/api/auth/login', '/api/auth/forgot-password', '/api/seed', '/api/google-calendar/callback', '/api/billing/webhook', '/api/admin/promote'];
    if (publicPaths.some(p => pathname.startsWith(p))) {
        if (pathname === '/login' && isAuth) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.next();
    }

    // Root redirect
    if (pathname === '/') {
        if (isAuth) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Protected routes
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
