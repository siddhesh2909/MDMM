import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

const testWsConnection = async () => {
    // Generate a valid JWT token using the secret
    const secret = process.env.JWT_SECRET || 'super_secret_collaborative_ai_key_2026';
    // We need a dummy user ID that might exist or just any ID to test the upgrade phase
    const token = jwt.sign(
        {
            id: 'dummy-user-id-for-testing-upgrade',
            role: 'Viewer',
            organizationId: 'dummy-org-id',
            permissions: []
        },
        secret,
        { expiresIn: '1h' }
    );

    const wsUrl = `ws://localhost:5001?token=${token}`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('SUCCESS: WebSocket connected successfully!');
        ws.close();
    });

    ws.on('message', (data) => {
        console.log('Message received from server:', data.toString());
    });

    ws.on('unexpected-response', (req, res) => {
        console.error(`FAILED: Unexpected response. Status code: ${res.statusCode}`);
        res.on('data', (chunk) => {
            console.error('Response body:', chunk.toString());
        });
    });

    ws.on('error', (err) => {
        console.error('FAILED: WebSocket error:', err.message);
    });
};

testWsConnection();
