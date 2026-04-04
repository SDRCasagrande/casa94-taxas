import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session || !session.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await params;
        const id = resolvedParams.id;
        
        const data = await req.json();

        // Verifica se o template existe e pertence a esta org
        const existing = await prisma.proposalTemplate.findUnique({ where: { id } });
        if (!existing || existing.orgId !== session.orgId) {
            return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
        }

        const updatedTemplate = await prisma.proposalTemplate.update({
            where: { id },
            data: {
                label: data.label !== undefined ? data.label : existing.label,
                desc: data.desc !== undefined ? data.desc : existing.desc,
                fidelidade: data.fidelidade !== undefined ? data.fidelidade : existing.fidelidade,
                adesao: data.adesao !== undefined ? data.adesao : existing.adesao,
                cancelDias: data.cancelDias !== undefined ? Number(data.cancelDias) : existing.cancelDias,
                defaultRates: data.defaultRates !== undefined ? data.defaultRates : existing.defaultRates,
                defaultEnabledBrands: data.defaultEnabledBrands !== undefined ? data.defaultEnabledBrands : existing.defaultEnabledBrands,
                defaultRavAuto: data.defaultRavAuto !== undefined ? data.defaultRavAuto : existing.defaultRavAuto,
                defaultRavPontual: data.defaultRavPontual !== undefined ? data.defaultRavPontual : existing.defaultRavPontual,
                defaultRavTipo: data.defaultRavTipo !== undefined ? data.defaultRavTipo : existing.defaultRavTipo,
                defaultRavTiming: data.defaultRavTiming !== undefined ? data.defaultRavTiming : existing.defaultRavTiming,
                defaultPixRate: data.defaultPixRate !== undefined ? data.defaultPixRate : existing.defaultPixRate,
                defaultMachines: data.defaultMachines !== undefined ? data.defaultMachines : existing.defaultMachines,
                defaultRental: data.defaultRental !== undefined ? data.defaultRental : existing.defaultRental,
                defaultMaqAdesao: data.defaultMaqAdesao !== undefined ? data.defaultMaqAdesao : existing.defaultMaqAdesao,
                defaultAdesaoValor: data.defaultAdesaoValor !== undefined ? data.defaultAdesaoValor : existing.defaultAdesaoValor,
            }
        });

        return NextResponse.json(updatedTemplate);
    } catch (error) {
        console.error("PUT /api/proposal-templates/[id] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session || !session.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await params;
        const id = resolvedParams.id;

        const existing = await prisma.proposalTemplate.findUnique({ where: { id } });
        if (!existing || existing.orgId !== session.orgId) {
            return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
        }

        await prisma.proposalTemplate.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/proposal-templates/[id] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
