import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendRenegotiationAlert } from '@/lib/resend';

const CRON_SECRET = process.env.CRON_SECRET;
const RENEGOTIATION_DAYS = 60;

// GET — Called by cron or manually. Checks all accepted negotiations
// for: 1) 60-day auto renegotiation deadlines, 2) custom alertDate reminders
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!CRON_SECRET || key !== CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find all accepted negotiations with a dateAccept
        const negotiations = await prisma.negotiation.findMany({
            where: {
                status: 'aceita',
                dateAccept: { not: '' },
            },
            include: {
                client: {
                    include: {
                        user: {
                            select: { name: true, email: true, notificationEmail: true },
                        },
                    },
                },
            },
        });

        const alerts: { client: string; user: string; daysLeft: number; emailSent: boolean; type: string }[] = [];

        for (const neg of negotiations) {
            const user = neg.client.user;
            const toEmail = user.notificationEmail || user.email;

            // 1) Custom alertDate reminder
            if (neg.alertDate && neg.alertDate === todayStr && !neg.alertSent) {
                const result = await sendRenegotiationAlert(
                    toEmail,
                    neg.client.name,
                    0, // "today" style
                    user.name
                );

                // Mark as sent
                await prisma.negotiation.update({
                    where: { id: neg.id },
                    data: { alertSent: true },
                });

                alerts.push({
                    client: neg.client.name,
                    user: user.name,
                    daysLeft: 0,
                    emailSent: !!result,
                    type: 'custom_reminder',
                });
                continue; // Skip auto-check for this one
            }

            // 2) Auto 60-day renegotiation check
            const acceptDate = new Date(neg.dateAccept);
            if (isNaN(acceptDate.getTime())) continue;

            const renegDate = new Date(acceptDate);
            renegDate.setDate(renegDate.getDate() + RENEGOTIATION_DAYS);
            renegDate.setHours(0, 0, 0, 0);

            const diffMs = renegDate.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            // Alert 3 days before or on the day
            if (daysLeft === 3 || daysLeft === 0) {
                const result = await sendRenegotiationAlert(
                    toEmail,
                    neg.client.name,
                    daysLeft,
                    user.name
                );

                alerts.push({
                    client: neg.client.name,
                    user: user.name,
                    daysLeft,
                    emailSent: !!result,
                    type: 'auto_60days',
                });
            }
        }

        return NextResponse.json({
            checked: negotiations.length,
            alertsSent: alerts.length,
            alerts,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Renegotiation alert error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
