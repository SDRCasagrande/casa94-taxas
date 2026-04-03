import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const errorParam = url.searchParams.get('error');

        // Check host for redirect URL logic
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

        // If Google returned an error or consent was denied
        if (errorParam || !code) {
            return NextResponse.redirect(`${protocol}://${host}/login?error=denied`);
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
        );

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Fetch User Info
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const email = userInfo.data.email;

        if (!email) {
            return NextResponse.redirect(`${protocol}://${host}/login?error=no_email`);
        }

        // Find user in DB
        const user = await prisma.user.findUnique({
            where: { email },
            include: { org: { select: { id: true, isActive: true } } },
        });

        if (!user || !user.isActive) {
            return NextResponse.redirect(`${protocol}://${host}/login?error=not_found&email=${encodeURIComponent(email)}`);
        }

        if (user.orgId && user.org && !user.org.isActive) {
            return NextResponse.redirect(`${protocol}://${host}/login?error=org_disabled`);
        }

        // Sign token
        const token = await signToken({
            userId: user.id,
            email: user.email,
            name: user.name,
            orgId: user.orgId || '',
            userRole: user.userRole || 'agent',
        });

        // Set Cookie Response
        const redirectTarget = user.userRole === 'super_admin' ? '/admin' : '/dashboard';
        const response = NextResponse.redirect(`${protocol}://${host}${redirectTarget}`);
        
        const cookieDomain = process.env.COOKIE_DOMAIN || undefined; 
        response.cookies.set('auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
            ...(cookieDomain ? { domain: cookieDomain } : {}),
        });

        return response;

    } catch (error) {
        console.error('[GOOGLE_AUTH_CALLBACK]', error);
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        return NextResponse.redirect(`${protocol}://${host}/login?error=auth_error`);
    }
}
