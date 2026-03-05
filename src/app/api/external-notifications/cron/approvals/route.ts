/**
 * CRON Job for Approval Monitoring
 * 
 * Vercel Cron or similar scheduler should hit this endpoint periodically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApprovalMonitorService } from '@/lib/services/external-notifications/approval-monitor-service';

export async function GET(req: NextRequest) {
    // Basic security check (e.g. check for CRON_SECRET or just run since internal)
    // For Vercel Cron: const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorized', { status: 401 });

    try {
        await ApprovalMonitorService.runGlobalCheck();

        return NextResponse.json({
            success: true,
            message: 'Approval check completed'
        });
    } catch (error: any) {
        console.error('[CRON Approvals] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
