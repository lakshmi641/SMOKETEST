export const dynamic = "force-dynamic"
/**
 * Twilio Webhook Handler
 * 
 * Receives inbound WhatsApp messages and status updates.
 * Stores them in Firestore under the appropriate Company > Conversation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    collectionGroup,
    addDoc,
    serverTimestamp
} from 'firebase/firestore';
import type { ChatMessage, ChatConversation } from '@/types/external-notifications';

export async function POST(req: NextRequest) {
    try {
        // Twilio sends data as application/x-www-form-urlencoded
        const formData = await req.formData();
        const body: any = {};
        formData.forEach((value, key) => {
            body[key] = value;
        });

        // Key Twilio Fields
        const from = body.From; // e.g. whatsapp:+1659...
        const to = body.To;     // e.g. whatsapp:+1415... (Our number)
        const messageBody = body.Body;
        const messageSid = body.MessageSid;
        const status = body.MessageStatus; // received, sent, delivered, etc.
        const numMedia = body.NumMedia ? parseInt(body.NumMedia) : 0;

        console.log(`[Twilio Webhook] Received from ${from}: ${messageBody?.substring(0, 50)}...`);

        // 1. Identify Company based on 'To' number
        // We use a Collection Group Query on 'tenantConfigs'
        // Index Requirement: tenantConfigs collection, field 'twilio.fromNumber'
        let companyId = '';

        try {
            const configsQuery = query(
                collectionGroup(db, 'tenantConfigs'),
                where('twilio.fromNumber', '==', to)
            );

            const configsSnapshot = await getDocs(configsQuery);

            if (!configsSnapshot.empty && configsSnapshot.docs.length > 0) {
                // Found the specific tenant config
                // The doc ref is companies/{companyId}/tenantConfigs/config
                // Parent.Parent is Company {companyId}
                const configDoc = configsSnapshot.docs[0];
                if (configDoc) {
                    const companyDocRef = configDoc.ref.parent.parent;
                    if (companyDocRef) {
                        companyId = companyDocRef.id;
                    }
                }
            }
        } catch (queryError) {
            console.warn('[Twilio Webhook] Tenant lookup failed (likely missing index):', queryError);
            // Continue to fallback
        }

        if (!companyId) {
            // Fallback: Check env var (Single Tenant Dev Mode)
            const envFrom = process.env.TWILIO_FROM_NUMBER;
            if (envFrom === to || !envFrom) {
                // For dev, if we only have one company, try to find first
                try {
                    const companiesSnap = await getDocs(collection(db, 'companies'));
                    if (!companiesSnap.empty && companiesSnap.docs[0]) {
                        companyId = companiesSnap.docs[0].id;
                        console.log(`[Twilio Webhook] Fallback: Assigned to first company ${companyId}`);
                    }
                } catch (fallbackError) {
                    console.error('[Twilio Webhook] Fallback failed:', fallbackError);
                }
            }
        }

        if (!companyId) {
            console.error(`[Twilio Webhook] Could not identify company for number ${to}`);
            return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
                headers: { 'Content-Type': 'text/xml' }
            });
        }

        // 2. Locate/Create Conversation
        // Path: companies/{companyId}/conversations/{from}
        const conversationId = from;
        const convRef = doc(db, 'companies', companyId, 'conversations', conversationId);

        // We will read it to get current state
        const convSnap = await getDoc(convRef);

        const now = new Date().toISOString();

        const conversationUpdate: Partial<ChatConversation> = {
            id: conversationId,
            companyId,
            participantPhone: from,
            lastMessage: messageBody || (numMedia > 0 ? '📷 Media' : 'Message'),
            lastMessageTimestamp: now,
            updatedAt: now,
        };

        let currentUnread = 0;
        if (convSnap.exists()) {
            currentUnread = convSnap.data().unreadCount || 0;
        } else {
            conversationUpdate.createdAt = now;
            conversationUpdate.status = 'open';
        }

        // Increment unread if inbound
        if (messageBody || numMedia > 0) {
            conversationUpdate.unreadCount = currentUnread + 1;
        }

        await setDoc(convRef, conversationUpdate, { merge: true });

        // 3. Add Message to Subcollection
        // Path: companies/{companyId}/conversations/{from}/messages
        const messagesRef = collection(db, 'companies', companyId, 'conversations', conversationId, 'messages');

        const newMessage: ChatMessage = {
            id: messageSid || `msg_${Date.now()}`,
            conversationId,
            companyId,
            direction: 'inbound',
            type: numMedia > 0 ? 'media' : 'text',
            body: messageBody || '',
            status: 'received',
            sid: messageSid,
            timestamp: now
        };

        if (messageBody || numMedia > 0) {
            await setDoc(doc(messagesRef, newMessage.id), newMessage);
        }

        // 4. Return TwiML (Empty Response)
        return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (error) {
        console.error('[Twilio Webhook] Error:', error);
        return new NextResponse('Error', { status: 500 });
    }
}
