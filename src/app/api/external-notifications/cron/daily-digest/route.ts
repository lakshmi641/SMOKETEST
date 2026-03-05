export const dynamic = "force-dynamic"
/**
 * CRON Job: Daily Task Digest
 * 
 * Purpose: Send a summary email at 10 AM with all tasks due today.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { sendNotification } from '../../lib/sendNotification';

export async function GET(req: NextRequest) {
    console.log('[CRON Digest] Starting daily digest generation...');
    const db = getAdminFirestore();

    const results = {
        usersChecked: 0,
        emailsSent: 0,
        errors: 0
    };

    try {
        // 1. Get All Companies
        const companiesSnap = await db.collection('companies').get();

        for (const companyDoc of companiesSnap.docs) {
            const companyId = companyDoc.id;

            // 2. Get Users in Company
            const usersSnap = await db.collection(`companies/${companyId}/users`).get();

            for (const userDoc of usersSnap.docs) {
                const userId = userDoc.id;
                const user = userDoc.data();

                if (!user.email) continue;
                results.usersChecked++;

                // 3. Find Tasks Due Today (or Overdue) for this User
                // Simpler query: get all assigned tasks and filter in memory for complex date logic
                // Optimization: In prod, verify 'status' and 'assignedUserId' index exists
                const tasksSnap = await db.collection(`companies/${companyId}/tasks`)
                    .where('assignedUserId', '==', userId)
                    .where('status', 'in', ['assigned', 'in_progress'])
                    .get();

                if (tasksSnap.empty) continue;

                const today = new Date();
                const dueTasks = tasksSnap.docs.filter(doc => {
                    const task = doc.data();
                    if (!task.dueDate) return false;
                    const due = new Date(task.dueDate);

                    // Check if due date is same calendar day
                    const isToday = due.getDate() === today.getDate() &&
                        due.getMonth() === today.getMonth() &&
                        due.getFullYear() === today.getFullYear();

                    // Also include overdue? User asked for "due tasks". Let's assume Today + Overdue.
                    const isOverdue = due < today && !isToday;

                    return isToday || isOverdue;
                }).map(d => ({ id: d.id, ...d.data() }));

                if (dueTasks.length === 0) continue;

                // 4. Construct Email Content
                const taskListItems = dueTasks.map((t: any) =>
                    `<li><strong>${t.title}</strong> (Due: ${t.dueDate}) - ${t.priority || 'Normal'} Priority</li>`
                ).join('');

                const messageBody = `
                    <h3>Daily Task Digest</h3>
                    <p>Hello ${user.name}, you have ${dueTasks.length} tasks needing attention today:</p>
                    <ul>${taskListItems}</ul>
                    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/my-tasks">View My Tasks</a></p>
                `;

                // 5. Send Email
                await sendNotification({
                    companyId,
                    recipientUserId: userId,
                    eventType: 'task_due_soon', // Reusing type for auth/prefs checks
                    channel: 'email', // Digest only on email usually
                    recipientEmail: user.email,
                    recipientPhone: undefined,
                    subject: `Daily Digest: ${dueTasks.length} tasks due today`,
                    messageBody,
                    priority: 'medium'
                });

                results.emailsSent++;
                console.log(`[CRON Digest] Sent digest to ${user.email} (${dueTasks.length} tasks)`);
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('[CRON Digest] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
