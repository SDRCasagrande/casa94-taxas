import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    response.cookies.set('auth-token', '', {
        maxAge: 0,
        path: '/',
        ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    return response;
}
