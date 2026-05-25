"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAction = exports.AuditAction = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
var AuditAction;
(function (AuditAction) {
    AuditAction["CREATE"] = "CREATE";
    AuditAction["UPDATE"] = "UPDATE";
    AuditAction["DELETE"] = "DELETE";
    AuditAction["LOGIN"] = "LOGIN";
    AuditAction["EXPORT"] = "EXPORT";
    AuditAction["INVITE"] = "INVITE";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
const logAction = async (userId, role, organizationId, action, entityType, entityId, details) => {
    try {
        await prisma_1.default.auditLog.create({
            data: {
                userId,
                role,
                organizationId,
                action,
                entityType,
                entityId,
                details: details ? JSON.stringify(details) : null
            }
        });
    }
    catch (error) {
        console.error('Failed to create audit log:', error);
    }
};
exports.logAction = logAction;
