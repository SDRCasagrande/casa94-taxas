import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getSession();
        if (!session || !session.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const templates = await prisma.proposalTemplate.findMany({
            where: { orgId: session.orgId },
            orderBy: { createdAt: "desc" },
        });
        
        return NextResponse.json(templates);
    } catch (error) {
        console.error("GET /api/proposal-templates error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Apenas Admin ou similar pode criar? Por enquanto todos podem.
        const data = await req.json();

        if (!data.label) {
            return NextResponse.json({ error: "Label é obrigatório" }, { status: 400 });
        }

        const newTemplate = await prisma.proposalTemplate.create({
            data: {
                orgId: session.orgId,
                label: data.label,
                desc: data.desc || "",
                fidelidade: data.fidelidade || false,
                adesao: data.adesao || false,
                cancelDias: data.cancelDias || 7,
                defaultRates: data.defaultRates,
                defaultEnabledBrands: data.defaultEnabledBrands,
                defaultRavAuto: data.defaultRavAuto,
                defaultRavPontual: data.defaultRavPontual,
                defaultRavTipo: data.defaultRavTipo,
                defaultRavTiming: data.defaultRavTiming,
                defaultPixRate: data.defaultPixRate,
                defaultMachines: data.defaultMachines,
                defaultRental: data.defaultRental,
                defaultMaqAdesao: data.defaultMaqAdesao,
                defaultAdesaoValor: data.defaultAdesaoValor,
            }
        });

        return NextResponse.json(newTemplate, { status: 201 });
    } catch (error) {
        console.error("POST /api/proposal-templates error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
