import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

declare const process: any;

const prisma = new PrismaClient();

async function main() {
    console.log("Cleaning existing data...");
    await prisma.dataContract.deleteMany();
    await prisma.appAnalytics.deleteMany();
    await prisma.dataset.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.message.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
    console.log("✅ Cleaned");

    console.log("Starting DB Seed...");

    // 0. Create Organization
    const mainOrg = await prisma.organization.create({
        data: {
            name: 'Collaborative AI Corp',
            domain: 'collabai.com'
        }
    });
    const orgId = mainOrg.id;
    console.log("✅ Seeded Organization");

    // 1. Create Users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Seed 12 users as shown in mockup
    const [alice, bob, charlie, admin, verma, analyst, user7, user8, user9, user10, user11, user12] = await Promise.all([
        prisma.user.create({ data: { name: 'Priya Sharma', email: 'priya@collabai.com', password: hashedPassword, role: 'Business User', department: 'Data Science', organizationId: orgId, permissions: JSON.stringify(['dataset:view', 'contract:approve']) } }),
        prisma.user.create({ data: { name: 'Rahul Patel', email: 'rahul@collabai.com', password: hashedPassword, role: 'Admin', department: 'Engineering', organizationId: orgId, permissions: JSON.stringify(['dataset:manage', 'contract:edit']) } }),
        prisma.user.create({ data: { name: 'Siddhesh Pawar', email: 'siddhesh@collabai.com', password: hashedPassword, role: 'Business User', department: 'Marketing', organizationId: orgId, permissions: JSON.stringify(['dataset:view', 'dashboard:view']) } }),
        prisma.user.create({ data: { name: 'Admin User', email: 'admin@collabai.com', password: hashedPassword, role: 'Admin', department: 'IT', organizationId: orgId, permissions: JSON.stringify(['*']) } }),
        prisma.user.create({ data: { name: 'Rahul Verma', email: 'rahul.verma@collabai.com', password: hashedPassword, role: 'Business User', department: 'Engineering', organizationId: orgId, permissions: JSON.stringify(['dataset:view']) } }),
        prisma.user.create({ data: { name: 'Data Analyst', email: 'analyst@collabai.com', password: hashedPassword, role: 'Data Analyst', department: 'Data Science', organizationId: orgId, permissions: JSON.stringify(['dataset:manage', 'dataset:view', 'contract:edit', 'contract:view']) } }),
        prisma.user.create({ data: { name: 'Alex Rivera', email: 'alex@collabai.com', password: hashedPassword, role: 'Business User', department: 'Sales', organizationId: orgId, permissions: JSON.stringify(['dataset:view']) } }),
        prisma.user.create({ data: { name: 'Sarah Connor', email: 'sarah@collabai.com', password: hashedPassword, role: 'Business User', department: 'Security', organizationId: orgId, permissions: JSON.stringify([]) } }),
        prisma.user.create({ data: { name: 'John Doe', email: 'john@collabai.com', password: hashedPassword, role: 'Business User', department: 'Sales', organizationId: orgId, permissions: JSON.stringify([]) } }),
        prisma.user.create({ data: { name: 'Emily Watson', email: 'emily@collabai.com', password: hashedPassword, role: 'Business User', department: 'HR', organizationId: orgId, permissions: JSON.stringify([]) } }),
        prisma.user.create({ data: { name: 'Michael Scott', email: 'michael@collabai.com', password: hashedPassword, role: 'Business User', department: 'Management', organizationId: orgId, permissions: JSON.stringify([]) } }),
        prisma.user.create({ data: { name: 'Jessica Alba', email: 'jessica@collabai.com', password: hashedPassword, role: 'Business User', department: 'Marketing', organizationId: orgId, permissions: JSON.stringify([]) } })
    ]);
    console.log("✅ Seeded Users");

    // 1.5 Create Datasets
    await prisma.dataset.createMany({
        data: [
            { name: 'ecommerce_q3_raw.json', rawData: JSON.stringify([{ id: 101, date: '2026-03-01', revenue: 15400.50, region: 'North America' }, { id: 102, date: '2026-03-02', revenue: 'Omitted', region: 'Europe' }]), ownerId: analyst.id, organizationId: orgId },
            { name: 'marketing_leads.csv', rawData: JSON.stringify([{ id: 1, email: 'lead@test.com' }]), ownerId: bob.id, organizationId: orgId }
        ]
    });
    console.log("✅ Seeded Datasets");

    // 2. Create Contracts
    await prisma.dataContract.createMany({
        data: [
            { name: 'Core Orders Dataset', domain: 'E-Commerce', ownerName: bob.name, ownerId: bob.id, organizationId: orgId, version: '2.1.0', status: 'Active', schemaDef: JSON.stringify([{ id: "1", name: "order_id", type: "UUID", description: "Primary Key", required: true, pii: false }, { id: "2", name: "total_amount", type: "Float", description: "Total value", required: true, pii: false }]) },
            { name: 'User Profile Exhaust', domain: 'Marketing', ownerName: analyst.name, ownerId: analyst.id, organizationId: orgId, version: '1.0.0', status: 'Draft', schemaDef: JSON.stringify([{ id: "1", name: "user_id", type: "String", description: "Foreign Key", required: true, pii: false }, { id: "2", name: "email", type: "String", description: "User Email address", required: true, pii: true }]) }
        ]
    });
    console.log("✅ Seeded Data Contracts");

    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    // 4. Create Analytics
    const analyticsData = [
        { date: daysAgo(6), revenue: 14000, activeUsers: 8100, ingestionQuality: 97.2 },
        { date: now, revenue: 23500, activeUsers: 8432, ingestionQuality: 98.5 }
    ];

    await prisma.appAnalytics.createMany({ data: analyticsData });
    console.log("✅ Seeded Analytics");

    // 5. Build Audit Log
    await prisma.auditLog.createMany({
        data: [
            { userId: admin.id, role: 'Admin', action: 'Login', entityType: 'User', entityId: admin.id, organizationId: orgId },
            { userId: bob.id, role: 'Admin', action: 'Dataset Upload', entityType: 'Dataset', entityId: 'dataset-uuid-placeholder', organizationId: orgId }
        ]
    });
    console.log("✅ Seeded Audit Logs");

    // 5.5 Seed Notifications
    await prisma.notification.createMany({
        data: [
            {
                userId: admin.id,
                organizationId: orgId,
                title: "🛡️ Unauthorized Route Access Blocked",
                description: "User rahul@collabai.com attempted to access administrative panel /admin. Request was blocked and logged.",
                type: "security",
                priority: "Critical",
                read: false,
                archived: false,
                actionUrl: "/profile"
            },
            {
                userId: admin.id,
                organizationId: orgId,
                title: "🔑 Admin Login Session Initialized",
                description: "A new administrative login session was successfully authenticated from IP 192.168.1.104.",
                type: "security",
                priority: "High",
                read: true,
                archived: false,
                actionUrl: "/profile"
            },
            {
                userId: bob.id,
                organizationId: orgId,
                title: "🛡️ Security Warning: Login Location",
                description: "Your account was accessed from a new IP address location. If this wasn't you, revoke sessions.",
                type: "security",
                priority: "High",
                read: false,
                archived: false,
                actionUrl: "/profile"
            },
            {
                userId: bob.id,
                organizationId: orgId,
                title: "📦 Dataset Ingest: products-50.csv completed",
                description: "Dataset products-50.csv has been successfully parsed and ingested (50 rows, 10 columns).",
                type: "dataset",
                priority: "Medium",
                read: true,
                archived: false,
                actionUrl: "/ingestion"
            },
            {
                userId: bob.id,
                organizationId: orgId,
                title: "📜 Data Contract Approved: Core Orders",
                description: "Governance contract Core Orders Dataset v2.1.0 was approved and set to Active status.",
                type: "contract",
                priority: "High",
                read: false,
                archived: false,
                actionUrl: "/data-contracts"
            },
            {
                userId: bob.id,
                organizationId: orgId,
                title: "⚙️ Schema Drift Alert in Preprocessing",
                description: "Column 'signup_date' holds ISO Dates but was cast as String. Suggested fix is available.",
                type: "preprocessing",
                priority: "Medium",
                read: false,
                archived: false,
                actionUrl: "/preprocessing"
            },
            {
                userId: charlie.id,
                organizationId: orgId,
                title: "📈 Financial KPI Dashboard Published",
                description: "Data Analyst has published the Executive Financial KPI rollup dashboard. View recent sales trends.",
                type: "analytics",
                priority: "Medium",
                read: false,
                archived: false,
                actionUrl: "/analytics"
            },
            {
                userId: charlie.id,
                organizationId: orgId,
                title: "📊 Quality Brief Report Scheduled",
                description: "Weekly Data Quality & Compliance Audit has been scheduled for automated email delivery.",
                type: "reports",
                priority: "Low",
                read: true,
                archived: false,
                actionUrl: "/reports"
            },
            {
                userId: bob.id,
                organizationId: orgId,
                title: "🤖 Copilot Schema Review Completed",
                description: "AI Data Analyst assistant has completed review of marketing_leads.csv and recommends 3 standardizations.",
                type: "ai",
                priority: "Low",
                read: false,
                archived: false,
                actionUrl: "/ai-assistant"
            },
            {
                userId: charlie.id,
                organizationId: orgId,
                title: "🤖 BI Copilot Growth Report Ready",
                description: "AI Business Assistant generated strategic growth playbook for the North America region.",
                type: "ai",
                priority: "Medium",
                read: false,
                archived: false,
                actionUrl: "/ai-business-assistant"
            },
            {
                userId: charlie.id,
                organizationId: orgId,
                title: "⚙️ System Maintenance Scheduled",
                description: "CollabAI Platform will undergo routine database optimization on June 18 at 02:00 UTC.",
                type: "system",
                priority: "Low",
                read: false,
                archived: false,
                actionUrl: "/profile"
            }
        ]
    });
    console.log("✅ Seeded Notifications");

    // 6. Seed Collaboration Conversations & Channels
    console.log("Seeding Channels & Messages...");

    // Create public channels
    const businessChan = await prisma.conversation.create({
        data: {
            type: 'group',
            name: 'Business',
            description: 'Discuss business updates, strategy, and goals',
            isPrivate: false,
            organizationId: orgId,
            participants: {
                connect: [
                    { id: admin.id },
                    { id: bob.id }, // Rahul Patel
                    { id: alice.id }, // Priya Sharma
                    { id: charlie.id }, // Siddhesh Pawar
                    { id: verma.id }, // Rahul Verma
                    { id: analyst.id }, // Data Analyst
                    { id: user7.id },
                    { id: user8.id },
                    { id: user9.id },
                    { id: user10.id },
                    { id: user11.id },
                    { id: user12.id }
                ]
            }
        }
    });

    const analyticsChan = await prisma.conversation.create({
        data: {
            type: 'group',
            name: 'Analytics',
            description: 'New dashboard insights available',
            isPrivate: false,
            organizationId: orgId,
            participants: { connect: [{ id: admin.id }, { id: bob.id }, { id: analyst.id }] }
        }
    });

    const announcChan = await prisma.conversation.create({
        data: {
            type: 'group',
            name: 'Announcements',
            description: 'Platform maintenance on Sunday',
            isPrivate: false,
            organizationId: orgId,
            participants: { connect: [{ id: admin.id }, { id: bob.id }, { id: alice.id }, { id: charlie.id }] }
        }
    });

    const generalChan = await prisma.conversation.create({
        data: {
            type: 'group',
            name: 'General',
            description: 'Welcome to the team, Alex!',
            isPrivate: false,
            organizationId: orgId,
            participants: { connect: [{ id: admin.id }, { id: bob.id }, { id: alice.id }, { id: charlie.id }, { id: user7.id }] }
        }
    });

    const deChan = await prisma.conversation.create({
        data: {
            type: 'group',
            name: 'Data-Engineering',
            description: 'Pipeline failed in ingestion service',
            isPrivate: false,
            organizationId: orgId,
            participants: { connect: [{ id: admin.id }, { id: bob.id }, { id: analyst.id }] }
        }
    });

    // Create private channel
    const abcChan = await prisma.conversation.create({
        data: {
            type: 'group',
            name: 'abc',
            description: 'No messages yet',
            isPrivate: true,
            organizationId: orgId,
            participants: {
                connect: [
                    { id: admin.id },
                    { id: bob.id }
                ]
            }
        }
    });

    // Pinned target message (Rahul Patel, May 10, 10:30 AM)
    await prisma.message.create({
        data: {
            conversationId: businessChan.id,
            senderId: bob.id, // Rahul Patel
            content: 'Please review the Q2 targets before Friday.',
            isPinned: true,
            createdAt: new Date('2026-05-10T10:30:00Z'),
            status: 'read'
        }
    });

    // Seed Messages in Business channel to match the transcript
    await prisma.message.create({
        data: {
            conversationId: businessChan.id,
            senderId: bob.id, // Rahul Patel
            content: 'Hi team, here is the latest sales performance dashboard for Q2.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 3), // 3 hours ago
            status: 'read',
            reactions: JSON.stringify([
                {
                    emoji: '👍',
                    userIds: [admin.id, alice.id, charlie.id, verma.id],
                    usernames: ['Admin User', 'Priya Sharma', 'Siddhesh Pawar', 'Rahul Verma']
                },
                {
                    emoji: '🔥',
                    userIds: [analyst.id, user7.id],
                    usernames: ['Data Analyst', 'Alex Rivera']
                }
            ]),
            attachments: {
                create: [
                    {
                        fileName: 'Sales_Performance_Q2.xlsx',
                        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        fileSize: 2.4 * 1024 * 1024,
                        fileUrl: '/uploads/Sales_Performance_Q2.xlsx'
                    }
                ]
            }
        }
    });

    await prisma.message.create({
        data: {
            conversationId: businessChan.id,
            senderId: alice.id, // Priya Sharma
            content: 'Thanks Rahul! The numbers look great this quarter.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 2.8), // 2.8 hours ago
            status: 'read',
            reactions: JSON.stringify([
                {
                    emoji: '🎉',
                    userIds: [admin.id, bob.id],
                    usernames: ['Admin User', 'Rahul Patel']
                }
            ])
        }
    });

    await prisma.message.create({
        data: {
            conversationId: businessChan.id,
            senderId: analyst.id, // Data Analyst
            content: "I've added some additional insights in the dashboard.",
            createdAt: new Date(Date.now() - 3600 * 1000 * 2.5), // 2.5 hours ago
            status: 'read'
        }
    });

    await prisma.message.create({
        data: {
            conversationId: businessChan.id,
            senderId: verma.id, // Rahul Verma
            content: 'Can we review the north region performance separately?',
            createdAt: new Date(Date.now() - 3600 * 1000 * 2.2), // 2.2 hours ago
            status: 'read'
        }
    });

    await prisma.message.create({
        data: {
            conversationId: businessChan.id,
            senderId: analyst.id, // Data Analyst
            content: "Yes, I'll prepare a breakdown.",
            createdAt: new Date(Date.now() - 3600 * 1000 * 2.0), // 2 hours ago
            status: 'read'
        }
    });

    // Additional messages to house the other shared files in the conversation details
    await prisma.message.create({
        data: {
            conversationId: businessChan.id,
            senderId: alice.id, // Priya Sharma
            content: 'Here is our core strategy document.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 24), // 1 day ago
            status: 'read',
            attachments: {
                create: [
                    {
                        fileName: 'Business_Strategy_2025.pdf',
                        fileType: 'application/pdf',
                        fileSize: 1.8 * 1024 * 1024,
                        fileUrl: '/uploads/Business_Strategy_2025.pdf'
                    }
                ]
            }
        }
    });

    await prisma.message.create({
        data: {
            conversationId: businessChan.id,
            senderId: analyst.id, // Data Analyst
            content: 'Market study results and deck.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 48), // 2 days ago
            status: 'read',
            attachments: {
                create: [
                    {
                        fileName: 'Market_Analysis.pptx',
                        fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        fileSize: 3.1 * 1024 * 1024,
                        fileUrl: '/uploads/Market_Analysis.pptx'
                    }
                ]
            }
        }
    });

    // Seed direct conversation
    const dmConv = await prisma.conversation.create({
        data: {
            type: 'direct',
            organizationId: orgId,
            participants: {
                connect: [
                    { id: admin.id },
                    { id: bob.id }
                ]
            }
        }
    });

    await prisma.message.create({
        data: {
            conversationId: dmConv.id,
            senderId: bob.id,
            content: 'Hello Admin! Let me know when you can review the data contracts.',
            status: 'sent',
            createdAt: new Date(Date.now() - 3600 * 1000)
        }
    });

    console.log("✅ Seeded Channels & Messages");
    console.log("Seed complete.");
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
