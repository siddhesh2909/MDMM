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
        prisma.user.create({ data: { name: 'Alice Engineer', email: 'alice@ecommerce.ai', password: hashedPassword, role: 'Data Engineer', department: 'Engineering', organizationId: orgId, permissions: JSON.stringify(['dataset:manage', 'contract:edit', 'workflow:view', 'workflow:edit']) } }),
        prisma.user.create({ data: { name: 'Bob Analyst', email: 'bob@ecommerce.ai', password: hashedPassword, role: 'Data Analyst', department: 'Data Science', organizationId: orgId, permissions: JSON.stringify(['dataset:view', 'contract:view', 'workflow:view', 'query:run', 'report:create']) } }),
        prisma.user.create({ data: { name: 'Charlie Biz', email: 'charlie@ecommerce.ai', password: hashedPassword, role: 'Business User', department: 'Marketing', organizationId: orgId, permissions: JSON.stringify(['dataset:view', 'dashboard:view', 'contract:approve', 'kpi:monitor']) } }),
        prisma.user.create({ data: { name: 'Admin Root', email: 'admin@ecommerce.ai', password: hashedPassword, role: 'Admin', department: 'IT', organizationId: orgId, permissions: JSON.stringify(['*']) } })
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
                assignee: 'Alice Engineer',
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
                assignee: 'Bob Analyst',
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
                assignee: 'Alice Engineer',
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
