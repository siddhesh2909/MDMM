import * as express from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { isUserOnline, sendToUser, sendToOrganization } from '../services/websocket.service';
import { notifyUser } from '../services/notification.service';

export const getConversations = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const orgId = user.organizationId;
        const defaultNames = ['General', 'Announcements', 'Analytics', 'Business'];
        const existingChannels = await prisma.conversation.findMany({
            where: {
                organizationId: orgId,
                type: 'group',
                name: { in: defaultNames }
            }
        });

        const missingNames = defaultNames.filter(name => !existingChannels.some(c => c.name === name));
        if (missingNames.length > 0) {
            for (const name of missingNames) {
                await prisma.conversation.create({
                    data: {
                        name,
                        description: `Company-wide channel for ${name.toLowerCase()} updates and discussion.`,
                        type: 'group',
                        organizationId: orgId
                    }
                });
            }
        }

        const conversations = await prisma.conversation.findMany({
            where: {
                organizationId: orgId,
                OR: [
                    { type: 'group' },
                    {
                        type: 'direct',
                        participants: {
                            some: { id: user.id }
                        }
                    }
                ]
            },
            include: {
                participants: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        lastActive: true
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        attachments: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Format to what frontend expects
        const formatted = await Promise.all(conversations.map(async (conv: any) => {
            const partner = conv.type === 'direct' ? (conv.participants.find((p: any) => p.id !== user.id) || null) : null;
            const lastMsg = conv.messages[0] || null;

            const unreadCount = await prisma.message.count({
                where: {
                    conversationId: conv.id,
                    senderId: { not: user.id },
                    status: { not: 'read' }
                }
            });

            return {
                id: conv.id,
                type: conv.type,
                name: conv.name,
                description: conv.description,
                updatedAt: conv.updatedAt.toISOString(),
                partner: partner ? {
                    id: partner.id,
                    name: partner.name,
                    email: partner.email,
                    role: partner.role,
                    online: isUserOnline(partner.id),
                    lastActive: partner.lastActive ? partner.lastActive.toISOString() : null
                } : null,
                lastMessage: lastMsg ? {
                    id: lastMsg.id,
                    content: lastMsg.content,
                    senderId: lastMsg.senderId,
                    createdAt: lastMsg.createdAt.toISOString(),
                    hasAttachments: lastMsg.attachments.length > 0
                } : null,
                unreadCount
            };
        }));

        res.status(200).json(formatted);
    } catch (err) {
        console.error('Failed to get conversations:', err);
        res.status(500).json({ error: 'Failed to retrieve conversations' });
    }
};

export const getMessages = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const conversationId = req.params.id as string;
    const search = req.query.search as string;

    try {
        const whereClause: any = { conversationId };
        if (search && search.trim()) {
            whereClause.content = {
                contains: search.trim()
            };
        }

        const messages = await prisma.message.findMany({
            where: whereClause,
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                },
                attachments: true
            },
            orderBy: { createdAt: 'asc' }
        });

        res.status(200).json(messages);
    } catch (err) {
        console.error('Failed to get messages:', err);
        res.status(500).json({ error: 'Failed to retrieve messages' });
    }
};

export const markConversationRead = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const conversationId = req.params.id as string;

    try {
        await prisma.message.updateMany({
            where: {
                conversationId,
                senderId: { not: user.id },
                status: { not: 'read' }
            },
            data: { status: 'read' }
        });

        const conv = (await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { participants: true }
        })) as any;

        if (conv) {
            const partner = conv.participants.find((p: any) => p.id !== user.id);
            if (partner) {
                sendToUser(partner.id, {
                    type: 'read',
                    conversationId,
                    readAt: new Date().toISOString()
                });
            }
        }

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Failed to mark messages read:', err);
        res.status(500).json({ error: 'Failed to update read status' });
    }
};

export const getUsersDirectory = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const users = await prisma.user.findMany({
            where: {
                organizationId: user.organizationId,
                id: { not: user.id }
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                lastActive: true
            }
        });

        const formatted = users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            department: u.department,
            lastActive: u.lastActive ? u.lastActive.toISOString() : null,
            online: isUserOnline(u.id)
        }));

        res.status(200).json(formatted);
    } catch (err) {
        console.error('Failed to get user directory:', err);
        res.status(500).json({ error: 'Failed to retrieve directory' });
    }
};

export const startConversation = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { partnerId } = req.body;
    if (!partnerId) return res.status(400).json({ error: 'Partner ID is required' });

    try {
        // Find if direct conversation already exists
        let conv: any = await prisma.conversation.findFirst({
            where: {
                type: 'direct',
                organizationId: user.organizationId,
                AND: [
                    { participants: { some: { id: user.id } } },
                    { participants: { some: { id: partnerId } } }
                ]
            },
            include: {
                participants: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        lastActive: true
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        attachments: true
                    }
                }
            }
        });

        const currentUserDb = await prisma.user.findUnique({
            where: { id: user.id }
        });

        if (!conv && currentUserDb) {
            conv = (await prisma.conversation.create({
                data: {
                    type: 'direct',
                    organizationId: user.organizationId,
                    participants: {
                        connect: [
                            { id: user.id },
                            { id: partnerId }
                        ]
                    }
                },
                include: {
                    participants: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            lastActive: true
                        }
                    },
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        include: {
                            attachments: true
                        }
                    }
                }
            })) as any;

            // Notify partner via WebSocket
            const partner = conv.participants.find((p: any) => p.id !== user.id);
            if (partner) {
                sendToUser(partner.id, {
                    type: 'conversation_created',
                    conversation: {
                        id: conv.id,
                        type: conv.type,
                        updatedAt: conv.updatedAt.toISOString(),
                        partner: {
                            id: currentUserDb.id,
                            name: currentUserDb.name,
                            email: currentUserDb.email,
                            role: currentUserDb.role,
                            online: isUserOnline(currentUserDb.id),
                            lastActive: currentUserDb.lastActive ? currentUserDb.lastActive.toISOString() : null
                        },
                        lastMessage: null,
                        unreadCount: 0
                    }
                });
            }
        }

        if (!conv) {
            return res.status(404).json({ error: 'Failed to establish conversation' });
        }

        const partner = conv.participants.find((p: any) => p.id !== user.id) || null;
        const lastMsg = conv.messages[0] || null;

        const formatted = {
            id: conv.id,
            type: conv.type,
            updatedAt: conv.updatedAt.toISOString(),
            partner: partner ? {
                id: partner.id,
                name: partner.name,
                email: partner.email,
                role: partner.role,
                online: isUserOnline(partner.id),
                lastActive: partner.lastActive ? partner.lastActive.toISOString() : null
            } : null,
            lastMessage: lastMsg ? {
                id: lastMsg.id,
                content: lastMsg.content,
                senderId: lastMsg.senderId,
                createdAt: lastMsg.createdAt.toISOString(),
                hasAttachments: lastMsg.attachments.length > 0
            } : null,
            unreadCount: 0
        };

        res.status(200).json(formatted);
    } catch (err) {
        console.error('Failed to start conversation:', err);
        res.status(500).json({ error: 'Failed to initialize conversation' });
    }
};

export const sendMessage = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const conversationId = req.params.id as string;
    const { content, attachments } = req.body;

    try {
        const message = (await prisma.message.create({
            data: {
                conversationId,
                senderId: user.id,
                content: content || '',
                attachments: {
                    create: (attachments || []).map((att: any) => ({
                        fileName: att.fileName,
                        fileType: att.fileType,
                        fileSize: att.fileSize,
                        fileUrl: att.fileUrl
                    }))
                }
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                },
                attachments: true
            }
        })) as any;

        // Update conversation's updatedAt
        const updatedConv = (await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
            include: { participants: true }
        })) as any;

        const formattedMessage = {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
            status: message.status,
            isPinned: message.isPinned,
            attachments: message.attachments.map((att: any) => ({
                id: att.id,
                fileName: att.fileName,
                fileType: att.fileType,
                fileSize: att.fileSize,
                fileUrl: att.fileUrl
            })),
            sender: message.sender
        };

        // Notify via WebSocket
        if (updatedConv.type === 'group') {
            // Broadcast to the whole organization
            sendToOrganization(user.organizationId, {
                type: 'message',
                message: formattedMessage
            });

            sendToOrganization(user.organizationId, {
                type: 'conversation_updated',
                conversationId,
                lastMessage: {
                    id: message.id,
                    content: message.content,
                    senderId: message.senderId,
                    createdAt: message.createdAt.toISOString(),
                    hasAttachments: message.attachments.length > 0
                }
            });
        } else {
            // Direct message: notify partner
            const partner = updatedConv.participants.find((p: any) => p.id !== user.id);
            if (partner) {
                sendToUser(partner.id, {
                    type: 'message',
                    message: formattedMessage
                });

                sendToUser(partner.id, {
                    type: 'conversation_updated',
                    conversationId,
                    lastMessage: {
                        id: message.id,
                        content: message.content,
                        senderId: message.senderId,
                        createdAt: message.createdAt.toISOString(),
                        hasAttachments: message.attachments.length > 0
                    }
                });
            }
        }

        // Detect @[name] mentions
        const mentionRegex = /@(\w+)/g;
        const matches = content ? [...content.matchAll(mentionRegex)] : [];
        if (matches.length > 0) {
            const mentionStrings = matches.map(m => m[1].toLowerCase());
            const orgUsers = await prisma.user.findMany({
                where: { organizationId: user.organizationId }
            });

            const mentionedUsers = orgUsers.filter(u =>
                mentionStrings.some(mention =>
                    u.name.toLowerCase().includes(mention) ||
                    u.email.toLowerCase().startsWith(mention)
                )
            );

            for (const mentionUser of mentionedUsers) {
                if (mentionUser.id !== user.id) {
                    const channelText = updatedConv.type === 'group' ? `#${updatedConv.name}` : 'direct chat';
                    await notifyUser(
                        mentionUser.id,
                        '💬 New Mention',
                        `${message.sender.name} mentioned you in ${channelText}: "${content.substring(0, 60)}"`,
                        'chat',
                        `/collaboration/direct-messages?convId=${conversationId}`
                    ).catch(e => console.error('Failed to send mention notification', e));
                }
            }
        }

        res.status(200).json(formattedMessage);
    } catch (err) {
        console.error('Failed to send message:', err);
        res.status(500).json({ error: 'Failed to dispatch message' });
    }
};

export const uploadAttachment = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { fileName, fileType, fileData } = req.body;
    if (!fileName || !fileType || !fileData) {
        return res.status(400).json({ error: 'Missing attachment details' });
    }

    try {
        const fileBuffer = Buffer.from(fileData, 'base64');
        const uploadDir = path.join(__dirname, '../../uploads');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileId = `${Date.now()}-${fileName}`;
        const filePath = path.join(uploadDir, fileId);

        fs.writeFileSync(filePath, fileBuffer);

        res.status(200).json({
            fileName,
            fileType,
            fileSize: fileBuffer.length,
            fileUrl: `/uploads/${fileId}`
        });
    } catch (err) {
        console.error('Failed to upload attachment:', err);
        res.status(500).json({ error: 'File write failed' });
    }
};

export const createChannel = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'Admin') {
        return res.status(403).json({ error: 'Forbidden: Only Admins can create channels' });
    }

    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Channel name is required' });

    try {
        const cleanedName = name.replace(/^#\s*/, '').trim();
        const channel = await prisma.conversation.create({
            data: {
                type: 'group',
                name: cleanedName,
                description: description || '',
                organizationId: user.organizationId
            }
        });

        // Notify all organization members via WebSocket
        sendToOrganization(user.organizationId, {
            type: 'conversation_created',
            conversation: {
                id: channel.id,
                type: channel.type,
                name: channel.name,
                description: channel.description,
                updatedAt: channel.updatedAt.toISOString(),
                partner: null,
                lastMessage: null,
                unreadCount: 0
            }
        });

        res.status(201).json(channel);
    } catch (err) {
        console.error('Failed to create channel:', err);
        res.status(500).json({ error: 'Failed to create channel' });
    }
};

export const deleteChannel = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'Admin') {
        return res.status(403).json({ error: 'Forbidden: Only Admins can delete channels' });
    }

    const channelId = req.params.id as string;

    try {
        const conv = await prisma.conversation.findUnique({
            where: { id: channelId }
        });

        if (!conv || conv.type !== 'group' || conv.organizationId !== user.organizationId) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        await prisma.conversation.delete({
            where: { id: channelId }
        });

        // Notify all organization members via WebSocket
        sendToOrganization(user.organizationId, {
            type: 'conversation_deleted',
            conversationId: channelId
        });

        res.status(200).json({ success: true, message: 'Channel deleted successfully' });
    } catch (err) {
        console.error('Failed to delete channel:', err);
        res.status(500).json({ error: 'Failed to delete channel' });
    }
};

export const togglePinMessage = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const messageId = req.params.id as string;

    try {
        const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: { conversation: true }
        });

        if (!message || message.conversation.organizationId !== user.organizationId) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const updated = await prisma.message.update({
            where: { id: messageId },
            data: { isPinned: !message.isPinned }
        });

        // Broadcast pin status update via WS
        const payload = {
            type: 'message_pinned_updated',
            messageId: message.id,
            conversationId: message.conversationId,
            isPinned: updated.isPinned
        };

        if (message.conversation.type === 'group') {
            sendToOrganization(user.organizationId, payload);
        } else {
            const participants = await prisma.user.findMany({
                where: { conversations: { some: { id: message.conversationId } } }
            });
            participants.forEach((p) => {
                sendToUser(p.id, payload);
            });
        }

        res.status(200).json(updated);
    } catch (err) {
        console.error('Failed to pin message:', err);
        res.status(500).json({ error: 'Failed to toggle pin state' });
    }
};

export const getPinnedMessages = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const conversationId = req.params.id as string;

    try {
        const messages = await prisma.message.findMany({
            where: {
                conversationId,
                isPinned: true
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                },
                attachments: true
            },
            orderBy: { createdAt: 'asc' }
        });

        res.status(200).json(messages);
    } catch (err) {
        console.error('Failed to get pinned messages:', err);
        res.status(500).json({ error: 'Failed to retrieve pinned messages' });
    }
};
