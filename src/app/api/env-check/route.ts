import { NextResponse } from 'next/server';

export async function GET() {
    const key = process.env.SENDGRID_API_KEY || '';
    return NextResponse.json({
        fromEmail: process.env.SENDGRID_FROM_EMAIL,
        apiKeyPrefix: key.substring(0, 5),
        apiKeyLength: key.length,
        twilioFrom: process.env.TWILIO_FROM_NUMBER
    });
}
