
// Mock next/server BEFORE import to avoid Request/Response env issues
jest.mock('next/server', () => ({
    NextRequest: class { },
    NextResponse: {
        json: (body: any) => body
    }
}));

import { sendNotification } from '../../lib/sendNotification';
import sgMail from '@sendgrid/mail';
import twilio from 'twilio';

// Mock dependencies
jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue([{ statusCode: 202, body: {} }]),
}));


// Mock Twilio
jest.mock('twilio', () => {
    const createMock = jest.fn().mockResolvedValue({ sid: 'SM123' });
    const twilioMock = jest.fn(() => ({
        messages: { create: createMock }
    }));
    // Attach the mock function to the default export so we can access it in tests
    (twilioMock as any).mockCreate = createMock;
    return twilioMock;
});

describe('API Gateway (Stage 2) Core Logic', () => {
    const DEFAULT_REQ = {
        companyId: 'test-company',
        recipientUserId: 'user-1',
        eventType: 'task_assigned' as const,
        messageBody: 'Test Message',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SENDGRID_API_KEY = 'SG.TEST';
        process.env.SENDGRID_FROM_EMAIL = 'test@example.com';
        process.env.TWILIO_ACCOUNT_SID = 'AC_TEST';
        process.env.TWILIO_AUTH_TOKEN = 'AUTH_TEST';
        process.env.TWILIO_FROM_NUMBER = '+1234567890';
    });

    // --------------------------------------------------------------------------
    // TEST CASE 1: Validation
    // --------------------------------------------------------------------------
    it('Should fail if recipient email is missing for email channel', async () => {
        const data = await sendNotification({
            ...DEFAULT_REQ,
            channel: 'email',
            // recipientEmail missing
        });

        expect(data.channels.email?.sent).toBe(false);
        expect(data.channels.email?.error).toContain('missing');
    });

    it('Should fail if recipient phone is missing for whatsapp channel', async () => {
        const data = await sendNotification({
            ...DEFAULT_REQ,
            channel: 'whatsapp',
            // recipientPhone missing
        });

        expect(data.channels.whatsapp?.sent).toBe(false);
        expect(data.channels.whatsapp?.error).toContain('missing');
    });

    // --------------------------------------------------------------------------
    // TEST CASE 2: Priority Logic (Email)
    // --------------------------------------------------------------------------
    it('Should add [HIGH] to email subject for task_assigned', async () => {
        await sendNotification({
            ...DEFAULT_REQ,
            channel: 'email',
            eventType: 'task_assigned', // Should trigger HIGH priority
            recipientEmail: 'test@test.com',
            subject: 'You have a task'
        });

        // Check SendGrid call arguments
        const sendArgs = (sgMail.send as jest.Mock).mock.calls[0][0];
        expect(sendArgs.subject).toBe('[HIGH] You have a task');
    });

    it('Should add [LOW] to email subject for comment_mention', async () => {
        await sendNotification({
            ...DEFAULT_REQ,
            channel: 'email',
            eventType: 'comment_mention', // Should trigger LOW priority
            recipientEmail: 'test@test.com',
            subject: 'You were mentioned'
        });

        const sendArgs = (sgMail.send as jest.Mock).mock.calls[0][0];
        expect(sendArgs.subject).toBe('[LOW] You were mentioned');
    });

    // --------------------------------------------------------------------------
    // TEST CASE 3: WhatsApp Logic
    // --------------------------------------------------------------------------
    it('Should format phone numbers correct for Twilio', async () => {
        await sendNotification({
            ...DEFAULT_REQ,
            channel: 'whatsapp',
            recipientPhone: '+9876543210',
        });

        // Check Twilio call arguments
        const createArgs = (twilio as any).mockCreate.mock.calls[0][0];
        expect(createArgs.to).toBe('whatsapp:+9876543210');
        expect(createArgs.from).toBe('whatsapp:+1234567890');
    });

    // --------------------------------------------------------------------------
    // TEST CASE 4: Zero Failure (Isolation)
    // --------------------------------------------------------------------------
    it('Should send WhatsApp even if SendGrid fails (when channel is both)', async () => {
        // Make SendGrid fail
        (sgMail.send as jest.Mock).mockRejectedValueOnce(new Error('SendGrid Down'));

        const data = await sendNotification({
            ...DEFAULT_REQ,
            channel: 'both',
            recipientEmail: 't@t.com',
            recipientPhone: '+111',
        });

        // Verification
        expect(data.channels.email?.sent).toBe(false);
        expect(data.channels.email?.error).toBe('SendGrid Down');

        expect(data.channels.whatsapp?.sent).toBe(true); // Should still succeed
        expect(data.success).toBe(true); // Overall success because 1 channel worked
    });
});
