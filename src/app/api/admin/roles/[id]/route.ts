import { NextResponse } from 'next/server';

// DEPRECATED: Roles system replaced by simple userRole (admin/agent)
export async function PUT() {
    return NextResponse.json({ error: 'Sistema de cargos atualizado. Use userRole.' }, { status: 410 });
}
export async function DELETE() {
    return NextResponse.json({ error: 'Sistema de cargos atualizado. Use userRole.' }, { status: 410 });
}
