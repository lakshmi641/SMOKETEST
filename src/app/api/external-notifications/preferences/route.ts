/**
 * User External Notification Preferences API
 */

import { NextRequest, NextResponse } from 'next/server';
import { PreferenceService } from '@/lib/services/external-notifications/preference-service';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const companyId = searchParams.get('companyId');
        const userId = searchParams.get('userId');
        const groupId = searchParams.get('groupId') || undefined;

        if (!companyId || !userId) {
            return NextResponse.json(
                { error: 'companyId and userId are required' },
                { status: 400 }
            );
        }

        const preferences = await PreferenceService.getUserPreferences(companyId, userId, groupId);

        return NextResponse.json({
            success: true,
            preferences,
        });

    } catch (error: any) {
        console.error('[Preferences API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { companyId, userId, preferences, groupId } = body;

        if (!companyId || !userId || !preferences) {
            return NextResponse.json(
                { error: 'companyId, userId, and preferences are required' },
                { status: 400 }
            );
        }

        await PreferenceService.updateUserPreferences(companyId, userId, preferences, groupId ?? undefined);

        return NextResponse.json({
            success: true,
            message: 'Preferences updated successfully',
        });

    } catch (error: any) {
        console.error('[Preferences API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
