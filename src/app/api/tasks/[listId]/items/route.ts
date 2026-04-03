import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createCalendarEvent, listCalendarEvents } from '@/lib/google-calendar';

// POST create a task inside a list
export async function POST(request: Request, { params }: { params: Promise<{ listId: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { listId } = await params;
        const { title, date, time, assigneeId, description, priority, force } = await request.json();

        if (!title?.trim()) return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 });

        const targetUserId = assigneeId || session.userId;

        // ═══ TEAM LOAD PREDICTION / CONFLICT CHECK ═══
        if (date && time && !force) {
            try {
                // Approximate São Paulo TZ
                const eventDate = new Date(`${date}T${time}:00-03:00`);
                const timeMin = new Date(eventDate.getTime() - 15 * 60000).toISOString(); // 15 mins before
                const timeMax = new Date(eventDate.getTime() + 60 * 60000).toISOString(); // 1 hr after

                // 1. Google Calendar Conflicts
                const existingEvents = await listCalendarEvents(targetUserId, timeMin, timeMax);

                // 2. BitTask Local Conflicts
                const localTasks = await prisma.task.findMany({
                    where: {
                        date,
                        time: { not: '' },
                        OR: [{ assigneeId: targetUserId }, { createdById: targetUserId, assigneeId: null }],
                        completed: false,
                    },
                    select: { id: true, title: true, time: true, date: true },
                });

                const conflictingLocal = localTasks.filter((t) => {
                    const tDate = new Date(`${t.date}T${t.time}:00-03:00`);
                    const diffMin = (tDate.getTime() - eventDate.getTime()) / 60000;
                    return diffMin > -15 && diffMin < 60; // Overlaps
                });

                if (existingEvents.length > 0 || conflictingLocal.length > 0) {
                    const conflicts = [
                        ...existingEvents.map((e) => `Agenda: ${e.title}`),
                        ...conflictingLocal.map((t) => `BitTask: ${t.title}`),
                    ];
                    return NextResponse.json(
                        {
                            warning: true,
                            message: `Atenção: O agente já possui ${conflicts.length} compromisso(s) próximo(s) a este horário.`,
                            conflicts,
                        },
                        { status: 409 }
                    );
                }
            } catch (err) {
                console.error('[Team Load Check] ignored error:', err);
            }
        }

        const list = await prisma.taskList.findFirst({ where: { id: listId, userId: session.userId } });
        if (!list) return NextResponse.json({ error: 'Lista não encontrada' }, { status: 404 });

        const task = await prisma.task.create({
            data: {
                title: title.trim(),
                description: description || '',
                date: date || '',
                time: time || '',
                priority: priority || 'medium',
                listId,
                createdById: session.userId,
                assigneeId: assigneeId || null,
            },
            include: {
                assignee: { select: { id: true, name: true, email: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });

        // Google Calendar sync — create event if user is connected and task has a date
        if (date) {
            try {
                const eventId = await createCalendarEvent(session.userId, {
                    title: title.trim(),
                    description: description || '',
                    date,
                    time: time || undefined,
                });
                if (eventId) {
                    await prisma.task.update({
                        where: { id: task.id },
                        data: { googleCalendarEventId: eventId, scheduled: true },
                    });
                }
            } catch (gcalError) {
                console.error('[GCal] Error creating event (non-blocking):', gcalError);
                // Non-blocking: task was created successfully, calendar sync just failed
            }
        }

        return NextResponse.json(task, { status: 201 });
    } catch (error) {
        console.error('POST /api/tasks/[listId]/items error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
