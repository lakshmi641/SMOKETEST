'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WhatsAppChatContainer } from '@/components/features/chat/WhatsAppChatContainer';

export default function ChatPage() {
    return (
        <DashboardLayout>
            <div className="h-full flex flex-col">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">
                        WhatsApp Messages
                    </h1>
                    <p className="text-gray-600">
                        Communicate directly with users via WhatsApp.
                    </p>
                </div>

                <WhatsAppChatContainer />
            </div>
        </DashboardLayout>
    );
}
