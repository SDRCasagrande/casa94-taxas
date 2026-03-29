import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_build';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
    userId: string;
    email: string;
    name: string;
    [key: string]: any;
}

export async function signToken(payload: JWTPayload): Promise<string> {
    return new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secretKey);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secretKey);
        return payload as unknown as JWTPayload;
    } catch {
        return null;
    }
}

export async function getSession(): Promise<JWTPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;
    return verifyToken(token);
}
