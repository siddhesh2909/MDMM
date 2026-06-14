import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

declare const process: any;

const prisma = new PrismaClient();

async function main() {
    console.log("Cleaning existing data...");
    await prisma.workflowTask.deleteMany();
    await prisma.dataContract.deleteMany();
    await prisma.appAnalytics.deleteMany();
    await prisma.dataset.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
    console.log("✅ Cleaned");

    console.log("Starting DB Seed...");

    // 0. Create Organization
    const mainOrg = await prisma.organization.create({
        data: {
            name: 'Collaborative AI Corp',
            domain: 'ecommerce.ai'
        }
    });
    const orgId = mainOrg.id;
    console.log("✅ Seeded Organization");

    // 1. Create Users
    const hashedPassword = await bcrypt.hash('password123', 10);
    const [alice, bob, charlie, admin] = await Promise.all([
        prisma.user.create({ data: { name: 'Data Analyst', email: 'alice@ecommerce.ai', password: hashedPassword, role: 'Data Engineer', department: 'Engineering', organizationId: orgId, permissions: JSON.stringify(['dataset:manage', 'contract:edit', 'workflow:view', 'workflow:edit']) } }),
        prisma.user.create({ data: { name: 'Data Analyst', email: 'bob@ecommerce.ai', password: hashedPassword, role: 'Data Analyst', department: 'Data Science', organizationId: orgId, permissions: JSON.stringify(['dataset:manage', 'dataset:view', 'contract:edit', 'contract:view', 'workflow:view', 'query:run', 'report:create']) } }),
        prisma.user.create({ data: { name: 'Business User', email: 'charlie@ecommerce.ai', password: hashedPassword, role: 'Business User', department: 'Marketing', organizationId: orgId, permissions: JSON.stringify(['dataset:view', 'dashboard:view', 'contract:approve', 'kpi:monitor']) } }),
        prisma.user.create({ data: { name: 'Admin', email: 'admin@ecommerce.ai', password: hashedPassword, role: 'Admin', department: 'IT', organizationId: orgId, permissions: JSON.stringify(['*']) } })
    ]);
    console.log("✅ Seeded Users");

    // 1.5 Create Datasets
    await prisma.dataset.createMany({
        data: [
            { name: 'ecommerce_q3_raw.json', rawData: JSON.stringify([{ id: 101, date: '2026-03-01', revenue: 15400.50, region: 'North America' }, { id: 102, date: '2026-03-02', revenue: 'Omitted', region: 'Europe' }]), ownerId: alice.id, organizationId: orgId },
            { name: 'marketing_leads.csv', rawData: JSON.stringify([{ id: 1, email: 'lead@test.com' }]), ownerId: bob.id, organizationId: orgId }
        ]
    });
    console.log("✅ Seeded Datasets");

    // 2. Create Contracts
    await prisma.dataContract.createMany({
        data: [
            { name: 'Core Orders Dataset', domain: 'E-Commerce', ownerName: alice.name, ownerId: alice.id, organizationId: orgId, version: '2.1.0', status: 'Active', schemaDef: JSON.stringify([{ id: "1", name: "order_id", type: "UUID", description: "Primary Key", required: true, pii: false }, { id: "2", name: "total_amount", type: "Float", description: "Total value", required: true, pii: false }]) },
            { name: 'User Profile Exhaust', domain: 'Marketing', ownerName: bob.name, ownerId: bob.id, organizationId: orgId, version: '1.0.0', status: 'Draft', schemaDef: JSON.stringify([{ id: "1", name: "user_id", type: "String", description: "Foreign Key", required: true, pii: false }, { id: "2", name: "email", type: "String", description: "User Email address", required: true, pii: true }]) }
        ]
    });
    console.log("✅ Seeded Data Contracts");

    // 3. Create Workflows
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

    await prisma.workflowTask.createMany({
        data: [
            {
                title: 'Review Q3 Revenue Schema Changes',
                description: 'The upstream revenue table added 3 new columns. Validate schema compatibility with our data contracts.',
                assignee: 'Data Analyst',
                status: 'Pending',
                priority: 'High',
                category: 'Schema Validation',
                progress: 0,
                dueDate: daysFromNow(2),
                organizationId: orgId
            },
            {
                title: 'Clean Marketing Leads Dataset',
                description: 'Run data quality checks on the marketing_leads.csv file. Handle missing emails and duplicates.',
                assignee: 'Data Analyst',
                status: 'In Progress',
                priority: 'Medium',
                category: 'Data Cleaning',
                progress: 60,
                dueDate: daysFromNow(5),
                organizationId: orgId
            },
            {
                title: 'Ingest Stripe Payment Dump',
                description: 'Import Q3 Stripe payment records into the data warehouse. ~50K rows expected.',
                assignee: 'Data Analyst',
                status: 'Approved',
                priority: 'High',
                category: 'Data Ingestion',
                progress: 100,
                dueDate: daysAgo(1),
                organizationId: orgId
            }
        ]
    });
    console.log("✅ Seeded Workflows");

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
            { userId: alice.id, role: 'Data Engineer', action: 'Dataset Upload', entityType: 'Dataset', entityId: 'dataset-uuid-placeholder', organizationId: orgId }
        ]
    });
    console.log("✅ Seeded Audit Logs");

    // 5.5 Seed Notifications
    await prisma.notification.deleteMany();
    await prisma.notification.createMany({
        data: [
            {
                userId: admin.id,
                organizationId: orgId,
                title: "🛡️ Unauthorized Route Access Blocked",
                description: "User bob@ecommerce.ai attempted to access administrative panel /admin. Request was blocked and logged.",
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
                userId: bob.id,
                organizationId: orgId,
                title: "🚀 Ingest Stripe Dump Task Approved",
                description: "Workflow task 'Ingest Stripe Payment Dump' was approved by Admin and marked Completed.",
                type: "workflow",
                priority: "Low",
                read: true,
                archived: true,
                actionUrl: "/workflows"
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
