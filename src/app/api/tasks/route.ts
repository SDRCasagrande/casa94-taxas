import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET all task lists with tasks for current user
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let lists = await prisma.taskList.findMany({
            where: { userId: session.userId },
            include: {
                tasks: {
                    include: {
                        assignee: { select: { id: true, name: true, email: true } },
                        createdBy: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Auto-create default list on first visit
        if (lists.length === 0) {
            const newList = await prisma.taskList.create({
                data: { name: 'Minhas Tarefas', userId: session.userId },
                include: { tasks: { include: { assignee: { select: { id: true, name: true, email: true } }, createdBy: { select: { id: true, name: true } } } } },
            });
            lists = [newList];
        }

        // Also include tasks assigned TO this user (from any list)
        const assignedTasks = await prisma.task.findMany({
            where: { assigneeId: session.userId },
            include: {
                assignee: { select: { id: true, name: true, email: true } },
                createdBy: { select: { id: true, name: true } },
                list: { select: { name: true } },
                group: { select: { id: true, name: true } },
            },
        });

        // Tasks assigned to groups the user belongs to
        const userGroups = await prisma.teamGroupMember.findMany({
            where: { userId: session.userId },
            select: { groupId: true },
        });
        const groupIds = userGroups.map(g => g.groupId);

        let groupTasks: any[] = [];
        if (groupIds.length > 0) {
            groupTasks = await prisma.task.findMany({
                where: {
                    groupId: { in: groupIds },
                    createdById: { not: session.userId },
                    assigneeId: { not: session.userId },
                },
                include: {
                    assignee: { select: { id: true, name: true, email: true } },
                    createdBy: { select: { id: true, name: true } },
                    list: { select: { name: true } },
                    group: { select: { id: true, name: true } },
                },
            });
        }

        // User's groups for the UI
        const teams = await prisma.teamGroup.findMany({
            include: {
                members: { include: { user: { select: { id: true, name: true } } } },
                _count: { select: { tasks: true } },
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({ lists, assignedTasks, groupTasks, teams });
    } catch (error) {
        console.error('GET /api/tasks error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// POST create new task list
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { name } = await request.json();
        if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });

        const list = await prisma.taskList.create({
            data: { name: name.trim(), userId: session.userId },
            include: { tasks: true },
        });

        return NextResponse.json(list, { status: 201 });
    } catch (error) {
        console.error('POST /api/tasks error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
