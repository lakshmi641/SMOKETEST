'use client';

import React from 'react';
import {
    Mail,
    MessageSquare,
    Plus,
    MoreVertical,
    Clock,
    CheckCircle2,
    AlertCircle,
    Copy,
    Archive,
    Star,
    Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import type { CompanyTemplate } from '@/types/external-notifications';

export function TemplateList({
    templates,
    onEdit,
    onCreateNew
}: {
    templates: CompanyTemplate[];
    onEdit: (template: CompanyTemplate) => void;
    onCreateNew: (type: 'email' | 'whatsapp') => void;
}) {
    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            approved: 'bg-green-100 text-green-800 border-green-200',
            pending_approval: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            rejected: 'bg-red-100 text-red-800 border-red-200',
            draft: 'bg-gray-100 text-gray-800 border-gray-200'
        };
        return (
            <Badge variant="outline" className={`text-[10px] font-semibold uppercase px-2 py-0 rounded-md border ${variants[status] || variants.draft}`}>
                {status.replace('_', ' ')}
            </Badge>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Notification Templates</h1>
                    <p className="text-sm text-gray-500">Manage your Email and WhatsApp notification flows.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => onCreateNew('email')}
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        <Mail className="w-4 h-4" />
                        New Email
                    </Button>
                    <Button
                        onClick={() => onCreateNew('whatsapp')}
                        className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <MessageSquare className="w-4 h-4" />
                        New WhatsApp
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template, index) => (
                    <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <Card
                            className="group border border-gray-200 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer overflow-hidden bg-white"
                            onClick={() => onEdit(template)}
                        >
                            <CardContent className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 rounded-lg ${template.type === 'email' ? 'bg-gray-100 text-gray-600' : 'bg-primary/10 text-primary'}`}>
                                        {template.type === 'email' ? <Mail className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem className="gap-2">
                                                <Copy className="w-4 h-4" /> Duplicate
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="gap-2 text-red-600">
                                                <Archive className="w-4 h-4" /> Archive
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-primary transition-colors">
                                            {template.name}
                                        </h3>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {getStatusBadge(template.status)}
                                        {template.isDefault && (
                                            <Badge variant="secondary" className="text-[10px] font-medium bg-gray-900 text-white border-none py-0">
                                                Default
                                            </Badge>
                                        )}
                                    </div>

                                    <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
                                        {template.language.replace('_', ' ')} • v{template.version}.0
                                    </p>
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-tighter">
                                        {template.externalId ? 'Sync Active' : 'Local Only'}
                                    </span>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                                        <Settings className="w-3 h-3" /> PREVIEW
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}

                {templates.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-100 rounded-xl">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                            <MessageSquare className="w-8 h-8 text-gray-300" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">No templates yet</h2>
                        <p className="text-gray-500 text-sm mb-8 max-w-xs">Create your first Email or WhatsApp template to start notifying your users.</p>
                        <div className="flex gap-4">
                            <Button
                                variant="outline"
                                onClick={() => onCreateNew('email')}
                                className="gap-2"
                            >
                                <Mail className="w-4 h-4" />
                                Email
                            </Button>
                            <Button
                                onClick={() => onCreateNew('whatsapp')}
                                className="gap-2 bg-primary text-primary-foreground"
                            >
                                <Plus className="w-4 h-4" />
                                WhatsApp
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
