import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
    getConversations,
    getMessages,
    markConversationRead,
    getUsersDirectory,
    startConversation,
    sendMessage,
    uploadAttachment,
    createChannel,
    deleteChannel,
    togglePinMessage,
    getPinnedMessages,
    toggleReaction,
    addChannelMember,
    updateChannelDetails
} from '../controllers/collaboration.controller';

const router = Router();

// Protect all routes
router.use(authenticateToken);

router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/read', markConversationRead);
router.get('/users', getUsersDirectory);
router.post('/conversations', startConversation);
router.post('/conversations/:id/messages', sendMessage);
router.post('/upload', uploadAttachment);

// New channel management & pinning routes
router.post('/channels', createChannel);
router.delete('/channels/:id', deleteChannel);
router.post('/messages/:id/pin', togglePinMessage);
router.get('/conversations/:id/pinned', getPinnedMessages);
router.post('/messages/:id/react', toggleReaction);
router.post('/channels/:id/members', addChannelMember);
router.patch('/channels/:id', updateChannelDetails);

export default router;
