'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useSearchParams } from 'next/navigation';
import {
    Search,
    Plus,
    Send,
    Paperclip,
    X,
    ChevronLeft,
    Download,
    Eye,
    User,
    Mail,
    Shield,
    Clock,
    Activity,
    FileText,
    Image,
    FileSpreadsheet,
    FileImage,
    MoreVertical,
    Check,
    CheckCheck,
    UserCheck,
    HelpCircle,
    Info,
    Hash,
    Pin,
    Trash2,
    Lock,
    Star,
    Bell,
    Pencil,
    Users,
    ChevronRight,
    Smile
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import './collaboration.css';

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
    reactions?: string | any[];
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
    isPrivate?: boolean;
    partner: {
        id: string;
        name: string;
        email: string;
        role: string;
        online: boolean;
        lastActive: string | null;
    } | null;
    participants: {
        id: string;
        name: string;
        email: string;
        role: string;
        online: boolean;
        lastActive: string | null;
    }[];
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

function CollaborationContent() {
    const { user, token } = useAuth();
    const { showToast } = useToast();
    const searchParams = useSearchParams();
    const tabParam = searchParams?.get('tab');

    // Data States
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [directoryUsers, setDirectoryUsers] = useState<UserDirectory[]>([]);

    // Loading & UI States
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [isNewDmModalOpen, setIsNewDmModalOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(true);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

    // Search & Inputs
    const [convSearchQuery, setConvSearchQuery] = useState('');
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [messageText, setMessageText] = useState('');
    const [attachments, setAttachments] = useState<{ name: string; type: string; size: number; base64: string }[]>([]);
    const [uploading, setUploading] = useState(false);

    // Sidebar View State
    const [activeSidebarTab, setActiveSidebarTab] = useState<'channels' | 'direct'>('channels');

    // Modals
    const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelDescription, setNewChannelDescription] = useState('');
    const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false);

    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [isEditChannelModalOpen, setIsEditChannelModalOpen] = useState(false);
    const [editChannelName, setEditChannelName] = useState('');
    const [editChannelDescription, setEditChannelDescription] = useState('');

    const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
    const [loadingPinned, setLoadingPinned] = useState(false);
    const [msgSearchQuery, setMsgSearchQuery] = useState('');
    const [isMsgSearchOpen, setIsMsgSearchOpen] = useState(false);

    // Emoji reaction popover state
    const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState<string | null>(null);

    // WebSocket Presence
    const [socketConnected, setSocketConnected] = useState(false);
    const [isPartnerTyping, setIsPartnerTyping] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync active tab state with query param
    useEffect(() => {
        if (tabParam === 'direct') {
            setActiveSidebarTab('direct');
            loadDirectoryUsers();
        } else if (tabParam === 'channels') {
            setActiveSidebarTab('channels');
        }
    }, [tabParam]);

    // Active conversation details computed
    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeChatId) || null;
    }, [conversations, activeChatId]);

    // Format Dates
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

    // Helper functions
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

    const handleToggleReaction = async (messageId: string, emoji: string) => {
        try {
            const res = await apiClient.post(`/collaboration/messages/${messageId}/react`, { emoji });
            if (res && res.success) {
                setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: res.reactions } : m));
                setActiveReactionPickerMessageId(null);
            }
        } catch (err) {
            console.error('Failed to toggle reaction:', err);
            showToast('Failed to toggle reaction', 'error');
        }
    };

    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) return;
        try {
            const res = await apiClient.post('/collaboration/channels', {
                name: newChannelName,
                description: newChannelDescription,
                isPrivate: newChannelIsPrivate
            });
            if (res) {
                setNewChannelName('');
                setNewChannelDescription('');
                setNewChannelIsPrivate(false);
                setIsChannelModalOpen(false);
                showToast('Channel created successfully', 'success');
                setActiveChatId(res.id);
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
            setActiveChatId(null);
        } catch (err) {
            console.error('Failed to delete channel:', err);
            showToast('Failed to delete channel', 'error');
        }
    };

    const handleAddMember = async (targetUserId: string) => {
        if (!activeChatId) return;
        try {
            await apiClient.post(`/collaboration/channels/${activeChatId}/members`, { userId: targetUserId });
            showToast('Member added successfully', 'success');
            setIsAddMemberModalOpen(false);
            const convsData = await apiClient.get('/collaboration/conversations');
            if (convsData) setConversations(convsData);
        } catch (err) {
            console.error('Failed to add member:', err);
            showToast('Failed to add member to channel', 'error');
        }
    };

    const handleUpdateChannel = async () => {
        if (!activeChatId || !editChannelName.trim()) return;
        try {
            await apiClient.patch(`/collaboration/channels/${activeChatId}`, {
                name: editChannelName,
                description: editChannelDescription
            });
            showToast('Channel updated successfully', 'success');
            setIsEditChannelModalOpen(false);
            const convsData = await apiClient.get('/collaboration/conversations');
            if (convsData) setConversations(convsData);
        } catch (err) {
            console.error('Failed to edit channel:', err);
            showToast('Failed to update channel details', 'error');
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

                    if (data.type === 'message') {
                        const newMsg = data.message as Message;
                        if (newMsg.conversationId === activeChatId) {
                            setMessages(prev => {
                                if (prev.some(m => m.id === newMsg.id)) return prev;
                                return [...prev, newMsg];
                            });
                            apiClient.post(`/collaboration/conversations/${activeChatId}/read`, {}).catch(() => { });
                        } else {
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

                    if (data.type === 'presence') {
                        const { userId, status } = data;
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

                      if (data.type === 'conversation_created') {
                          setConversations(prev => {
                              const exists = prev.some(c => c.id === data.conversation.id);
                              if (!exists) {
                                  return [data.conversation, ...prev];
                              }
                              return prev;
                          });
                      }

                      if (data.type === 'conversation_deleted') {
                          const { conversationId } = data;
                          setConversations(prev => prev.filter(c => c.id !== conversationId));
                          if (activeChatId === conversationId) {
                              setActiveChatId(null);
                              showToast('This channel has been deleted by an administrator.', 'info');
                          }
                      }

                      if (data.type === 'conversation_updated') {
                          const { conversationId, lastMessage, conversation, participants } = data;
                          setConversations(prev => {
                              const updated = prev.map(c => {
                                  if (c.id === conversationId) {
                                      return {
                                          ...c,
                                          ...(conversation || {}),
                                          participants: participants || c.participants || [],
                                          lastMessage: lastMessage || c.lastMessage,
                                          updatedAt: lastMessage ? lastMessage.createdAt : (conversation?.updatedAt || c.updatedAt)
                                      };
                                  }
                                  return c;
                              });
                              return [...updated].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                          });
                      }

                      if (data.type === 'typing') {
                          const { conversationId, isTyping, senderId } = data;
                          if (conversationId === activeChatId && senderId !== user?.id) {
                              if (isTyping) {
                                  const typingUser = directoryUsers.find(u => u.id === senderId)?.name || 'Someone';
                                  setIsPartnerTyping(typingUser);
                              } else {
                                  setIsPartnerTyping(null);
                              }
                          }
                      }

                      if (data.type === 'message_pinned_updated') {
                          const { messageId, isPinned, conversationId } = data;
                          if (conversationId === activeChatId) {
                              setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned } : m));
                              fetchPinnedMessages();
                          }
                      }

                      if (data.type === 'message_reaction_updated') {
                          const { messageId, reactions, conversationId } = data;
                          if (conversationId === activeChatId) {
                              setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
                          }
                      }

                  } catch (err) {
                      console.error('Error parsing WebSocket message event:', err);
                  }
              };

              ws.onclose = () => {
                  console.log('WebSocket Closed. Reconnecting in 5s...');
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
      }, [token, activeChatId, user?.id, directoryUsers]);

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
                      await apiClient.post(`/collaboration/conversations/${activeChatId}/read`, {});
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

      // Filter conversations list based on search query
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

      const channelsList = useMemo(() => {
          return filteredConversations.filter(c => c.type === 'group');
      }, [filteredConversations]);

      const publicChannels = useMemo(() => {
          return channelsList.filter(c => !c.isPrivate);
      }, [channelsList]);

      const privateChannels = useMemo(() => {
          return channelsList.filter(c => c.isPrivate);
      }, [channelsList]);

      const directMessagesList = useMemo(() => {
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

      // Format input keys
      const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          const value = e.target.value;
          setMessageText(value);

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
                  setMessages(prev => {
                      if (prev.some(m => m.id === resMsg.id)) return prev;
                      return [...prev, resMsg];
                  });

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

      const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
              setIsNewDmModalOpen(false);
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
          if (type.includes('image')) return <FileImage size={24} className="text-blue-500 dm-attachment-icon-svg" />;
          if (type.includes('excel') || type.includes('spreadsheet') || type.includes('csv') || type.includes('xlsx')) {
              return <FileSpreadsheet size={24} className="text-green-500 dm-attachment-icon-svg" />;
          }
          return <FileText size={24} className="text-purple-500 dm-attachment-icon-svg" />;
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

      // Shared Files Aggregation
      const sharedFiles = useMemo(() => {
          const files: { name: string; size: number; url: string; sender: string; type: string }[] = [];
          messages.forEach(msg => {
              if (msg.attachments && msg.attachments.length > 0) {
                  msg.attachments.forEach(att => {
                      if (!files.some(f => f.url === att.fileUrl)) {
                          files.push({
                              name: att.fileName,
                              size: att.fileSize,
                              url: att.fileUrl,
                              sender: msg.sender?.name || 'Unknown',
                              type: att.fileType
                          });
                      }
                  });
              }
          });
          return files;
      }, [messages]);

      return (
          <div className="dm-container animate-fade-in">
              <div className={`dm-layout ${activeChatId ? 'chat-active' : ''}`}>

                  {/* Left Panel: Channels & DMs */}
                  <div className="dm-left-panel-new">
                      <div className="dm-left-header-new">
                          <button 
                              className="dm-collaboration-title-btn" 
                              onClick={() => user?.role === 'Admin' && setIsChannelModalOpen(true)}
                              style={{ cursor: user?.role === 'Admin' ? 'pointer' : 'default' }}
                          >
                              {user?.role === 'Admin' && <Plus size={16} />}
                              <span>Collaboration</span>
                          </button>
                          <button 
                              className="dm-compose-btn" 
                              title="New DM"
                              onClick={() => {
                                  loadDirectoryUsers();
                                  setIsNewDmModalOpen(true);
                              }}
                          >
                              <Pencil size={16} />
                          </button>
                      </div>

                      <div className="dm-sidebar-tabs">
                          <button 
                              className={`dm-sidebar-tab ${activeSidebarTab === 'channels' ? 'active' : ''}`}
                              onClick={() => setActiveSidebarTab('channels')}
                          >
                              <Hash size={16} style={{ color: 'var(--primary-color)' }} />
                              <span>Channels</span>
                          </button>
                          <button 
                              className={`dm-sidebar-tab ${activeSidebarTab === 'direct' ? 'active' : ''}`}
                              onClick={() => {
                                  setActiveSidebarTab('direct');
                                  loadDirectoryUsers();
                              }}
                          >
                              <User size={16} />
                              <span>Direct Messages</span>
                              <ChevronRight size={14} className="dm-tab-chevron" />
                          </button>
                      </div>

                      <div className="dm-left-list-content">
                          {activeSidebarTab === 'channels' ? (
                              <>
                                  {/* Public Channels Section */}
                                  <div className="dm-section-header">
                                      <span className="dm-section-title">CHANNELS</span>
                                      {user?.role === 'Admin' && (
                                          <button className="dm-section-action-btn" onClick={() => { setNewChannelIsPrivate(false); setIsChannelModalOpen(true); }}>
                                              <Plus size={14} />
                                          </button>
                                      )}
                                  </div>
                                  <div className="dm-section-items">
                                      {loadingConvs ? (
                                          <div className="dm-loading-spinner-wrapper"><div className="dm-spinner-small" /></div>
                                      ) : publicChannels.length === 0 ? (
                                          <div className="dm-section-empty">No channels</div>
                                      ) : (
                                          publicChannels.map(c => {
                                              const isSelected = c.id === activeChatId;
                                              return (
                                                  <div 
                                                      key={c.id} 
                                                      className={`dm-conv-card-new ${isSelected ? 'active' : ''}`}
                                                      onClick={() => setActiveChatId(c.id)}
                                                  >
                                                      <div className="dm-channel-icon-wrapper">
                                                          <Hash size={16} className="dm-sidebar-icon" />
                                                      </div>
                                                      <div className="dm-conv-info-new">
                                                          <div className="dm-conv-row-1">
                                                              <span className="dm-conv-name-new">{c.name}</span>
                                                              {c.lastMessage && <span className="dm-conv-time-new">{formatTime(c.lastMessage.createdAt)}</span>}
                                                          </div>
                                                          <div className="dm-conv-row-2">
                                                              <span className="dm-conv-preview-new">
                                                                  {c.lastMessage ? (c.lastMessage.hasAttachments ? '📁 Sent a file' : c.lastMessage.content) : 'No messages'}
                                                              </span>
                                                              {c.unreadCount > 0 && <span className="dm-conv-badge-new">{c.unreadCount}</span>}
                                                          </div>
                                                      </div>
                                                  </div>
                                              );
                                          })
                                      )}
                                  </div>

                                  {/* Private Channels Section */}
                                  <div className="dm-section-header" style={{ marginTop: '1rem' }}>
                                      <span className="dm-section-title">PRIVATE CHANNELS</span>
                                      {user?.role === 'Admin' && (
                                          <button className="dm-section-action-btn" onClick={() => { setNewChannelIsPrivate(true); setIsChannelModalOpen(true); }}>
                                              <Plus size={14} />
                                          </button>
                                      )}
                                  </div>
                                  <div className="dm-section-items">
                                      {loadingConvs ? (
                                          <div className="dm-loading-spinner-wrapper"><div className="dm-spinner-small" /></div>
                                      ) : privateChannels.length === 0 ? (
                                          <div className="dm-section-empty">No private channels</div>
                                      ) : (
                                          privateChannels.map(c => {
                                              const isSelected = c.id === activeChatId;
                                              return (
                                                  <div 
                                                      key={c.id} 
                                                      className={`dm-conv-card-new ${isSelected ? 'active' : ''}`}
                                                      onClick={() => setActiveChatId(c.id)}
                                                  >
                                                      <div className="dm-channel-icon-wrapper">
                                                          <Lock size={14} className="dm-sidebar-icon private-icon" />
                                                      </div>
                                                      <div className="dm-conv-info-new">
                                                          <div className="dm-conv-row-1">
                                                              <span className="dm-conv-name-new">{c.name}</span>
                                                              {c.lastMessage && <span className="dm-conv-time-new">{formatTime(c.lastMessage.createdAt)}</span>}
                                                          </div>
                                                          <div className="dm-conv-row-2">
                                                              <span className="dm-conv-preview-new">
                                                                  {c.lastMessage ? (c.lastMessage.hasAttachments ? '📁 Sent a file' : c.lastMessage.content) : 'No messages'}
                                                              </span>
                                                              {c.unreadCount > 0 && <span className="dm-conv-badge-new">{c.unreadCount}</span>}
                                                          </div>
                                                      </div>
                                                  </div>
                                              );
                                          })
                                      )}
                                  </div>
                              </>
                          ) : (
                              <>
                                  {/* Direct Messages Section */}
                                  <div className="dm-section-header">
                                      <span className="dm-section-title">DIRECT MESSAGES</span>
                                      <button className="dm-section-action-btn" onClick={() => { loadDirectoryUsers(); setIsNewDmModalOpen(true); }}>
                                          <Plus size={14} />
                                      </button>
                                  </div>
                                  <div className="dm-section-items">
                                      {loadingConvs ? (
                                          <div className="dm-loading-spinner-wrapper"><div className="dm-spinner-small" /></div>
                                      ) : directMessagesList.length === 0 ? (
                                          <div className="dm-section-empty">No active DMs</div>
                                      ) : (
                                          directMessagesList.map(c => {
                                              if (!c.partner) return null;
                                              const isSelected = c.id === activeChatId;
                                              return (
                                                  <div 
                                                      key={c.id} 
                                                      className={`dm-conv-card-new ${isSelected ? 'active' : ''}`}
                                                      onClick={() => setActiveChatId(c.id)}
                                                  >
                                                      <div className="dm-avatar-wrapper-new">
                                                          <div className="dm-sidebar-avatar">{getInitials(c.partner.name)}</div>
                                                          <div className={`dm-sidebar-status ${c.partner.online ? 'online' : 'offline'}`} />
                                                      </div>
                                                      <div className="dm-conv-info-new">
                                                          <div className="dm-conv-row-1">
                                                              <span className="dm-conv-name-new">{c.partner.name}</span>
                                                              {c.lastMessage && <span className="dm-conv-time-new">{formatTime(c.lastMessage.createdAt)}</span>}
                                                          </div>
                                                          <div className="dm-conv-row-2">
                                                              <span className="dm-conv-preview-new">
                                                                  {c.lastMessage ? (c.lastMessage.hasAttachments ? '📁 Sent a file' : c.lastMessage.content) : 'No messages'}
                                                              </span>
                                                              {c.unreadCount > 0 && <span className="dm-conv-badge-new">{c.unreadCount}</span>}
                                                          </div>
                                                      </div>
                                                  </div>
                                              );
                                          })
                                      )}
                                  </div>
                              </>
                          )}
                      </div>
                  </div>

                  {/* Center Panel: Active Chat */}
                  <div className="dm-center-panel-new">
                      {activeChatId && activeConversation ? (
                          <>
                              {/* Chat Header */}
                              <div className="dm-center-header-new">
                                  <div className="dm-header-userinfo-new">
                                      <button className="icon-btn dm-back-btn" onClick={() => setActiveChatId(null)}>
                                          <ChevronLeft size={20} />
                                      </button>
                                      <div className="dm-header-avatar-wrapper-new" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                          <div className="dm-channel-icon-wrapper-header" style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99, 102, 241, 0.15)', flexShrink: 0, color: 'var(--primary-color)' }}>
                                              {activeConversation.type === 'group' ? (
                                                  activeConversation.isPrivate ? <Lock size={18} /> : <Hash size={18} />
                                              ) : (
                                                  <span style={{ fontWeight: 600, fontSize: '1rem' }}>{getInitials(activeConversation.partner?.name || '')}</span>
                                              )}
                                          </div>
                                          <div className="dm-header-meta-new">
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                  <span className="dm-header-chat-name" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                                                      {activeConversation.type === 'group' ? `#${activeConversation.name}` : activeConversation.partner?.name}
                                                  </span>
                                                  <Star size={16} className="dm-header-star-icon cursor-pointer text-secondary" style={{ color: 'var(--text-secondary)', fill: 'none' }} />
                                              </div>
                                              {activeConversation.type === 'group' ? (
                                                  <span className="dm-header-subtitle">
                                                      {activeConversation.description || 'Discuss business updates, strategy, and goals'}
                                                  </span>
                                              ) : (
                                                  <span className="dm-header-subtitle">
                                                      {activeConversation.partner?.role} • {activeConversation.partner?.online ? 'Online' : 'Offline'}
                                                  </span>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                                  <div className="dm-header-actions-new">
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
                                          <button className="icon-btn" onClick={() => setIsMsgSearchOpen(true)} title="Search Messages">
                                              <Search size={20} />
                                          </button>
                                      )}

                                      {activeConversation.type === 'group' && (
                                          <button className="icon-btn-text" onClick={() => setIsAddMemberModalOpen(true)} title="View Members" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0 0.5rem' }}>
                                              <Users size={18} />
                                              <span>{activeConversation.participants?.length || 0}</span>
                                          </button>
                                      )}

                                      <button className="icon-btn" title="Pinned Messages" onClick={() => setIsProfileOpen(!isProfileOpen)}>
                                          <Pin size={20} style={{ transform: 'rotate(45deg)' }} />
                                      </button>

                                      <button className="icon-btn" onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}>
                                          <MoreVertical size={20} />
                                      </button>

                                      {isHeaderMenuOpen && (
                                          <div className="dm-dropdown-menu-new">
                                              <button className="dm-dropdown-item-new" onClick={() => { setIsProfileOpen(!isProfileOpen); setIsHeaderMenuOpen(false); }}>
                                                  <Info size={16} />
                                                  <span>{isProfileOpen ? 'Hide Details' : 'Show Details'}</span>
                                              </button>
                                              {activeConversation.type === 'group' && user?.role === 'Admin' && (
                                                  <button className="dm-dropdown-item-new" onClick={() => { setEditChannelName(activeConversation.name || ''); setEditChannelDescription(activeConversation.description || ''); setIsEditChannelModalOpen(true); setIsHeaderMenuOpen(false); }}>
                                                      <Pencil size={16} />
                                                      <span>Edit Channel</span>
                                                  </button>
                                              )}
                                              {activeConversation.type === 'group' && user?.role === 'Admin' && (
                                                  <button className="dm-dropdown-item-new danger" onClick={() => { handleDeleteChannel(activeConversation.id); setIsHeaderMenuOpen(false); }}>
                                                      <Trash2 size={16} />
                                                      <span>Delete Channel</span>
                                                  </button>
                                              )}
                                          </div>
                                      )}
                                  </div>
                              </div>

                              {/* Chat Messages */}
                              <div className="dm-messages-area-new" ref={scrollRef}>
                                  {loadingMsgs ? (
                                      <div className="dm-loading-spinner-wrapper-large"><div className="dm-spinner-large" /></div>
                                  ) : filteredMessages.length === 0 ? (
                                      <div className="dm-empty-chat-state">
                                          <div className="dm-empty-chat-icon"><Users size={32} /></div>
                                          <h3>Welcome to #{activeConversation.name || 'Conversation'}!</h3>
                                          <p>This is the start of the chat transcript. Send a message to start collaborating.</p>
                                      </div>
                                  ) : (
                                      groupedMessages.map(group => (
                                          <div key={group.date} className="dm-messages-group-wrapper">
                                              <div className="dm-date-separator-new">
                                                  <span className="dm-date-text-new" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                      {group.date}
                                                      {group.date === 'Today' && (
                                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.8 }}>
                                                              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                          </svg>
                                                      )}
                                                  </span>
                                              </div>
                                              {group.messages.map(msg => {
                                                  const isSelf = msg.senderId === user?.id;
                                                  const parsedReactions = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions || '[]') : (msg.reactions || []);
                                                  const isSpreadsheet = msg.attachments && msg.attachments.some(att => att.fileName.includes('.xlsx') || att.fileName.includes('.csv') || att.fileName.includes('.xls'));

                                                  let avatarBg = '#4F46E5';
                                                  const nameUpper = (msg.sender?.name || '').toUpperCase();
                                                  if (nameUpper.includes('RAHUL PATEL') || nameUpper.includes('RP')) avatarBg = '#7C3AED'; // Purple
                                                  else if (nameUpper.includes('PRIYA') || nameUpper.includes('PS')) avatarBg = '#F97316'; // Orange/Amber
                                                  else if (nameUpper.includes('DATA ANALYST') || nameUpper.includes('DA')) avatarBg = '#0EA5E9'; // Blue/Cyan
                                                  else if (nameUpper.includes('VERMA') || nameUpper.includes('RV')) avatarBg = '#10B981'; // Green
                                                  
                                                  return (
                                                      <div key={msg.id} className="dm-message-row-new">
                                                          <div className="dm-message-avatar-container">
                                                              <div className="dm-message-avatar-bubble" style={{ backgroundColor: avatarBg }}>
                                                                  {getInitials(msg.sender?.name || '')}
                                                              </div>
                                                          </div>
                                                          <div className="dm-message-bubble-wrapper-new">
                                                              <div className="dm-message-header-new">
                                                                  <span className="dm-message-sender-name-new">{msg.sender?.name || 'User'}</span>
                                                                  <span className="dm-message-timestamp-new">{formatTime(msg.createdAt)}</span>
                                                                  {msg.isPinned && <span className="dm-message-pinned-tag"><Pin size={10} /> pinned</span>}
                                                              </div>

                                                              <div className="dm-message-bubble-new">
                                                                  {msg.content && <p className="dm-message-text-new">{msg.content}</p>}

                                                                  {/* Attachments */}
                                                                  {msg.attachments && msg.attachments.length > 0 && (
                                                                      <div className="dm-message-attachments-new">
                                                                          {msg.attachments.map(att => {
                                                                              return (
                                                                                  <div key={att.id} className="dm-attachment-card-new">
                                                                                      {renderFileIcon(att.fileType)}
                                                                                      <div className="dm-attachment-info-new">
                                                                                          <span className="dm-attachment-name-new" title={att.fileName}>{att.fileName}</span>
                                                                                          <span className="dm-attachment-size-new">
                                                                                              {att.fileName.split('.').pop()?.toUpperCase()} • {formatFileSize(att.fileSize)}
                                                                                          </span>
                                                                                      </div>
                                                                                      <div className="dm-attachment-actions-new">
                                                                                          <a href={att.fileUrl} download={att.fileName} className="dm-attachment-action-btn-new" title="Download">
                                                                                              <Download size={14} />
                                                                                          </a>
                                                                                          <button onClick={() => window.open(att.fileUrl, '_blank')} className="dm-attachment-action-btn-new" title="Preview">
                                                                                              <Eye size={14} />
                                                                                          </button>
                                                                                      </div>
                                                                                  </div>
                                                                              );
                                                                          })}
                                                                      </div>
                                                                  )}
                                                              </div>

                                                              {/* Reactions list */}
                                                              <div className="dm-reactions-row-new">
                                                                  {parsedReactions.map((react: any, rIdx: number) => {
                                                                      const hasUserReacted = react.userIds.includes(user?.id);
                                                                      return (
                                                                          <button
                                                                              key={rIdx}
                                                                              className={`dm-reaction-pill-new ${hasUserReacted ? 'user-reacted' : ''}`}
                                                                              onClick={() => handleToggleReaction(msg.id, react.emoji)}
                                                                              title={react.usernames.join(', ')}
                                                                          >
                                                                              <span className="dm-reaction-emoji">{react.emoji}</span>
                                                                              <span className="dm-reaction-count">{react.userIds.length}</span>
                                                                          </button>
                                                                      );
                                                                  })}

                                                                  {/* Add reaction button */}
                                                                  <div style={{ position: 'relative' }}>
                                                                      <button
                                                                          className="dm-add-reaction-trigger-new"
                                                                          onClick={() => setActiveReactionPickerMessageId(activeReactionPickerMessageId === msg.id ? null : msg.id)}
                                                                          title="Add Reaction"
                                                                      >
                                                                          <Smile size={14} />
                                                                          <span>+</span>
                                                                      </button>

                                                                      {activeReactionPickerMessageId === msg.id && (
                                                                          <div className="dm-reaction-picker-popover">
                                                                              {['👍', '🔥', '🎉', '❤️', '😮', '🚀', '👀', '✅'].map(emoji => (
                                                                                  <button
                                                                                      key={emoji}
                                                                                      className="dm-reaction-picker-emoji"
                                                                                      onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                                  >
                                                                                      {emoji}
                                                                                  </button>
                                                                              ))}
                                                                          </div>
                                                                      )}
                                                                  </div>

                                                                  {/* Pin options toggle */}
                                                                  <button
                                                                      className={`dm-msg-hover-action-btn ${msg.isPinned ? 'active' : ''}`}
                                                                      onClick={() => handleTogglePin(msg.id)}
                                                                      title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                                                                      style={{ marginLeft: 'auto' }}
                                                                  >
                                                                      <Pin size={12} style={{ transform: msg.isPinned ? 'none' : 'rotate(45deg)' }} />
                                                                  </button>
                                                              </div>
                                                          </div>
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      ))
                                  )}
                              </div>

                              {/* Typing Indicator */}
                              {isPartnerTyping && (
                                  <div className="dm-typing-banner-new">
                                      <div className="dm-typing-dots"><span /><span /><span /></div>
                                      <span>{isPartnerTyping} is typing...</span>
                                  </div>
                              )}

                              {/* Chat Inputs */}
                              <div className="dm-input-area-new">
                                  {attachments.length > 0 && (
                                      <div className="dm-input-previews-new">
                                          {attachments.map((att, idx) => (
                                              <div key={idx} className="dm-input-preview-pill">
                                                  <FileText size={12} />
                                                  <span>{att.name} ({formatFileSize(att.size)})</span>
                                                  <button onClick={() => handleRemoveAttachment(idx)}><X size={12} /></button>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                                  <div className="dm-input-box-wrapper-new">
                                      <textarea
                                          className="dm-input-textarea-new"
                                          placeholder={`Message #${activeConversation.name || 'Conversation'}`}
                                          value={messageText}
                                          onChange={handleTextareaChange}
                                          onKeyDown={handleKeyDown}
                                          rows={1}
                                      />
                                      <div className="dm-input-toolbar-new">
                                          <input
                                              type="file"
                                              ref={fileInputRef}
                                              style={{ display: 'none' }}
                                              onChange={handleFileSelect}
                                              multiple
                                          />
                                          <button className="dm-toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Add item"><Plus size={16} /></button>
                                          <button className="dm-toolbar-btn" title="Text formatting"><span style={{ fontWeight: 600, fontSize: '13px' }}>Aa</span></button>
                                          <button className="dm-toolbar-btn" title="Emojis"><Smile size={16} /></button>
                                          <button className="dm-toolbar-btn" title="Mentions"><span style={{ fontSize: '13px' }}>@</span></button>
                                          <button className="dm-toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Upload file"><Paperclip size={16} /></button>
                                          <button className="dm-toolbar-btn" title="More options"><MoreVertical size={16} /></button>

                                          <button
                                              className="dm-send-message-btn-new"
                                              onClick={handleSendMessage}
                                              disabled={uploading || (!messageText.trim() && attachments.length === 0)}
                                              title="Send message"
                                          >
                                              <Send size={14} />
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          </>
                      ) : (
                          <div className="dm-empty-chat-state-global">
                              <Users size={64} style={{ color: 'var(--primary-color)', opacity: 0.3 }} />
                              <h3>Communication Hub</h3>
                              <p>Select a workspace channel or click DMs to chat with members directly.</p>
                              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                                  {user?.role === 'Admin' && (
                                      <Button onClick={() => setIsChannelModalOpen(true)} icon={<Plus size={16} />}>Create Channel</Button>
                                  )}
                                  <Button
                                      variant="secondary"
                                      onClick={() => { loadDirectoryUsers(); setIsNewDmModalOpen(true); }}
                                      icon={<User size={16} />}
                                  >
                                      Start Direct Message
                                  </Button>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Right Panel: Channel / User Details */}
                  {activeChatId && activeConversation && isProfileOpen && (
                      <div className="dm-right-panel-new">
                          <div className="dm-right-panel-header-new">
                              <h3>Channel Details</h3>
                              <button className="icon-btn" onClick={() => setIsProfileOpen(false)}><X size={18} /></button>
                          </div>

                          <div className="dm-right-scrollable-content">
                              {/* Big Centered Avatar Details */}
                              <div className="dm-right-card-header-new">
                                  <div className="dm-right-big-avatar-new">
                                      {activeConversation.isPrivate ? <Lock size={32} /> : <Hash size={32} />}
                                  </div>
                                  <h4>#{activeConversation.name}</h4>
                                  <p className="dm-right-card-description">{activeConversation.description || 'Discuss business updates, strategy, and goals'}</p>
                                  <p className="dm-right-card-created-by">Created by Admin on May 10, 2024</p>
                              </div>

                              {/* Actions Group Row */}
                              <div className="dm-right-actions-group-new">
                                  <button className="dm-right-action-tile-btn" onClick={() => setIsAddMemberModalOpen(true)}>
                                      <Plus size={18} />
                                      <span>Add Members</span>
                                  </button>
                                  {user?.role === 'Admin' && (
                                      <button className="dm-right-action-tile-btn" onClick={() => { setEditChannelName(activeConversation.name || ''); setEditChannelDescription(activeConversation.description || ''); setIsEditChannelModalOpen(true); }}>
                                          <Pencil size={18} />
                                          <span>Edit Channel</span>
                                      </button>
                                  )}
                                  <button className="dm-right-action-tile-btn">
                                      <Bell size={18} />
                                      <span>Notifications</span>
                                  </button>
                              </div>

                              {/* Members Listing */}
                              <div className="dm-right-section-new">
                                  <div className="dm-right-section-title-row">
                                      <h5>Members ({activeConversation.participants?.length || 0})</h5>
                                      <button className="dm-right-view-all-link" onClick={() => setIsAddMemberModalOpen(true)}>View all</button>
                                  </div>
                                  <div className="dm-right-members-list-new">
                                      {(activeConversation.participants || []).slice(0, 4).map(p => {
                                          const isOwner = p.role === 'Admin';
                                          const isCreator = p.role === 'Admin';
                                          let badgeClass = 'member-badge';
                                          let roleName = 'Member';
                                          if (isOwner) {
                                              badgeClass = 'owner-badge';
                                              roleName = 'Owner';
                                          } else if (p.name.includes('Patel')) {
                                              badgeClass = 'admin-badge';
                                              roleName = 'Admin';
                                          }
                                          
                                          return (
                                              <div key={p.id} className="dm-right-member-row-new">
                                                  <div className="dm-right-member-avatar-wrapper">
                                                      <div className="dm-right-member-avatar">{getInitials(p.name)}</div>
                                                      <div className={`dm-right-member-status ${p.online ? 'online' : 'offline'}`} />
                                                  </div>
                                                  <div className="dm-right-member-info-new">
                                                      <span className="dm-right-member-name-new">{p.name} {p.id === user?.id ? '(You)' : ''}</span>
                                                      <span className="dm-right-member-email-new">{p.email}</span>
                                                  </div>
                                                  <span className={`dm-right-member-badge ${badgeClass}`}>
                                                      {roleName}
                                                  </span>
                                              </div>
                                          );
                                      })}
                                      {activeConversation.participants && activeConversation.participants.length > 4 && (
                                          <button className="dm-right-more-members-btn" onClick={() => setIsAddMemberModalOpen(true)}>
                                              +{activeConversation.participants.length - 4} more members
                                          </button>
                                      )}
                                  </div>
                              </div>

                              {/* Shared Files Listing */}
                              <div className="dm-right-section-new">
                                  <div className="dm-right-section-title-row">
                                      <h5>Shared Files ({sharedFiles.length})</h5>
                                      <span className="dm-right-view-all-link">View all</span>
                                  </div>
                                  <div className="dm-right-files-list-new">
                                      {sharedFiles.length === 0 ? (
                                          <p className="dm-right-empty-text">No files shared yet</p>
                                      ) : (
                                          sharedFiles.slice(0, 3).map((f, idx) => (
                                              <div key={idx} className="dm-right-file-row-new">
                                                  {renderFileIcon(f.type)}
                                                  <div className="dm-right-file-info-new">
                                                      <a href={f.url} download={f.name} className="dm-right-file-name-new" title={f.name}>{f.name}</a>
                                                      <span className="dm-right-file-meta-new">
                                                          {formatFileSize(f.size)} • {f.sender}
                                                      </span>
                                                  </div>
                                              </div>
                                          ))
                                      )}
                                  </div>
                              </div>

                              {/* Pinned Messages Listing */}
                              <div className="dm-right-section-new">
                                  <div className="dm-right-section-title-row">
                                      <h5>Pinned Messages ({pinnedMessages.length})</h5>
                                      <span className="dm-right-view-all-link">View all</span>
                                  </div>
                                  <div className="dm-right-pinned-list-new">
                                      {pinnedMessages.length === 0 ? (
                                          <p className="dm-right-empty-text">No pinned messages</p>
                                      ) : (
                                          pinnedMessages.slice(0, 2).map(pm => (
                                              <div key={pm.id} className="dm-right-pinned-card-new">
                                                  <div className="dm-right-pinned-card-header">
                                                      <span className="dm-right-pinned-author">{pm.sender?.name || 'User'}</span>
                                                      <span className="dm-right-pinned-time">{formatTime(pm.createdAt)}</span>
                                                  </div>
                                                  <p className="dm-right-pinned-text">{pm.content}</p>
                                              </div>
                                          ))
                                      )}
                                  </div>
                              </div>
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
                      setNewChannelIsPrivate(false);
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

                      <div className="dm-form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <input
                              type="checkbox"
                              id="private-checkbox"
                              checked={newChannelIsPrivate}
                              onChange={(e) => setNewChannelIsPrivate(e.target.checked)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <label htmlFor="private-checkbox" style={{ fontSize: '0.825rem', fontWeight: 500, cursor: 'pointer' }}>
                              Make Channel Private (only accessible by invited members)
                          </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <Button
                              variant="secondary"
                              onClick={() => {
                                  setIsChannelModalOpen(false);
                                  setNewChannelName('');
                                  setNewChannelDescription('');
                                  setNewChannelIsPrivate(false);
                              }}
                          >
                              Cancel
                          </Button>
                          <Button onClick={handleCreateChannel} disabled={!newChannelName.trim()}>
                              Create Channel
                          </Button>
                      </div>
                  </div>
              </Modal>

              {/* Modal: New DM Selector */}
              <Modal
                  isOpen={isNewDmModalOpen}
                  onClose={() => {
                      setIsNewDmModalOpen(false);
                      setUserSearchQuery('');
                  }}
                  title="Start a Direct Message"
              >
                  <div className="dm-search-wrapper" style={{ marginBottom: '1rem' }}>
                      <Search size={16} className="text-secondary" />
                      <input
                          type="text"
                          className="dm-search-input"
                          placeholder="Search coworkers..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                      />
                  </div>

                  <div className="dm-modal-user-list">
                      {loadingUsers ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="dm-spinner-small" /></div>
                      ) : filteredDirectoryUsers.length === 0 ? (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem', fontSize: '0.825rem' }}>
                              No users found
                          </div>
                      ) : (
                          filteredDirectoryUsers.map(u => (
                              <div key={u.id} className="dm-modal-user-item" onClick={() => handleStartConversation(u.id)}>
                                  <div className="dm-avatar-wrapper">
                                      <div className="dm-avatar">{getInitials(u.name)}</div>
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

              {/* Modal: Edit Channel */}
              <Modal
                  isOpen={isEditChannelModalOpen}
                  onClose={() => setIsEditChannelModalOpen(false)}
                  title="Edit Channel Details"
              >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                      <div className="dm-form-group">
                          <label className="dm-form-label">Channel Name</label>
                          <div className="dm-search-wrapper" style={{ marginTop: '0.25rem' }}>
                              <span className="text-secondary" style={{ fontSize: '1rem', fontWeight: 600, paddingRight: '4px' }}>#</span>
                              <input
                                  type="text"
                                  className="dm-search-input"
                                  value={editChannelName}
                                  onChange={(e) => setEditChannelName(e.target.value)}
                              />
                          </div>
                      </div>

                      <div className="dm-form-group">
                          <label className="dm-form-label">Description</label>
                          <div className="dm-textarea-wrapper" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem' }}>
                              <textarea
                                  className="dm-textarea"
                                  rows={2}
                                  value={editChannelDescription}
                                  onChange={(e) => setEditChannelDescription(e.target.value)}
                              />
                          </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <Button variant="secondary" onClick={() => setIsEditChannelModalOpen(false)}>Cancel</Button>
                          <Button onClick={handleUpdateChannel} disabled={!editChannelName.trim()}>Save Changes</Button>
                      </div>
                  </div>
              </Modal>

              {/* Modal: Add Members Directory Selector */}
              <Modal
                  isOpen={isAddMemberModalOpen}
                  onClose={() => {
                      setIsAddMemberModalOpen(false);
                      setUserSearchQuery('');
                  }}
                  title="Manage Channel Membership"
              >
                  <div className="dm-search-wrapper" style={{ marginBottom: '1rem' }}>
                      <Search size={16} className="text-secondary" />
                      <input
                          type="text"
                          className="dm-search-input"
                          placeholder="Search workspace members to add..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                      />
                  </div>

                  <div className="dm-modal-user-list">
                      {loadingUsers ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="dm-spinner-small" /></div>
                      ) : filteredDirectoryUsers.length === 0 ? (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem', fontSize: '0.825rem' }}>
                              No users found
                          </div>
                      ) : (
                          filteredDirectoryUsers.map(u => {
                              const isAlreadyIn = activeConversation?.participants?.some(p => p.id === u.id);
                              return (
                                  <div 
                                      key={u.id} 
                                      className={`dm-modal-user-item ${isAlreadyIn ? 'disabled' : ''}`}
                                      onClick={() => !isAlreadyIn && handleAddMember(u.id)}
                                      style={{ opacity: isAlreadyIn ? 0.6 : 1, cursor: isAlreadyIn ? 'default' : 'pointer' }}
                                  >
                                      <div className="dm-avatar-wrapper">
                                          <div className="dm-avatar">{getInitials(u.name)}</div>
                                          <div className={`dm-status-dot ${u.online ? 'online' : 'offline'}`} />
                                      </div>
                                      <div className="dm-modal-user-info" style={{ flex: 1 }}>
                                          <span className="dm-modal-user-name">{u.name}</span>
                                          <span className="dm-modal-user-role">{u.role}</span>
                                      </div>
                                      {isAlreadyIn && (
                                          <span className="dm-right-member-badge member-badge">Joined</span>
                                      )}
                                  </div>
                              );
                          })
                      )}
                  </div>
              </Modal>
          </div>
      );
  }

  export default function CollaborationPage() {
      return (
          <Suspense fallback={<div className="dm-loading-spinner-wrapper-large"><div className="dm-spinner-large" /></div>}>
              <CollaborationContent />
          </Suspense>
      );
  }
