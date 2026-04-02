import { NextResponse } from 'next/server';

// DEPRECATED: Roles system replaced by simple userRole (admin/agent)
export async function GET() {
    return NextResponse.json([]);
}
export async function POST() {
    return NextResponse.json({ error: 'Sistema de cargos atualizado. Use userRole.' }, { status: 410 });
}
