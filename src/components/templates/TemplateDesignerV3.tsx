'use client';

import React, { useState, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Mail,
    MessageSquare,
    Plus,
    GripVertical,
    Settings2,
    Trash2,
    Type,
    Layout,
    Image as ImageIcon,
    FileText,
    MousePointer2,
    CheckCircle2,
    Clock,
    AlertCircle,
    Eye,
    Save,
    Send,
    X,
    Upload,
    Paperclip,
    ShieldCheck,
    Zap,
    ArrowLeft,
    Smartphone,
    ChevronLeft,
    Search,
    MoreHorizontal
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'framer-motion';
import type {
    CompanyTemplate,
    TemplateElement,
    TemplateType,
    EventType,
    Priority
} from '@/types/external-notifications';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

// --- Types ---

interface DesignerElement extends TemplateElement {
    id: string;
}

// --- Sortable Item Component ---

function SortableElement({
    element,
    isSelected,
    onClick,
    onDelete
}: {
    element: DesignerElement;
    isSelected: boolean;
    onClick: () => void;
    onDelete: (id: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: element.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 0,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onClick}
            className={`group relative flex items-start gap-3 p-4 rounded-lg border transition-all cursor-pointer ${isSelected
                ? 'bg-primary/5 border-primary ring-1 ring-primary/20 shadow-sm'
                : 'bg-white hover:border-gray-300 border-gray-200'
                }`}
        >
            <div
                {...attributes}
                {...listeners}
                className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
            >
                <GripVertical className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider py-0 px-1.5 h-4">
                        {element.type}
                    </Badge>
                </div>
                <p className="text-sm text-gray-700 font-medium leading-relaxed">
                    {element.content || <span className="text-gray-300 italic">Enter {element.type} content...</span>}
                </p>
            </div>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(element.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// --- WhatsApp Chat Preview Helper ---

function WhatsAppChatPreview({ elements }: { elements: TemplateElement[] }) {
    return (
        <div className="w-full h-full bg-[#E5DDD5] flex flex-col overflow-hidden relative">
            {/* WA Header */}
            <div className="bg-[#075E54] text-white p-3 flex items-center gap-3 shrink-0">
                <ChevronLeft className="w-5 h-5" />
                <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center bg-gray-400">
                        <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate leading-none mb-0.5">Autocracy Support</p>
                    <p className="text-[10px] opacity-70 leading-none">online</p>
                </div>
                <div className="flex items-center gap-3">
                    <Search className="w-4 h-4 opacity-70" />
                    <MoreHorizontal className="w-4 h-4 opacity-70" />
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
                <div className="max-w-[85%] bg-white rounded-lg shadow-sm p-3 relative ml-2 mt-2">
                    {/* Tail */}
                    <div className="absolute top-0 -left-1.5 w-3 h-3 bg-white clip-wa-tail" />

                    <div className="space-y-3">
                        {elements.map((el, i) => {
                            switch (el.type) {
                                case 'image':
                                    return el.content ? <img key={i} src={el.content} className="w-full rounded-md object-cover max-h-48" /> : <div key={i} className="w-full h-32 bg-gray-100 rounded-md flex items-center justify-center"><ImageIcon className="w-6 h-6 text-gray-300" /></div>;
                                case 'header':
                                    return <p key={i} className="text-[15px] font-bold text-gray-900 leading-tight">{el.content}</p>;
                                case 'body':
                                    return <p key={i} className="text-[14px] text-gray-800 whitespace-pre-wrap leading-normal font-medium">{el.content}</p>;
                                case 'button':
                                    return (
                                        <div key={i} className="mt-2 -mx-3 -mb-3 pt-3 border-t border-gray-100 flex items-center justify-center text-[#00A884] font-semibold text-sm hover:bg-gray-50 transition-colors py-2.5 rounded-b-lg">
                                            <Zap className="w-3.5 h-3.5 mr-2" />
                                            {el.content || 'Action'}
                                        </div>
                                    );
                                case 'footer':
                                    return <p key={i} className="text-[11px] text-gray-500 mt-1 opacity-80">{el.content}</p>;
                                default:
                                    return null;
                            }
                        })}
                    </div>

                    <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-gray-400">11:47 AM</span>
                        <CheckCircle2 className="w-3 h-3 text-[#4FC3F7] fill-current" />
                    </div>
                </div>
            </div>

            {/* Message Input Bottom */}
            <div className="bg-[#EFEEEF] p-2 flex items-center gap-2 shrink-0">
                <div className="bg-white rounded-full h-10 flex-1 flex items-center px-4 shadow-sm border border-gray-200">
                    <p className="text-gray-400 text-sm">Type a message</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#00897B] flex items-center justify-center shadow-md">
                    <Send className="w-4 h-4 text-white fill-current" />
                </div>
            </div>

            <style jsx>{`
        .clip-wa-tail {
          clip-path: polygon(100% 0, 0 0, 100% 100%);
        }
      `}</style>
        </div>
    );
}

// --- Phone Frame Component ---

function PhoneFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative mx-auto border-gray-900 bg-gray-900 border-[14px] rounded-[3rem] h-[680px] w-[320px] shadow-2xl overflow-hidden ring-4 ring-gray-800">
            {/* Notch */}
            <div className="w-[140px] h-7 bg-gray-900 top-0 left-1/2 -translate-x-1/2 absolute rounded-b-3xl z-30 flex items-center justify-center gap-2">
                <div className="w-10 h-1 bg-gray-800 rounded-full" />
                <div className="w-2 h-2 bg-gray-800 rounded-full" />
            </div>

            {/* Status Bar */}
            <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-8 pt-2 z-20 text-white text-[10px] font-bold">
                <span>11:47</span>
                <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                        <div className="w-0.5 h-1.5 bg-white" />
                        <div className="w-0.5 h-2 bg-white" />
                        <div className="w-0.5 h-2.5 bg-white" />
                        <div className="w-0.5 h-3 bg-white opacity-40" />
                    </div>
                    <Zap className="w-3 h-3 fill-current" />
                    <div className="w-5 h-2.5 border border-white/40 rounded-[1px] relative">
                        <div className="absolute inset-[1px] bg-white w-3" />
                    </div>
                </div>
            </div>

            <div className="h-[46px] w-[3px] bg-gray-900 absolute -left-[17px] top-[124px] rounded-l-lg" />
            <div className="h-[46px] w-[3px] bg-gray-900 absolute -left-[17px] top-[178px] rounded-l-lg" />
            <div className="h-[64px] w-[3px] bg-gray-900 absolute -right-[17px] top-[142px] rounded-r-lg" />

            <div className="rounded-[2.5rem] overflow-hidden w-full h-full bg-white relative">
                {children}
            </div>

            {/* Home Indicator */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-900/10 rounded-full z-20" />
        </div>
    );
}

// --- Main Designer Component ---

export function TemplateDesignerV3({
    companyId,
    groupId,
    templateType,
    initialTemplate,
    onSave
}: {
    companyId: string;
    groupId?: string | null;
    templateType: 'email' | 'whatsapp';
    initialTemplate?: CompanyTemplate;
    onSave: (template: Partial<CompanyTemplate>) => Promise<void>;
}) {
    const { user } = useAuthStore();
    const [template, setTemplate] = useState<Partial<CompanyTemplate>>(initialTemplate || {
        name: '',
        type: templateType,
        language: 'en_US',
        status: 'draft',
        isDefault: false,
        associatedEvents: [],
        design: {
            elements: [
                { id: 'initial-body', type: 'body', content: 'Hello {{userName}},\n\nUpdate regarding your task.' }
            ],
            attachments: []
        }
    });

    const [selectedElementId, setSelectedElementId] = useState<string | null>(template.design?.elements[0]?.id || null);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const elements = template.design?.elements || [];
    const selectedElement = elements.find(el => el.id === selectedElementId);

    // --- Handlers ---

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = elements.findIndex(el => el.id === active.id);
            const newIndex = elements.findIndex(el => el.id === over.id);
            const newElements = arrayMove(elements, oldIndex, newIndex);
            setTemplate({ ...template, design: { ...template.design!, elements: newElements } });
        }
    };

    const addElement = (type: TemplateElement['type']) => {
        const newId = `el-${Math.random().toString(36).substr(2, 9)}`;
        const newElement: DesignerElement = { id: newId, type, content: '', metadata: {} };
        setTemplate({ ...template, design: { ...template.design!, elements: [...elements, newElement] } });
        setSelectedElementId(newId);
    };

    const deleteElement = (id: string) => {
        const newElements = elements.filter(el => el.id !== id);
        setTemplate({ ...template, design: { ...template.design!, elements: newElements } });
        if (selectedElementId === id) setSelectedElementId(newElements[0]?.id || null);
    };

    const updateElement = (id: string, updates: Partial<DesignerElement>) => {
        const newElements = elements.map(el => el.id === id ? { ...el, ...updates } : el);
        setTemplate({ ...template, design: { ...template.design!, elements: newElements } });
    };

    const syncTemplate = (updates: Partial<CompanyTemplate>) => {
        setTemplate({ ...template, ...updates });
    };

    const handleApprovalRequest = async () => {
        if (!template.name) return toast.error('Name your template first');
        setIsSubmitting(true);
        const loadingToast = toast.loading('Sending to API for approval...');
        try {
            const endpoint = template.type === 'whatsapp' ? '/api/external-notifications/templates/whatsapp' : '/api/external-notifications/templates/email';
            const response = await fetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({ companyId, groupId: groupId ?? undefined, name: template.name, design: template.design, language: template.language, userId: user?.id, userName: user?.name })
            });
            const result = await response.json();
            if (result.success) {
                toast.success('Submitted! Awaiting official approval.', { id: loadingToast });
                const updatedTemplate = {
                    ...template,
                    id: result.templateId,
                    status: result.status,
                    externalId: result.externalId
                };
                setTemplate(updatedTemplate);
                await onSave(updatedTemplate);
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            toast.error(error.message || 'Submission failed', { id: loadingToast });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderEmailPreview = () => (
        <div className="mx-auto max-w-xl bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] flex flex-col">
            <div className="h-1 bg-primary" />
            <div className="p-8 flex-1 prose prose-sm max-w-none">
                {elements.map((el, i) => {
                    switch (el.type) {
                        case 'header': return <h2 key={i} className="text-xl font-bold text-gray-900 mb-4">{el.content}</h2>;
                        case 'body': return <p key={i} className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed mb-4">{el.content}</p>;
                        case 'footer': return <p key={i} className="text-xs text-gray-400 mt-6 pt-4 border-t">{el.content}</p>;
                        case 'button': return (
                            <div key={i} className="flex justify-start my-4">
                                <Button className="bg-primary text-primary-foreground h-9 px-6 rounded-md font-semibold text-xs uppercase tracking-wide">
                                    {el.content || 'Action'}
                                </Button>
                            </div>
                        );
                        case 'image': return (
                            <div key={i} className="w-full h-40 bg-gray-50 rounded-lg flex items-center justify-center mb-4 border border-gray-200">
                                {el.content ? <img src={el.content} className="w-full h-full object-cover rounded-lg" /> : <ImageIcon className="w-6 h-6 text-gray-300" />}
                            </div>
                        );
                        default: return null;
                    }
                })}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-white overflow-hidden">
            {/* Top Navbar */}
            <div className="h-14 border-b px-6 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-4">
                    <Badge variant="outline" className={`h-8 w-8 p-0 flex items-center justify-center rounded-lg ${template.type === 'email' ? 'bg-gray-50' : 'bg-primary/10 text-primary border-primary/20'}`}>
                        {template.type === 'email' ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </Badge>
                    <div className="flex flex-col">
                        <input
                            value={template.name}
                            onChange={(e) => syncTemplate({ name: e.target.value })}
                            placeholder="Template name..."
                            className="text-sm font-bold bg-transparent border-none focus:outline-none placeholder:text-gray-300 h-5"
                        />
                        <span className="text-[10px] items-center gap-1.5 flex font-semibold text-gray-400 tracking-wide uppercase">
                            {template.status?.replace('_', ' ') || 'Draft'} • {template.type}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsPreviewMode(!isPreviewMode)} className="h-8 text-[11px] font-bold uppercase tracking-wider">
                        {isPreviewMode ? 'Edit Mode' : 'View Preview'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onSave(template)} className="h-8 text-[11px] font-bold uppercase tracking-wider px-4">
                        Save Draft
                    </Button>
                    <Button
                        disabled={isSubmitting}
                        onClick={handleApprovalRequest}
                        size="sm"
                        className="h-8 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider px-6 rounded-md shadow-sm"
                    >
                        {isSubmitting ? 'Sending...' : 'Request Approval'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar */}
                {!isPreviewMode && (
                    <div className="w-72 border-r p-6 overflow-y-auto shrink-0 bg-gray-50/30">
                        <div className="space-y-10">
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Components</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { type: 'header', icon: <Layout className="w-4 h-4" />, label: 'Heading' },
                                        { type: 'body', icon: <Type className="w-4 h-4" />, label: 'Message' },
                                        { type: 'button', icon: <MousePointer2 className="w-4 h-4" />, label: 'Action' },
                                        { type: 'image', icon: <ImageIcon className="w-4 h-4" />, label: 'Image' },
                                        { type: 'footer', icon: <X className="w-4 h-4 rotate-45" />, label: 'Footer' },
                                    ].map((item) => (
                                        <button
                                            key={item.type}
                                            onClick={() => addElement(item.type as any)}
                                            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 bg-white hover:border-primary transition-all active:scale-[0.95]"
                                        >
                                            <div className="p-2 rounded-lg bg-gray-50 text-gray-400 transition-colors">
                                                {item.icon}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Settings</h4>
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                        <Label className="text-[11px] font-bold text-gray-600 uppercase">Set Default</Label>
                                        <Switch
                                            disabled={template.status !== 'approved'}
                                            checked={template.isDefault}
                                            onCheckedChange={(val) => syncTemplate({ isDefault: val })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-gray-400 uppercase">Language</Label>
                                        <Select value={template.language} onValueChange={(val) => syncTemplate({ language: val })}>
                                            <SelectTrigger className="rounded-lg h-9 text-xs font-semibold">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="en_US">English (US)</SelectItem>
                                                <SelectItem value="hi_IN">Hindi (IN)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Center: Canvas */}
                <div className="flex-1 overflow-y-auto p-12 bg-gray-100/50">
                    <motion.div
                        layout
                        className="w-full flex justify-center"
                    >
                        {isPreviewMode ? (
                            template.type === 'whatsapp' ? (
                                <PhoneFrame>
                                    <WhatsAppChatPreview elements={elements} />
                                </PhoneFrame>
                            ) : renderEmailPreview()
                        ) : (
                            <div className="mx-auto max-w-xl w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] flex flex-col">
                                <div className="h-1 bg-gray-100 group-hover:bg-primary transition-colors" />
                                <div className="p-8 flex-1">
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={elements}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-3">
                                                {elements.length === 0 && (
                                                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-100 rounded-lg">
                                                        <Smartphone className="w-8 h-8 text-gray-200 mb-2" />
                                                        <p className="text-xs text-gray-400 uppercase font-black tracking-widest">Build your notification</p>
                                                    </div>
                                                )}
                                                {elements.map((el) => (
                                                    <SortableElement
                                                        key={el.id}
                                                        element={el as DesignerElement}
                                                        isSelected={selectedElementId === el.id}
                                                        onClick={() => setSelectedElementId(el.id)}
                                                        onDelete={deleteElement}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Right Sidebar */}
                {!isPreviewMode && (
                    <div className="w-80 border-l p-8 overflow-y-auto shrink-0 bg-white">
                        {selectedElement ? (
                            <div className="space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                        <Settings2 className="w-4 h-4" />
                                    </div>
                                    <h4 className="font-bold text-gray-900 text-sm">Properties</h4>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-gray-400 uppercase font-extrabold tracking-widest pl-1">Content</Label>
                                        <textarea
                                            value={selectedElement.content}
                                            onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                                            className="w-full min-h-[220px] p-4 text-xs bg-gray-50 border rounded-lg focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium leading-relaxed"
                                            placeholder={`Draft ${selectedElement.type} content...`}
                                        />
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        <Label className="text-[10px] text-gray-400 uppercase font-extrabold tracking-widest pl-1">Personalization</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {['userName', 'taskTitle', 'dueDate', 'actionUrl'].map(token => (
                                                <Badge
                                                    key={token}
                                                    variant="secondary"
                                                    className="cursor-pointer hover:bg-primary hover:text-white py-1.5 px-3 text-[10px] rounded-md font-bold transition-all"
                                                    onClick={() => updateElement(selectedElement.id, { content: selectedElement.content + ` {{${token}}}` })}
                                                >
                                                    {`{{${token}}}`}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-6">
                                <div className="p-4 bg-gray-50 rounded-full mb-4">
                                    <MousePointer2 className="w-8 h-8 text-gray-400" />
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select element on canvas</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
