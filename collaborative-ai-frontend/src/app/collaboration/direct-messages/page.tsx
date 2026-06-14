'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
    Search,
    Plus,
    Send,
    Paperclip,
    X,
    ChevronLeft,
    Download,
    User,
    Mail,
    Shield,
    Clock,
    Activity,
    FileText,
    Image,
    FileSpreadsheet,
    MoreVertical,
    Check,
    CheckCheck,
    UserCheck,
    HelpCircle,
    Info,
    Hash,
    Pin,
    Trash2
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import './direct-messages.css';

interface Attachment {
    id?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
}

interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    createdAt: string;
    status: string; // 'sent' | 'delivered' | 'read'
    isPinned?: boolean;
    attachments: Attachment[];
    sender: {
        id: string;
        name: string;
        role: string;
    };
}

interface Conversation {
    id: string;
    type: string;
    updatedAt: string;
    name?: string | null;
    description?: string | null;
    partner: {
        id: string;
        name: string;
        email: string;
        role: string;
        online: boolean;
        lastActive: string | null;
    } | null;
    lastMessage: {
        id: string;
        content: string;
        senderId: string;
        createdAt: string;
        hasAttachments: boolean;
    } | null;
    unreadCount: number;
}

interface UserDirectory {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string | null;
    lastActive: string | null;
    online: boolean;
}

export default function DirectMessagesPage() {
    const { user, token } = useAuth();
    const { showToast } = useToast();

    // Data States
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [directoryUsers, setDirectoryUsers] = useState<UserDirectory[]>([]);

    // Loading & UI States
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(true);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

    // Search & Inputs
    const [convSearchQuery, setConvSearchQuery] = useState('');
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [messageText, setMessageText] = useState('');
    const [attachments, setAttachments] = useState<{ name: string; type: string; size: number; base64: string }[]>([]);
    const [uploading, setUploading] = useState(false);

    // New Channels & Pinning States
    const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelDescription, setNewChannelDescription] = useState('');
    const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
    const [loadingPinned, setLoadingPinned] = useState(false);
    const [msgSearchQuery, setMsgSearchQuery] = useState('');
    const [isMsgSearchOpen, setIsMsgSearchOpen] = useState(false);

    // User Mentions State
    const [mentionTrigger, setMentionTrigger] = useState<{ startIdx: number; currentIdx: number } | null>(null);
    const [mentionQuery, setMentionQuery] = useState('');
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

    // WebSocket / Real-Time States
    const [socketConnected, setSocketConnected] = useState(false);
    const [isPartnerTyping, setIsPartnerTyping] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Active conversation details computed
    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeChatId) || null;
    }, [conversations, activeChatId]);

    // Format Dates nicely
    const formatTime = (isoString: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateSeparator = (isoString: string) => {
        const date = new Date(isoString);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    };

    // Helper functions for new Slack features
    const fetchPinnedMessages = async () => {
        if (!activeChatId) return;
        setLoadingPinned(true);
        try {
            const data = await apiClient.get(`/collaboration/conversations/${activeChatId}/pinned`);
            if (data) {
                setPinnedMessages(data);
            }
        } catch (err) {
            console.error('Failed to fetch pinned messages:', err);
        } finally {
            setLoadingPinned(false);
        }
    };

    const handleTogglePin = async (messageId: string) => {
        try {
            const res = await apiClient.post(`/collaboration/messages/${messageId}/pin`, {});
            if (res) {
                const isPinned = res.isPinned;
                setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned } : m));
                showToast(isPinned ? 'Message pinned' : 'Message unpinned', 'success');
                fetchPinnedMessages();
            }
        } catch (err) {
            console.error('Failed to toggle pin message:', err);
            showToast('Failed to change pin status', 'error');
        }
    };

    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) return;
        try {
            const res = await apiClient.post('/collaboration/channels', {
                name: newChannelName,
                description: newChannelDescription
            });
            if (res) {
                setNewChannelName('');
                setNewChannelDescription('');
                setIsChannelModalOpen(false);
                showToast('Channel created successfully', 'success');
            }
        } catch (err) {
            console.error('Failed to create channel:', err);
            showToast('Failed to create channel', 'error');
        }
    };

    const handleDeleteChannel = async (channelId: string) => {
        if (!window.confirm('Are you sure you want to delete this channel? This will permanently delete all messages.')) {
            return;
        }
        try {
            await apiClient.delete(`/collaboration/channels/${channelId}`);
            showToast('Channel deleted successfully', 'success');
        } catch (err) {
            console.error('Failed to delete channel:', err);
            showToast('Failed to delete channel', 'error');
        }
    };

    // WebSocket connection initialization
    useEffect(() => {
        if (!token) return;

        let wsUrl = '';
        if (typeof window !== 'undefined') {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            wsUrl = isLocal
                ? `ws://localhost:5001?token=${token}`
                : `wss://collaborative-ai-platform.vercel.app/ws?token=${token}`;
        }

        const connectWebSocket = () => {
            console.log('Connecting to WebSocket...');
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket Connected');
                setSocketConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'welcome') {
                        console.log('Registered WebSocket connection with backend');
                    }

                    // Handle Message delivery
                    if (data.type === 'message') {
                        const newMsg = data.message as Message;

                        // If it belongs to currently open chat
                        if (newMsg.conversationId === activeChatId) {
                            setMessages(prev => [...prev, newMsg]);
                            // Read receipt API sync
                            apiClient.post(`/collaboration/conversations/${activeChatId}/read`, {}).catch(() => { });
                        } else {
                            // Increment unread count in conversations
                            setConversations(prev => prev.map(c => {
                                if (c.id === newMsg.conversationId) {
                                    return {
                                        ...c,
                                        unreadCount: c.unreadCount + 1,
                                        lastMessage: {
                                            id: newMsg.id,
                                            content: newMsg.content,
                                            senderId: newMsg.senderId,
                                            createdAt: newMsg.createdAt,
                                            hasAttachments: newMsg.attachments.length > 0
                                        },
                                        updatedAt: newMsg.createdAt
                                    };
                                }
                                return c;
                            }));
                        }
                    }

                    // Handle Message Read tick update (other user read my messages)
                    if (data.type === 'read') {
                        const { conversationId, readAt } = data;
                        if (conversationId === activeChatId) {
                            setMessages(prev => prev.map(msg => {
                                if (msg.senderId === user?.id && new Date(msg.createdAt) <= new Date(readAt)) {
                                    return { ...msg, status: 'read' };
                                }
                                return msg;
                            }));
                        }
                    }

                    // Handle presence updates
                    if (data.type === 'presence') {
                        const { userId, status } = data;
                        // Update in conversations list
                        setConversations(prev => prev.map(c => {
                            if (c.partner && c.partner.id === userId) {
                                return {
                                    ...c,
                                    partner: {
                                        ...c.partner,
                                        online: status === 'online',
                                        lastActive: status === 'offline' ? new Date().toISOString() : c.partner.lastActive
                                    }
                                };
                            }
                            return c;
                        }));

                        // Update in User Directory listing
                        setDirectoryUsers(prev => prev.map(u => {
                            if (u.id === userId) {
                                return {
                                    ...u,
                                    online: status === 'online',
                                    lastActive: status === 'offline' ? new Date().toISOString() : u.lastActive
                                };
                            }
                            return u;
                        }));
                    }

                    // Handle conversation created event
                    if (data.type === 'conversation_created') {
                        setConversations(prev => {
                            const exists = prev.some(c => c.id === data.conversation.id);
                            if (!exists) {
                                return [data.conversation, ...prev];
                            }
                            return prev;
                        });
                    }

                    // Handle conversation deleted event
                    if (data.type === 'conversation_deleted') {
                        const { conversationId } = data;
                        setConversations(prev => prev.filter(c => c.id !== conversationId));
                        if (activeChatId === conversationId) {
                            setActiveChatId(null);
                            showToast('This channel has been deleted by an administrator.', 'info');
                        }
                    }

                    // Handle conversation list preview updating
                    if (data.type === 'conversation_updated') {
                        const { conversationId, lastMessage } = data;
                        setConversations(prev => {
                            const updated = prev.map(c => {
                                if (c.id === conversationId) {
                                    return {
                                        ...c,
                                        lastMessage,
                                        updatedAt: lastMessage.createdAt
                                    };
                                }
                                return c;
                            });
                            // Re-sort conversation list by updatedAt
                            return [...updated].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                        });
                    }

                    // Handle typing updates
                    if (data.type === 'typing') {
                        const { conversationId, isTyping, senderId } = data;
                        if (conversationId === activeChatId && senderId !== user?.id) {
                            if (isTyping) {
                                if (senderId) {
                                    const typingUser = directoryUsers.find(u => u.id === senderId)?.name || 'Someone';
                                    setIsPartnerTyping(typingUser);
                                } else {
                                    setIsPartnerTyping(activeConversation?.partner?.name || 'Someone');
                                }
                            } else {
                                setIsPartnerTyping(null);
                            }
                        }
                    }

                    // Handle message pinned updates
                    if (data.type === 'message_pinned_updated') {
                        const { messageId, isPinned, conversationId } = data;
                        if (conversationId === activeChatId) {
                            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned } : m));
                            fetchPinnedMessages();
                        }
                    }

                } catch (err) {
                    console.error('Error parsing WebSocket message event:', err);
                }
            };

            ws.onclose = () => {
                console.log('WebSocket Closed. Attempting reconnect in 5s...');
                setSocketConnected(false);
                setTimeout(connectWebSocket, 5000);
            };

            ws.onerror = (err) => {
                console.error('WebSocket Error:', err);
            };
        };

        connectWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [token, activeChatId, user?.id]);

    // Fetch conversations list on load
    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const data = await apiClient.get('/collaboration/conversations');
                if (data) {
                    setConversations(data);
                }
            } catch (err) {
                console.error('Failed to load conversations:', err);
                showToast('Failed to fetch conversation list', 'error');
            } finally {
                setLoadingConvs(false);
            }
        };

        fetchConversations();
    }, [showToast]);

    // Fetch messages when active chat changes
    useEffect(() => {
        if (!activeChatId) {
            setMessages([]);
            return;
        }

        const fetchMessages = async () => {
            setLoadingMsgs(true);
            try {
                const data = await apiClient.get(`/collaboration/conversations/${activeChatId}/messages`);
                if (data) {
                    setMessages(data);

                    // Mark as read immediately
                    await apiClient.post(`/collaboration/conversations/${activeChatId}/read`, {});

                    // Clear local unread counts in sidebar list card
                    setConversations(prev => prev.map(c => {
                        if (c.id === activeChatId) {
                            return { ...c, unreadCount: 0 };
                        }
                        return c;
                    }));
                }
            } catch (err) {
                console.error('Failed to fetch messages:', err);
                showToast('Failed to fetch message history', 'error');
            } finally {
                setLoadingMsgs(false);
                setIsPartnerTyping(null);
                scrollToBottom();
            }
        };

        fetchMessages();
        fetchPinnedMessages();
    }, [activeChatId, showToast]);

    // Scroll to bottom helper
    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 100);
    };

    // Auto-scroll on new message entry
    useEffect(() => {
        scrollToBottom();
    }, [messages, isPartnerTyping]);

    // Load available users for New Chat Modal
    const loadDirectoryUsers = async () => {
        setLoadingUsers(true);
        try {
            const data = await apiClient.get('/collaboration/users');
            if (data) {
                setDirectoryUsers(data);
            }
        } catch (err) {
            console.error('Failed to load users:', err);
            showToast('Failed to retrieve user directory', 'error');
        } finally {
            setLoadingUsers(false);
        }
    };

    // Filter conversations Left Panel list based on search query
    const filteredConversations = useMemo(() => {
        return conversations.filter(c => {
            const q = convSearchQuery.toLowerCase();
            if (c.type === 'group') {
                return (
                    (c.name || '').toLowerCase().includes(q) ||
                    (c.description || '').toLowerCase().includes(q)
                );
            }
            if (!c.partner) return false;
            return (
                c.partner.name.toLowerCase().includes(q) ||
                c.partner.role.toLowerCase().includes(q) ||
                c.partner.email.toLowerCase().includes(q)
            );
        });
    }, [conversations, convSearchQuery]);

    const channels = useMemo(() => {
        return filteredConversations.filter(c => c.type === 'group');
    }, [filteredConversations]);

    const directMessages = useMemo(() => {
        return filteredConversations.filter(c => c.type === 'direct');
    }, [filteredConversations]);

    // Filter User Selector modal list based on search query
    const filteredDirectoryUsers = useMemo(() => {
        return directoryUsers.filter(u => {
            const q = userSearchQuery.toLowerCase();
            return (
                u.name.toLowerCase().includes(q) ||
                u.role.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q)
            );
        });
    }, [directoryUsers, userSearchQuery]);

    // Mentions helper to filter directory users
    const filteredMentionUsers = useMemo(() => {
        if (!mentionTrigger) return [];
        const q = mentionQuery.toLowerCase();
        return directoryUsers.filter(u => u.name.toLowerCase().includes(q));
    }, [directoryUsers, mentionTrigger, mentionQuery]);

    // Insert mention autocomplete helper
    const insertMention = (targetUser: UserDirectory) => {
        if (!mentionTrigger) return;
        const text = messageText;
        const before = text.substring(0, mentionTrigger.startIdx);
        const after = text.substring(mentionTrigger.currentIdx);
        const insertion = `@${targetUser.name} `;
        setMessageText(before + insertion + after);
        setMentionTrigger(null);

        setTimeout(() => {
            const textarea = document.querySelector('.dm-textarea') as HTMLTextAreaElement;
            if (textarea) {
                textarea.focus();
                const newCursorPos = before.length + insertion.length;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 50);
    };

    // Render message content with mentions & highlights styled
    const renderMessageContent = (content: string) => {
        if (!content) return '';

        const allUsers = [...directoryUsers, ...(user ? [user] : [])];
        const sortedUsers = [...allUsers].sort((a, b) => b.name.length - a.name.length);

        let parts: (string | React.ReactNode)[] = [content];

        for (const u of sortedUsers) {
            const mentionText = `@${u.name}`;
            const newParts: (string | React.ReactNode)[] = [];
            for (const part of parts) {
                if (typeof part !== 'string') {
                    newParts.push(part);
                    continue;
                }

                let currentStr = part;
                let idx = currentStr.indexOf(mentionText);
                while (idx !== -1) {
                    const before = currentStr.substring(0, idx);
                    if (before) {
                        newParts.push(before);
                    }
                    newParts.push(
                        <span key={`mention-${u.id}-${newParts.length}`} className="dm-mention-pill">
                            {mentionText}
                        </span>
                    );
                    currentStr = currentStr.substring(idx + mentionText.length);
                    idx = currentStr.indexOf(mentionText);
                }
                if (currentStr) {
                    newParts.push(currentStr);
                }
            }
            parts = newParts;
        }

        const fallbackRegex = /@([a-zA-Z0-9_]+)/g;
        let finalParts: (string | React.ReactNode)[] = [];
        for (const part of parts) {
            if (typeof part !== 'string') {
                finalParts.push(part);
                continue;
            }

            let lastIdx = 0;
            const matches = [...part.matchAll(fallbackRegex)];
            if (matches.length === 0) {
                finalParts.push(part);
                continue;
            }

            matches.forEach((match, matchIdx) => {
                const matchStr = match[0];
                const matchStart = match.index!;

                if (matchStart > lastIdx) {
                    finalParts.push(part.substring(lastIdx, matchStart));
                }

                finalParts.push(
                    <span key={`fallback-mention-${matchIdx}`} className="dm-mention-pill">
                        {matchStr}
                    </span>
                );

                lastIdx = matchStart + matchStr.length;
            });

            if (lastIdx < part.length) {
                finalParts.push(part.substring(lastIdx));
            }
        }

        if (msgSearchQuery.trim()) {
            const highlight = msgSearchQuery.toLowerCase();
            const highlightRegex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
            const highlightedParts: (string | React.ReactNode)[] = [];

            for (const part of finalParts) {
                if (typeof part !== 'string') {
                    highlightedParts.push(part);
                    continue;
                }

                const subParts = part.split(highlightRegex);
                subParts.forEach((subPart, subIdx) => {
                    if (highlightRegex.test(subPart)) {
                        highlightedParts.push(
                            <mark key={`highlight-${subIdx}`} className="dm-message-highlight">
                                {subPart}
                            </mark>
                        );
                    } else {
                        highlightedParts.push(subPart);
                    }
                });
            }
            return <>{highlightedParts}</>;
        }

        return <>{finalParts}</>;
    };

    // Start typing trigger
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setMessageText(value);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lastAtIdx = textBeforeCursor.lastIndexOf('@');

        if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(textBeforeCursor[lastAtIdx - 1]))) {
            const query = textBeforeCursor.substring(lastAtIdx + 1);
            if (!/\s/.test(query)) {
                if (mentionTrigger === null) {
                    loadDirectoryUsers();
                }
                setMentionTrigger({ startIdx: lastAtIdx, currentIdx: cursorPosition });
                setMentionQuery(query);
                setSelectedMentionIndex(0);
            } else {
                setMentionTrigger(null);
            }
        } else {
            setMentionTrigger(null);
        }

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        wsRef.current.send(JSON.stringify({
            type: 'typing',
            conversationId: activeChatId,
            recipientId: activeConversation?.type === 'direct' ? activeConversation.partner?.id : null,
            isTyping: true
        }));

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'typing',
                    conversationId: activeChatId,
                    recipientId: activeConversation?.type === 'direct' ? activeConversation.partner?.id : null,
                    isTyping: false
                }));
            }
        }, 2000);
    };

    // Send Message trigger
    const handleSendMessage = async () => {
        const text = messageText.trim();
        if (!text && attachments.length === 0) return;
        if (!activeChatId) return;

        try {
            setMessageText('');
            setAttachments([]);
            setMentionTrigger(null);

            let uploadedAttachments: Attachment[] = [];
            if (attachments.length > 0) {
                setUploading(true);
                for (const att of attachments) {
                    const res = await apiClient.post('/collaboration/upload', {
                        fileName: att.name,
                        fileType: att.type,
                        fileData: att.base64
                    });
                    if (res) {
                        uploadedAttachments.push({
                            fileName: res.fileName,
                            fileType: res.fileType,
                            fileSize: res.fileSize,
                            fileUrl: res.fileUrl
                        });
                    }
                }
                setUploading(false);
            }

            const resMsg = await apiClient.post(`/collaboration/conversations/${activeChatId}/messages`, {
                content: text,
                attachments: uploadedAttachments
            });

            if (resMsg) {
                setMessages(prev => [...prev, resMsg]);

                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'typing',
                        conversationId: activeChatId,
                        recipientId: activeConversation?.type === 'direct' ? activeConversation.partner?.id : null,
                        isTyping: false
                    }));
                }
            }
        } catch (err) {
            console.error('Failed to send message:', err);
            showToast('Failed to send message', 'error');
            setUploading(false);
        }
    };

    // Check textarea key combinations
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (mentionTrigger && filteredMentionUsers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedMentionIndex(prev => (prev + 1) % filteredMentionUsers.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedMentionIndex(prev => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(filteredMentionUsers[selectedMentionIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setMentionTrigger(null);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Convert local files to Base64
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const limitBytes = 10 * 1024 * 1024;

        Array.from(files).forEach(file => {
            if (file.size > limitBytes) {
                showToast(`File ${file.name} exceeds maximum 10MB size limit.`, 'info');
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64String = (reader.result as string).split(',')[1];
                setAttachments(prev => [
                    ...prev,
                    {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        base64: base64String
                    }
                ]);
            };
            reader.onerror = () => {
                showToast(`Failed to parse file: ${file.name}`, 'error');
            };
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleStartConversation = async (partnerId: string) => {
        try {
            setIsModalOpen(false);
            setUserSearchQuery('');

            const res = await apiClient.post('/collaboration/conversations', { partnerId });
            if (res) {
                const exists = conversations.some(c => c.id === res.id);
                if (!exists) {
                    setConversations(prev => [res, ...prev]);
                }
                setActiveChatId(res.id);
            }
        } catch (err) {
            console.error('Failed to start chat:', err);
            showToast('Failed to initialize conversation', 'error');
        }
    };

    const renderFileIcon = (fileType: string) => {
        const type = fileType.toLowerCase();
        if (type.includes('image')) return <Image size={24} className="text-blue-500 dm-attachment-icon" />;
        if (type.includes('excel') || type.includes('spreadsheet') || type.includes('csv')) {
            return <FileSpreadsheet size={24} className="text-green-500 dm-attachment-icon" />;
        }
        return <FileText size={24} className="text-purple-500 dm-attachment-icon" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Filter messages locally by query if search query exists
    const filteredMessages = useMemo(() => {
        if (!msgSearchQuery.trim()) return messages;
        const q = msgSearchQuery.toLowerCase();
        return messages.filter(m => (m.content || '').toLowerCase().includes(q));
    }, [messages, msgSearchQuery]);

    const groupedMessages = useMemo(() => {
        const groups: { date: string; messages: Message[] }[] = [];
        filteredMessages.forEach(msg => {
            const dateStr = formatDateSeparator(msg.createdAt);
            const existingGroup = groups.find(g => g.date === dateStr);
            if (existingGroup) {
                existingGroup.messages.push(msg);
            } else {
                groups.push({ date: dateStr, messages: [msg] });
            }
        });
        return groups;
    }, [filteredMessages]);

    const getInitials = (name: string) => {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        }
        return name[0].toUpperCase();
    };

    return (
        <div className="dm-container animate-fade-in">
            <div className={`dm-layout ${activeChatId ? 'chat-active' : ''}`}>

                {/* Left Panel: Group Channels & Direct Messages */}
                <div className="dm-left-panel">
                    <div className="dm-left-header">
                        <div className="dm-left-title-row">
                            <h2>Communication Hub</h2>
                        </div>
                        <div className="dm-search-wrapper">
                            <Search size={16} className="text-secondary" />
                            <input
                                type="text"
                                className="dm-search-input"
                                placeholder="Search channels or DMs..."
                                value={convSearchQuery}
                                onChange={(e) => setConvSearchQuery(e.target.value)}
                            />
                            {convSearchQuery && (
                                <X size={14} className="text-secondary cursor-pointer" onClick={() => setConvSearchQuery('')} />
                            )}
                        </div>
                    </div>

                    <div className="dm-conv-list">
                        {/* Channels Section */}
                        <div className="dm-section-header">
                            <span className="dm-section-title">CHANNELS</span>
                            {user?.role === 'Admin' && (
                                <button
                                    className="dm-section-action-btn"
                                    onClick={() => setIsChannelModalOpen(true)}
                                    title="Create Channel"
                                >
                                    <Plus size={14} />
                                </button>
                            )}
                        </div>
                        <div className="dm-section-items" style={{ marginBottom: '1.25rem' }}>
                            {loadingConvs ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                                    <div className="spinner" style={{ border: '2px solid var(--border-color)', borderTopColor: 'var(--primary-color)', width: '20px', height: '20px' }} />
                                </div>
                            ) : channels.length === 0 ? (
                                <div className="dm-section-empty">
                                    {convSearchQuery ? 'No channels found' : 'No channels available'}
                                </div>
                            ) : (
                                channels.map(c => {
                                    const isSelected = c.id === activeChatId;
                                    return (
                                        <div
                                            key={c.id}
                                            className={`dm-conv-card channel-card ${isSelected ? 'active' : ''}`}
                                            onClick={() => setActiveChatId(c.id)}
                                        >
                                            <div className="dm-channel-icon-wrapper">
                                                <Hash size={18} className="text-secondary" />
                                            </div>
                                            <div className="dm-card-info">
                                                <div className="dm-card-header">
                                                    <span className="dm-card-name">#{c.name}</span>
                                                    {c.lastMessage && (
                                                        <span className="dm-card-time">
                                                            {formatTime(c.lastMessage.createdAt)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="dm-card-preview-row">
                                                    <span className="dm-card-preview">
                                                        {c.lastMessage ? (
                                                            c.lastMessage.hasAttachments ? '📁 Sent a file' : c.lastMessage.content
                                                        ) : (
                                                            <span style={{ fontStyle: 'italic', opacity: 0.8 }}>No messages yet</span>
                                                        )}
                                                    </span>
                                                    {c.unreadCount > 0 && (
                                                        <span className="dm-card-badge">{c.unreadCount}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Direct Messages Section */}
                        <div className="dm-section-header">
                            <span className="dm-section-title">DIRECT MESSAGES</span>
                            <button
                                className="dm-section-action-btn"
                                onClick={() => {
                                    loadDirectoryUsers();
                                    setIsModalOpen(true);
                                }}
                                title="New DM"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        <div className="dm-section-items">
                            {loadingConvs ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                                    <div className="spinner" style={{ border: '2px solid var(--border-color)', borderTopColor: 'var(--primary-color)', width: '20px', height: '20px' }} />
                                </div>
                            ) : directMessages.length === 0 ? (
                                <div className="dm-section-empty">
                                    {convSearchQuery ? 'No DMs found' : 'No active DMs. Start one!'}
                                </div>
                            ) : (
                                directMessages.map(c => {
                                    if (!c.partner) return null;
                                    const isSelected = c.id === activeChatId;
                                    return (
                                        <div
                                            key={c.id}
                                            className={`dm-conv-card ${isSelected ? 'active' : ''}`}
                                            onClick={() => setActiveChatId(c.id)}
                                        >
                                            <div className="dm-avatar-wrapper">
                                                <div className="dm-avatar">
                                                    {getInitials(c.partner.name)}
                                                </div>
                                                <div className={`dm-status-dot ${c.partner.online ? 'online' : 'offline'}`} />
                                            </div>
                                            <div className="dm-card-info">
                                                <div className="dm-card-header">
                                                    <span className="dm-card-name">{c.partner.name}</span>
                                                    {c.lastMessage && (
                                                        <span className="dm-card-time">
                                                            {formatTime(c.lastMessage.createdAt)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="dm-card-preview-row">
                                                    <span className="dm-card-preview">
                                                        {c.lastMessage ? (
                                                            c.lastMessage.hasAttachments ? '📁 Sent a file' : c.lastMessage.content
                                                        ) : (
                                                            <span style={{ fontStyle: 'italic', opacity: 0.8 }}>No messages yet</span>
                                                        )}
                                                    </span>
                                                    {c.unreadCount > 0 && (
                                                        <span className="dm-card-badge">{c.unreadCount}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Center Panel: Active Chat */}
                <div className="dm-center-panel">
                    {activeChatId && activeConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="dm-center-header">
                                <div className="dm-header-userinfo">
                                    <button
                                        className="icon-btn dm-back-btn"
                                        onClick={() => setActiveChatId(null)}
                                        aria-label="Back to conversations"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>

                                    {activeConversation.type === 'group' ? (
                                        <>
                                            <div className="dm-channel-header-icon">
                                                <Hash size={20} />
                                            </div>
                                            <div className="dm-header-meta">
                                                <h3 className="dm-header-name">#{activeConversation.name}</h3>
                                                <span className="dm-header-role">
                                                    {activeConversation.description || 'Company-wide channel'}
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="dm-avatar-wrapper">
                                                <div className="dm-avatar">
                                                    {getInitials(activeConversation.partner?.name || '')}
                                                </div>
                                                <div className={`dm-status-dot ${activeConversation.partner?.online ? 'online' : 'offline'}`} />
                                            </div>
                                            <div className="dm-header-meta">
                                                <h3 className="dm-header-name">{activeConversation.partner?.name}</h3>
                                                <span className="dm-header-role">
                                                    {activeConversation.partner?.role}
                                                    {activeConversation.partner?.online ? (
                                                        <span className="dm-header-presence online">• online</span>
                                                    ) : (
                                                        <span className="dm-header-presence">
                                                            • last seen {activeConversation.partner?.lastActive ? formatDateSeparator(activeConversation.partner.lastActive) : 'offline'}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="dm-actions-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {isMsgSearchOpen ? (
                                        <div className="dm-header-search-box">
                                            <Search size={16} className="text-secondary" />
                                            <input
                                                type="text"
                                                className="dm-header-search-input"
                                                placeholder="Search messages..."
                                                value={msgSearchQuery}
                                                onChange={(e) => setMsgSearchQuery(e.target.value)}
                                                autoFocus
                                            />
                                            <button className="icon-btn" onClick={() => { setMsgSearchQuery(''); setIsMsgSearchOpen(false); }}>
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="icon-btn"
                                            onClick={() => setIsMsgSearchOpen(true)}
                                            title="Search Messages"
                                        >
                                            <Search size={20} />
                                        </button>
                                    )}

                                    <button
                                        className={`icon-btn ${isProfileOpen ? 'active' : ''}`}
                                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                                        title="Channel/User Details"
                                    >
                                        <Info size={20} />
                                    </button>

                                    <button
                                        className="icon-btn"
                                        onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                                        aria-label="Actions Menu"
                                    >
                                        <MoreVertical size={20} />
                                    </button>

                                    {isHeaderMenuOpen && (
                                        <div className="dm-dropdown-menu">
                                            <button
                                                className="dm-dropdown-item"
                                                onClick={() => {
                                                    setIsProfileOpen(!isProfileOpen);
                                                    setIsHeaderMenuOpen(false);
                                                }}
                                            >
                                                <Info size={16} />
                                                <span>{isProfileOpen ? 'Hide Details' : 'Show Details'}</span>
                                            </button>

                                            {activeConversation.type === 'group' && user?.role === 'Admin' && (
                                                <button
                                                    className="dm-dropdown-item danger"
                                                    onClick={() => {
                                                        handleDeleteChannel(activeConversation.id);
                                                        setIsHeaderMenuOpen(false);
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                    <span>Delete Channel</span>
                                                </button>
                                            )}

                                            <button
                                                className="dm-dropdown-item danger"
                                                onClick={() => {
                                                    setActiveChatId(null);
                                                    setIsHeaderMenuOpen(false);
                                                }}
                                            >
                                                <X size={16} />
                                                <span>Close Chat</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="dm-messages-area" ref={scrollRef}>
                                {loadingMsgs ? (
                                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                        <div className="spinner" style={{ border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', width: '32px', height: '32px' }} />
                                    </div>
                                ) : filteredMessages.length === 0 ? (
                                    <div className="dm-empty-chat" style={{ background: 'transparent' }}>
                                        <UserCheck size={48} style={{ opacity: 0.3, color: 'var(--primary-color)' }} />
                                        {msgSearchQuery ? (
                                            <>
                                                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>No messages match your search</h3>
                                                <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>Try searching for a different keyword.</p>
                                            </>
                                        ) : (
                                            <>
                                                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
                                                    {activeConversation.type === 'group' ? `Welcome to #${activeConversation.name}!` : `Say hello to ${activeConversation.partner?.name}!`}
                                                </h3>
                                                <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                                    {activeConversation.type === 'group'
                                                        ? 'This is the start of this channel conversation.'
                                                        : 'This is the beginning of your private message history.'}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    groupedMessages.map(group => (
                                        <div key={group.date} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div className="dm-date-separator">
                                                <span className="dm-date-text">{group.date}</span>
                                            </div>
                                            {group.messages.map(msg => {
                                                const isSelf = msg.senderId === user?.id;
                                                const showSenderHeader = !isSelf && activeConversation.type === 'group';

                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className={`dm-message-group ${isSelf ? 'sent' : 'received'}`}
                                                    >
                                                        <div className="dm-message-bubble-wrapper">
                                                            {showSenderHeader && (
                                                                <div className="dm-message-sender-info">
                                                                    <span className="dm-message-sender-name">{msg.sender?.name || 'User'}</span>
                                                                    <span className="dm-message-sender-role">({msg.sender?.role || 'Member'})</span>
                                                                </div>
                                                            )}
                                                            <div className="dm-message-content-row">
                                                                {isSelf && (
                                                                    <button
                                                                        className={`dm-message-action-btn ${msg.isPinned ? 'pinned' : ''}`}
                                                                        onClick={() => handleTogglePin(msg.id)}
                                                                        title={msg.isPinned ? "Unpin message" : "Pin message"}
                                                                    >
                                                                        <Pin size={14} style={{ transform: msg.isPinned ? 'none' : 'rotate(45deg)' }} />
                                                                    </button>
                                                                )}

                                                                <div className="dm-message-bubble-container">
                                                                    {msg.content && (
                                                                        <div className={`dm-message-bubble ${isSelf ? 'sent' : 'received'} ${msg.isPinned ? 'pinned' : ''}`}>
                                                                            {renderMessageContent(msg.content)}
                                                                        </div>
                                                                    )}

                                                                    {msg.attachments && msg.attachments.map(att => {
                                                                        const isImg = att.fileType.toLowerCase().includes('image');
                                                                        return (
                                                                            <div key={att.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                {isImg ? (
                                                                                    <div className="dm-image-preview">
                                                                                        <img
                                                                                            src={att.fileUrl}
                                                                                            alt={att.fileName}
                                                                                            onClick={() => window.open(att.fileUrl, '_blank')}
                                                                                        />
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="dm-attachment-card">
                                                                                        {renderFileIcon(att.fileType)}
                                                                                        <div className="dm-attachment-info">
                                                                                            <span className="dm-attachment-name" title={att.fileName}>
                                                                                                {att.fileName}
                                                                                            </span>
                                                                                            <span className="dm-attachment-size">
                                                                                                {formatFileSize(att.fileSize)}
                                                                                            </span>
                                                                                        </div>
                                                                                        <a
                                                                                            href={att.fileUrl}
                                                                                            download={att.fileName}
                                                                                            className="dm-attachment-btn"
                                                                                            title="Download file"
                                                                                        >
                                                                                            <Download size={14} />
                                                                                        </a>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {!isSelf && (
                                                                    <button
                                                                        className={`dm-message-action-btn ${msg.isPinned ? 'pinned' : ''}`}
                                                                        onClick={() => handleTogglePin(msg.id)}
                                                                        title={msg.isPinned ? "Unpin message" : "Pin message"}
                                                                    >
                                                                        <Pin size={14} style={{ transform: msg.isPinned ? 'none' : 'rotate(45deg)' }} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="dm-message-footer">
                                                                {msg.isPinned && (
                                                                    <span className="dm-pinned-indicator" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--primary-color)', marginRight: '4px' }}>
                                                                        <Pin size={10} style={{ transform: 'none' }} /> pinned
                                                                    </span>
                                                                )}
                                                                <span>{formatTime(msg.createdAt)}</span>
                                                                {isSelf && (
                                                                    <span className={`dm-status-ticks ${msg.status === 'read' ? 'read' : ''}`}>
                                                                        {msg.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} />}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Typing Indicator banner */}
                            {isPartnerTyping && (
                                <div className="dm-typing-banner">
                                    <div className="spinner" style={{ border: '2px solid var(--border-color)', borderTopColor: 'var(--primary-color)', width: '12px', height: '12px', marginRight: '6px' }} />
                                    <span>{isPartnerTyping} is typing...</span>
                                </div>
                            )}

                            {/* Chat Inputs */}
                            <div className="dm-input-area" style={{ position: 'relative' }}>
                                {/* Mentions autocomplete popup overlay */}
                                {mentionTrigger && filteredMentionUsers.length > 0 && (
                                    <div className="dm-mention-popover">
                                        {filteredMentionUsers.map((u, idx) => {
                                            const isSelected = idx === selectedMentionIndex;
                                            return (
                                                <div
                                                    key={u.id}
                                                    className={`dm-mention-item ${isSelected ? 'active' : ''}`}
                                                    onClick={() => insertMention(u)}
                                                >
                                                    <span className="dm-mention-avatar">
                                                        {getInitials(u.name)}
                                                    </span>
                                                    <div className="dm-mention-info">
                                                        <span className="dm-mention-name">{u.name}</span>
                                                        <span className="dm-mention-role">{u.role}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {attachments.length > 0 && (
                                    <div className="dm-previews-row">
                                        {attachments.map((att, idx) => (
                                            <div key={idx} className="dm-file-preview-pill">
                                                <FileText size={12} />
                                                <span>{att.name} ({formatFileSize(att.size)})</span>
                                                <X
                                                    size={12}
                                                    className="dm-remove-preview-btn"
                                                    onClick={() => handleRemoveAttachment(idx)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="dm-input-row">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleFileSelect}
                                        multiple
                                    />
                                    <button
                                        className="dm-input-btn icon-btn"
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Attach File"
                                        disabled={uploading}
                                    >
                                        <Paperclip size={20} />
                                    </button>

                                    <div className="dm-textarea-wrapper">
                                        <textarea
                                            className="dm-textarea"
                                            rows={1}
                                            placeholder="Type a message... (Use @ to mention)"
                                            value={messageText}
                                            onChange={handleTextareaChange}
                                            onKeyDown={handleKeyDown}
                                            disabled={uploading}
                                        />
                                    </div>

                                    <button
                                        className="dm-input-btn icon-btn"
                                        style={{ color: 'var(--primary-color)' }}
                                        onClick={handleSendMessage}
                                        disabled={uploading || (!messageText.trim() && attachments.length === 0)}
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="dm-empty-chat">
                            <div style={{ padding: '2rem', background: 'var(--primary-light)', borderRadius: '50%', color: 'var(--primary-color)', marginBottom: '1rem' }}>
                                <User size={48} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Collaboration Messaging Hub</h3>
                            <p>Select a company channel or start a direct message with a platform team member.</p>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                {user?.role === 'Admin' && (
                                    <Button
                                        onClick={() => setIsChannelModalOpen(true)}
                                        icon={<Plus size={16} />}
                                    >
                                        Create Channel
                                    </Button>
                                )}
                                <Button
                                    onClick={() => {
                                        loadDirectoryUsers();
                                        setIsModalOpen(true);
                                    }}
                                    icon={<User size={16} />}
                                    variant="secondary"
                                >
                                    Start New DM
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: User / Channel details & Pinned Messages */}
                {activeChatId && activeConversation && isProfileOpen && (
                    <div className="dm-right-panel">
                        {activeConversation.type === 'group' ? (
                            <>
                                <div className="dm-right-avatar channel-avatar">
                                    <Hash size={36} />
                                </div>
                                <div className="dm-right-header">
                                    <h3 className="dm-right-name">#{activeConversation.name}</h3>
                                    <span className="dm-right-role">Group Channel</span>
                                </div>

                                <div className="dm-right-details">
                                    {activeConversation.description && (
                                        <div className="dm-right-detail-item">
                                            <span className="dm-right-detail-label">Description</span>
                                            <span className="dm-right-detail-value" style={{ marginTop: '0.25rem', display: 'block', fontStyle: 'italic' }}>
                                                {activeConversation.description}
                                            </span>
                                        </div>
                                    )}

                                    <div className="dm-right-detail-item">
                                        <span className="dm-right-detail-label">Organization ID</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <Shield size={14} className="text-secondary" />
                                            <span className="dm-right-detail-value">{user?.organizationId}</span>
                                        </div>
                                    </div>

                                    {user?.role === 'Admin' && (
                                        <div className="dm-right-detail-item" style={{ marginTop: '0.5rem' }}>
                                            <Button
                                                variant="danger"
                                                onClick={() => handleDeleteChannel(activeConversation.id)}
                                                icon={<Trash2 size={14} />}
                                                style={{ width: '100%', justifyContent: 'center' }}
                                            >
                                                Delete Channel
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="dm-right-avatar">
                                    {getInitials(activeConversation.partner?.name || '')}
                                </div>
                                <div className="dm-right-header">
                                    <h3 className="dm-right-name">{activeConversation.partner?.name}</h3>
                                    <span className="dm-right-role">{activeConversation.partner?.role}</span>
                                </div>

                                <div className="dm-right-details">
                                    <div className="dm-right-detail-item">
                                        <span className="dm-right-detail-label">Email Address</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <Mail size={14} className="text-secondary" />
                                            <span className="dm-right-detail-value">{activeConversation.partner?.email}</span>
                                        </div>
                                    </div>

                                    <div className="dm-right-detail-item">
                                        <span className="dm-right-detail-label">Organization ID</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <Shield size={14} className="text-secondary" />
                                            <span className="dm-right-detail-value">{user?.organizationId}</span>
                                        </div>
                                    </div>

                                    <div className="dm-right-detail-item">
                                        <span className="dm-right-detail-label">Presence Status</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <Activity size={14} className="text-secondary" />
                                            <span className="dm-right-detail-value" style={{ textTransform: 'capitalize' }}>
                                                {activeConversation.partner?.online ? 'Online now' : 'Offline'}
                                            </span>
                                        </div>
                                    </div>

                                    {!activeConversation.partner?.online && activeConversation.partner?.lastActive && (
                                        <div className="dm-right-detail-item">
                                            <span className="dm-right-detail-label">Last Seen</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                <Clock size={14} className="text-secondary" />
                                                <span className="dm-right-detail-value">
                                                    {formatDateSeparator(activeConversation.partner.lastActive)} at {formatTime(activeConversation.partner.lastActive)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Pinned Messages Section */}
                        <div className="dm-right-pinned-section">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <Pin size={16} className="text-secondary" style={{ transform: 'rotate(45deg)' }} />
                                <span className="dm-right-detail-label" style={{ marginBottom: 0 }}>Pinned Messages ({pinnedMessages.length})</span>
                            </div>

                            {loadingPinned ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                                    <div className="spinner" style={{ border: '2px solid var(--border-color)', borderTopColor: 'var(--primary-color)', width: '18px', height: '18px' }} />
                                </div>
                            ) : pinnedMessages.length === 0 ? (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                                    No pinned messages in this chat
                                </div>
                            ) : (
                                <div className="dm-pinned-list">
                                    {pinnedMessages.map(m => (
                                        <div key={m.id} className="dm-pinned-item">
                                            <div className="dm-pinned-item-header">
                                                <span className="dm-pinned-item-author">{m.sender?.name || 'User'}</span>
                                                <span className="dm-pinned-item-time">{formatTime(m.createdAt)}</span>
                                            </div>
                                            <p className="dm-pinned-item-content">{m.content}</p>
                                            {m.attachments && m.attachments.length > 0 && (
                                                <span className="dm-pinned-item-attachments">📁 {m.attachments.length} file(s)</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Create Channel */}
            <Modal
                isOpen={isChannelModalOpen}
                onClose={() => {
                    setIsChannelModalOpen(false);
                    setNewChannelName('');
                    setNewChannelDescription('');
                }}
                title="Create a New Channel"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                    <div className="dm-form-group">
                        <label className="dm-form-label">Channel Name</label>
                        <div className="dm-search-wrapper" style={{ marginTop: '0.25rem' }}>
                            <span className="text-secondary" style={{ fontSize: '1rem', fontWeight: 600, paddingRight: '4px' }}>#</span>
                            <input
                                type="text"
                                className="dm-search-input"
                                placeholder="e.g. sprint-planning"
                                value={newChannelName}
                                onChange={(e) => setNewChannelName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="dm-form-group">
                        <label className="dm-form-label">Description (Optional)</label>
                        <div className="dm-textarea-wrapper" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem' }}>
                            <textarea
                                className="dm-textarea"
                                rows={2}
                                placeholder="What is this channel about?"
                                value={newChannelDescription}
                                onChange={(e) => setNewChannelDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setIsChannelModalOpen(false);
                                setNewChannelName('');
                                setNewChannelDescription('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateChannel}
                            disabled={!newChannelName.trim()}
                        >
                            Create Channel
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Modal: New Chat User Directory Selector */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setUserSearchQuery('');
                }}
                title="Start a New Conversation"
            >
                <div className="dm-search-wrapper" style={{ marginBottom: '1rem' }}>
                    <Search size={16} className="text-secondary" />
                    <input
                        type="text"
                        className="dm-search-input"
                        placeholder="Search by name, role, email..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                    />
                </div>

                <div className="dm-modal-user-list">
                    {loadingUsers ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                            <div className="spinner" style={{ border: '2px solid var(--border-color)', borderTopColor: 'var(--primary-color)', width: '24px', height: '24px' }} />
                        </div>
                    ) : filteredDirectoryUsers.length === 0 ? (
                        <div className="text-center" style={{ color: 'var(--text-secondary)', padding: '1.5rem', fontSize: '0.825rem' }}>
                            No users match your criteria
                        </div>
                    ) : (
                        filteredDirectoryUsers.map(u => (
                            <div
                                key={u.id}
                                className="dm-modal-user-item"
                                onClick={() => handleStartConversation(u.id)}
                            >
                                <div className="dm-avatar-wrapper">
                                    <div className="dm-avatar">
                                        {getInitials(u.name)}
                                    </div>
                                    <div className={`dm-status-dot ${u.online ? 'online' : 'offline'}`} />
                                </div>
                                <div className="dm-modal-user-info">
                                    <span className="dm-modal-user-name">{u.name}</span>
                                    <span className="dm-modal-user-role">{u.role}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Modal>
        </div>
    );
}
