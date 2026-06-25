import prisma from '../lib/prisma';
import { createReport } from '../controllers/reports.controller';

// Background polling check interval (default: check every 2 minutes)
let schedulerInterval: NodeJS.Timeout | null = null;

// Duration constants in milliseconds
const DURATIONS = {
    Daily: 24 * 60 * 60 * 1000,
    Weekly: 7 * 24 * 60 * 60 * 1000,
    Monthly: 30 * 24 * 60 * 60 * 1000
};

export function startScheduler() {
    if (schedulerInterval) return;

    console.log('⏳ Automated Reports Scheduler service initialized.');

    schedulerInterval = setInterval(async () => {
        try {
            // Find all active schedules
            const activeSchedules = await prisma.reportSchedule.findMany({
                where: { status: 'Active' }
            });

            for (const schedule of activeSchedules) {
                // Determine duration threshold based on frequency
                const freq = schedule.frequency as keyof typeof DURATIONS;
                const thresholdMs = DURATIONS[freq] || DURATIONS.Daily;
                const now = new Date();

                // Find reports generated for this schedule
                const latestReport = await prisma.report.findFirst({
                    where: {
                        datasetId: schedule.datasetId,
                        organizationId: schedule.organizationId,
                        name: { startsWith: `Scheduled: ${schedule.name}` }
                    },
                    orderBy: { createdAt: 'desc' }
                });

                let isDue = false;
                if (!latestReport) {
                    isDue = true;
                } else {
                    const elapsed = now.getTime() - latestReport.createdAt.getTime();
                    if (elapsed >= thresholdMs) {
                        isDue = true;
                    }
                }

                if (isDue) {
                    console.log(`⏰ Schedule "${schedule.name}" is due. Generating automated report...`);

                    // Get a valid user from the organization to act as owner
                    const orgUser = await prisma.user.findFirst({
                        where: { organizationId: schedule.organizationId }
                    });

                    if (orgUser) {
                        // Mock request/response to trigger createReport logic
                        const mockReq = {
                            user: orgUser,
                            body: {
                                datasetId: schedule.datasetId,
                                name: `Scheduled: ${schedule.name} (${now.toLocaleDateString()})`,
                                format: schedule.format
                            }
                        } as any;

                        const mockRes = {
                            status: (code: number) => {
                                return {
                                    json: (data: any) => {
                                        console.log(`✅ Auto-generated report for schedule "${schedule.name}". Status: ${code}`);
                                    }
                                };
                            }
                        } as any;

                        await createReport(mockReq, mockRes);
                    } else {
                        console.warn(`⚠️ No user found in organization ${schedule.organizationId} to run scheduled report.`);
                    }
                }
            }
        } catch (err) {
            console.error('Error in automated reports scheduler loop:', err);
        }
    }, 120 * 1000); // 2 minutes polling
}

export function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('Scheduler service stopped.');
    }
}
