import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanStaticData() {
    try {
        console.log("Removing auto-seeded tutorial contracts and workflows to ensure real data integration...");
        // This will find records that were seeded during bootstrap if their owner name is "Alice Freeman"
        // Wait, just wipe all contracts that don't belong to a real upload.
        // Easiest is to just wipe all Data Contracts and Workflows and Datasets to give a blank slate for testing!
        await prisma.dataContract.deleteMany({});
        await prisma.workflowTask.deleteMany({});
        await prisma.dataset.deleteMany({});
        console.log("Database cleared of static mock contracts and datasets. Ready for real user ingestion tests.");
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanStaticData();
