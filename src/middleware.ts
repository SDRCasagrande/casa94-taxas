import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_build';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('auth-token')?.value;
    const { pathname } = request.nextUrl;

    async function isAuthenticated(t: string | undefined) {
        if (!t) return false;
        try {
            await jwtVerify(t, secretKey);
            return true;
        } catch {
            return false;
        }
    }
    
    const isAuth = await isAuthenticated(token);

    // Public paths
    const publicPaths = ['/login', '/api/auth/login', '/api/auth/forgot-password', '/api/seed'];
    if (publicPaths.some(p => pathname.startsWith(p))) {
        // If logged in and trying to access login page, redirect to dashboard
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
    matcher: ['/', '/login', '/dashboard/:path*', '/api/:path*'],
};
