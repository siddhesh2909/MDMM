import { AuthenticatedUser } from '../middleware/auth';

export interface DatasetFields {
    id: string;
    ownerId: string;
    organizationId: string;
    createdBy?: string;
    visibility: string; // 'private' | 'shared' | 'organization'
    sharedWith: string; // JSON string of { userId: string; permission: 'viewer' | 'editor' | 'manager' }[]
}

interface SharedUser {
    userId: string;
    permission: 'viewer' | 'editor' | 'manager' | 'owner';
}

function parseSharedWith(sharedWithStr: string): SharedUser[] {
    try {
        const parsed = JSON.parse(sharedWithStr);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export const canViewDataset = (dataset: DatasetFields, user: AuthenticatedUser): boolean => {
    // Owner/Creator bypass
    if (dataset.ownerId === user.id || dataset.createdBy === user.id) return true;

    // Check shared lists
    const shared = parseSharedWith(dataset.sharedWith);
    if (shared.some(s => s.userId === user.id)) return true;

    // Check visibility
    if (dataset.visibility === 'organization' && dataset.organizationId === user.organizationId) {
        return true;
    }

    // Admins bypass ONLY IF the dataset is not private
    if (user.role === 'Admin' && dataset.visibility !== 'private') return true;

    return false;
};

export const canEditDataset = (dataset: DatasetFields, user: AuthenticatedUser): boolean => {
    // Owner/Creator bypass
    if (dataset.ownerId === user.id || dataset.createdBy === user.id) return true;

    // Check shared list permissions
    const shared = parseSharedWith(dataset.sharedWith);
    const userShare = shared.find(s => s.userId === user.id);
    if (userShare) {
        return ['editor', 'manager', 'owner'].includes(userShare.permission);
    }

    // Admins bypass ONLY IF the dataset is not private
    if (user.role === 'Admin' && dataset.visibility !== 'private') return true;

    return false;
};

export const canDeleteDataset = (dataset: DatasetFields, user: AuthenticatedUser): boolean => {
    // Owner/Creator only
    if (dataset.ownerId === user.id || dataset.createdBy === user.id) return true;

    // Check shared list for 'owner' permission override
    const shared = parseSharedWith(dataset.sharedWith);
    const userShare = shared.find(s => s.userId === user.id);
    if (userShare?.permission === 'owner') return true;

    // Admins bypass ONLY IF the dataset is not private
    if (user.role === 'Admin' && dataset.visibility !== 'private') return true;

    return false;
};

export const canShareDataset = (dataset: DatasetFields, user: AuthenticatedUser): boolean => {
    // Owner/Creator bypass
    if (dataset.ownerId === user.id || dataset.createdBy === user.id) return true;

    // Check shared list permissions (managers or owner overrides can share)
    const shared = parseSharedWith(dataset.sharedWith);
    const userShare = shared.find(s => s.userId === user.id);
    if (userShare) {
        return ['manager', 'owner'].includes(userShare.permission);
    }

    // Admins bypass ONLY IF the dataset is not private
    if (user.role === 'Admin' && dataset.visibility !== 'private') return true;

    return false;
};
