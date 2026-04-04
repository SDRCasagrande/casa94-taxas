import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_build';
const secretKey = new TextEncoder().encode(JWT_SECRET);

const ADMIN_HOSTNAME = process.env.ADMIN_HOSTNAME || 'admin.bittask.com.br';

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('auth-token')?.value;
    const { pathname } = request.nextUrl;
    
    // Fix for Coolify/Proxies reading correct hostname
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.hostname;
    const hostname = hostHeader.split(':')[0]; // remove port if present

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

    // Public paths
    const publicPaths = ['/login', '/convite', '/primeiro-acesso', '/api/auth/login', '/api/auth/forgot-password', '/api/seed', '/api/google-calendar/callback', '/api/billing/webhook'];
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

    // Super Admin routes
    if (pathname.startsWith('/admin')) {
        if (!isAuth) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        if (!isSuperAdmin) {
             return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
        }
        return NextResponse.next();
    }
    
    // API Admin routes
    if (pathname.startsWith('/api/admin/')) {
        if (!isAuth || !isSuperAdmin) {
            return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
        }
    }

    // Protected routes (Dashboard & normal API)
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
