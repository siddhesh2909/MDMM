import jwt from 'jsonwebtoken';

async function main() {
    const secret = 'super_secret_collaborative_ai_key_2026';
    const userPayload = {
        id: '0dcb2db3-8e5e-44fc-a320-268fa8d711d9', // Data Analyst
        email: 'analyst@collabai.com',
        role: 'Analyst',
        organizationId: '67a56b7a-9966-4214-8aea-160f93d01a8e'
    };

    const token = jwt.sign(userPayload, secret);
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    console.log("Testing GET /api/collaboration/users as Analyst...");
    try {
        const res = await fetch(`http://localhost:5001/api/collaboration/users`, {
            method: 'GET',
            headers
        });
        const status = res.status;
        const text = await res.text();
        console.log("GET Response:", { status, text });
    } catch (e) {
        console.error("GET Request Failed:", e);
    }
}

main().catch(console.error);
