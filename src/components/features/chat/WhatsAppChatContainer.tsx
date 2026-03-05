'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    addDoc,
    doc,
    updateDoc,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCompanyId } from '@/contexts/CompanyContext';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Phone, User, MoreVertical, Paperclip, MessageSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { ChatConversation, ChatMessage } from '@/types/external-notifications';

export function WhatsAppChatContainer() {
    const companyId = useCompanyId();
    const { user } = useAuthStore();

    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Refs for auto-scroll
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Listen for Conversations
    useEffect(() => {
        if (!companyId) return;

        const q = query(
            collection(db, 'companies', companyId, 'conversations'),
            orderBy('updatedAt', 'desc') // Show recent first
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const convs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ChatConversation));
            setConversations(convs);
        });

        return () => unsubscribe();
    }, [companyId]);

    // 2. Listen for Messages when Chat Selected
    useEffect(() => {
        if (!companyId || !selectedChat) {
            setMessages([]);
            return;
        }

        // Reset unread count
        if (selectedChat.unreadCount > 0) {
            updateDoc(doc(db, 'companies', companyId, 'conversations', selectedChat.id), {
                unreadCount: 0
            }).catch(console.error);
        }

        const q = query(
            collection(db, 'companies', companyId, 'conversations', selectedChat.id, 'messages'),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ChatMessage));
            setMessages(msgs);
            // Scroll to bottom
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });

        return () => unsubscribe();
    }, [companyId, selectedChat?.id]); // Note: depend on ID, not object to avoid loops

    // 3. Handle Send Message
    const handleSend = async () => {
        if (!inputText.trim() || !companyId || !selectedChat) return;

        const messageBody = inputText.trim();
        setInputText(''); // Optimistic clear

        try {
            // A. Call Send API (Twilio)
            const response = await fetch('/api/external-notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId,
                    eventType: 'system_announcement', // Generic type for chat
                    channel: 'whatsapp',
                    recipientPhone: selectedChat.participantPhone,
                    messageBody: messageBody,
                    priority: 'medium'
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.channels?.whatsapp?.error || 'Failed to send');
            }

            const sid = result.channels.whatsapp.messageId;

            // B. Save to Firestore (Chat History)
            const now = new Date().toISOString();
            const newMessage: ChatMessage = {
                id: sid || `msg_${Date.now()}`,
                conversationId: selectedChat.id,
                companyId,
                direction: 'outbound',
                type: 'text',
                body: messageBody,
                status: 'sent',
                sid: sid,
                senderId: user?.id,
                timestamp: now
            };

            const messagesRef = collection(db, 'companies', companyId, 'conversations', selectedChat.id, 'messages');
            await setDoc(doc(messagesRef, newMessage.id), newMessage);

            // C. Update Conversation (Last Message)
            await updateDoc(doc(db, 'companies', companyId, 'conversations', selectedChat.id), {
                lastMessage: messageBody,
                lastMessageTimestamp: now,
                updatedAt: now
            });

        } catch (error: any) {
            console.error('Send failed:', error);
            toast.error('Failed to send message: ' + error.message);
            setInputText(messageBody); // Restore text
        }
    };

    return (
        <div className="flex h-[calc(100vh-100px)] border rounded-lg bg-background shadow-sm overflow-hidden">
            {/* SIDEBAR: CONVERSATION LIST */}
            <div className="w-1/3 border-r flex flex-col min-w-[300px]">
                <div className="p-4 border-b bg-muted/20">
                    <h2 className="font-semibold text-lg">Chats</h2>
                    <Input placeholder="Search..." className="mt-2" />
                </div>

                <ScrollArea className="flex-1">
                    <div className="divide-y">
                        {conversations.length === 0 && (
                            <div className="p-4 text-center text-muted-foreground">
                                No conversations yet.
                            </div>
                        )}
                        {conversations.map(conv => (
                            <div
                                key={conv.id}
                                onClick={() => setSelectedChat(conv)}
                                className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedChat?.id === conv.id ? 'bg-muted' : ''
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-sm truncate">
                                        {conv.participantName || conv.participantPhone}
                                    </span>
                                    {conv.lastMessageTimestamp && (
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(conv.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-muted-foreground truncate w-4/5">
                                        {conv.lastMessage}
                                    </p>
                                    {conv.unreadCount > 0 && (
                                        <span className="bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                            {conv.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* MAIN AREA: CHAT WINDOW */}
            <div className="flex-1 flex flex-col bg-slate-50">
                {selectedChat ? (
                    <>
                        {/* HEADER */}
                        <div className="p-4 bg-white border-b flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">{selectedChat.participantName || selectedChat.participantPhone}</h3>
                                    <p className="text-xs text-muted-foreground">WhatsApp</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon"><Phone className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </div>
                        </div>

                        {/* MESSAGES */}
                        <ScrollArea className="flex-1 p-4">
                            <div className="flex flex-col gap-4">
                                {messages.map((msg) => {
                                    const isOutbound = msg.direction === 'outbound';
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] p-3 rounded-lg text-sm ${isOutbound
                                                    ? 'bg-green-500 text-white rounded-tr-none'
                                                    : 'bg-white border text-gray-800 rounded-tl-none shadow-sm'
                                                    }`}
                                            >
                                                <p>{msg.body}</p>
                                                <div className={`text-[10px] mt-1 text-right ${isOutbound ? 'text-green-100' : 'text-gray-400'
                                                    }`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {isOutbound && (
                                                        <span className="ml-1">
                                                            {msg.status === 'sent' && '✓'}
                                                            {msg.status === 'delivered' && '✓✓'}
                                                            {msg.status === 'read' && <span className="text-blue-200">✓✓</span>}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>

                        {/* INPUT */}
                        <div className="p-4 bg-white border-t flex gap-2 items-center">
                            <Button variant="ghost" size="icon" className="text-muted-foreground">
                                <Paperclip className="h-5 w-5" />
                            </Button>
                            <Input
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Type a message..."
                                className="flex-1"
                            />
                            <Button
                                onClick={handleSend}
                                disabled={!inputText.trim() || isLoading}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-slate-50">
                        <MessageSquare className="h-16 w-16 mb-4 opacity-20" />

                        <p>Select a conversation to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
}

