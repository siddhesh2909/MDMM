import { IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import url from 'url';
import prisma from '../lib/prisma';

interface UserSocketInfo {
    userId: string;
    name: string;
    organizationId: string;
}

// Global mappings
export const userConnections = new Map<string, Set<WebSocket>>();
export const socketDetails = new Map<WebSocket, UserSocketInfo>();

let wss: WebSocketServer | null = null;

export const initWebSocket = (server: any) => {
    wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket: any, head: any) => {
        console.log(`[WS Upgrade] Received upgrade request for URL: ${request.url}`);
        const parsedUrl = url.parse(request.url || '', true);
        const token = parsedUrl.query.token as string;

        if (!token) {
            console.log('[WS Upgrade] Missing token in query params');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        try {
            const secret = process.env.JWT_SECRET || 'super_secret_collaborative_ai_key_2026';
            const decoded = jwt.verify(token, secret) as any;
            console.log(`[WS Upgrade] Token successfully verified for user ID: ${decoded.id}`);
            
            wss?.handleUpgrade(request, socket, head, (ws) => {
                wss?.emit('connection', ws, request, decoded);
            });
        } catch (err: any) {
            console.error('[WS Upgrade] Token verification failed:', err.message);
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
        }
    });

    wss.on('connection', async (ws: WebSocket, request: IncomingMessage, decoded: any) => {
        const userId = decoded.id;
        console.log(`[WS Connection] User ID: ${userId} connected`);
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                console.log(`[WS Connection] User not found in DB: ${userId}`);
                ws.close(1008, 'User not found');
                return;
            }

            // Update user status and record active state
            await prisma.user.update({
                where: { id: userId },
                data: { lastActive: new Date() }
            }).catch(e => console.error('Failed to update lastActive', e));

            const socketInfo: UserSocketInfo = {
                userId,
                name: user.name,
                organizationId: user.organizationId
            };

            socketDetails.set(ws, socketInfo);

            if (!userConnections.has(userId)) {
                userConnections.set(userId, new Set());
            }
            userConnections.get(userId)!.add(ws);

            // Send welcome
            ws.send(JSON.stringify({ type: 'welcome', message: 'Connection established' }));
            console.log(`[WS Connection] Welcome payload sent to: ${user.name}`);

            // Broadcast presence: online
            broadcastPresence(userId, user.organizationId, 'online');

            ws.on('message', async (messageData: string) => {
                try {
                    const data = JSON.parse(messageData);
                    if (data.type === 'typing') {
                        const { conversationId, recipientId, isTyping } = data;
                        if (recipientId) {
                            sendToUser(recipientId, {
                                type: 'typing',
                                conversationId,
                                isTyping,
                                senderId: userId
                            });
                        } else {
                            // Group channel typing: broadcast to the whole organization (excluding sender)
                            socketDetails.forEach((info, clientWs) => {
                                if (info.organizationId === user.organizationId && info.userId !== userId) {
                                    if (clientWs.readyState === WebSocket.OPEN) {
                                        clientWs.send(JSON.stringify({
                                            type: 'typing',
                                            conversationId,
                                            isTyping,
                                            senderId: userId
                                        }));
                                    }
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.error('Error handling websocket message:', e);
                }
            });

            ws.on('close', () => {
                const conns = userConnections.get(userId);
                if (conns) {
                    conns.delete(ws);
                    if (conns.size === 0) {
                        userConnections.delete(userId);
                        // Broadcast presence: offline
                        broadcastPresence(userId, user.organizationId, 'offline');
                        
                        // Update last active in database on disconnect
                        prisma.user.update({
                            where: { id: userId },
                            data: { lastActive: new Date() }
                        }).catch(e => console.error('Failed to update lastActive on disconnect', e));
                    }
                }
                socketDetails.delete(ws);
            });

        } catch (error) {
            console.error('WebSocket connection initialization error:', error);
            ws.close(1011, 'Internal error');
        }
    });
};

export const broadcastPresence = (userId: string, organizationId: string, status: 'online' | 'offline') => {
    const payload = {
        type: 'presence',
        userId,
        status
    };

    socketDetails.forEach((info, ws) => {
        if (info.organizationId === organizationId && info.userId !== userId) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload));
            }
        }
    });
};

export const sendToUser = (userId: string, payload: any) => {
    const conns = userConnections.get(userId);
    if (conns) {
        conns.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload));
            }
        });
        return true;
    }
    return false;
};

export const isUserOnline = (userId: string): boolean => {
    const conns = userConnections.get(userId);
    return !!(conns && conns.size > 0);
};

export const sendToOrganization = (organizationId: string, payload: any) => {
    socketDetails.forEach((info, ws) => {
        if (info.organizationId === organizationId) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload));
            }
        }
    });
};
