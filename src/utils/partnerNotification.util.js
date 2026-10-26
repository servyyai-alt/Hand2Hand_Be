"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyPartnerApplicationSubmitted = exports.notifyAdminApprovedPartner = exports.notifySuperAdminApprovedPartner = exports.notifyPartnerRejected = void 0;
const notification_model_1 = require("../modules/notifications/notification.model");
const user_model_1 = require("../modules/users/user.model");

async function notifyAdminsAndSuperAdmins(title, description, actionUrl = '/partners') {
    try {
        const staff = await user_model_1.UserModel.find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' }).select('_id');
        const docs = staff.map(u => ({
            userId: u._id,
            type: 'SYSTEM',
            title,
            description,
            actionUrl,
            isRead: false,
        }));
        if (docs.length > 0) {
            await notification_model_1.NotificationModel.insertMany(docs);
        }
    } catch (e) {
        console.error('Failed to notify staff:', e);
    }
}

async function notifySuperAdmins(title, description, actionUrl = '/partners') {
    try {
        const superAdmins = await user_model_1.UserModel.find({ role: 'SUPER_ADMIN', status: 'ACTIVE' }).select('_id');
        const docs = superAdmins.map(u => ({
            userId: u._id,
            type: 'SYSTEM',
            title,
            description,
            actionUrl,
            isRead: false,
        }));
        if (docs.length > 0) {
            await notification_model_1.NotificationModel.insertMany(docs);
        }
    } catch (e) {
        console.error('Failed to notify super admins:', e);
    }
}

async function notifyPartner(partnerId, title, description, actionUrl = '/partner/application-status') {
    try {
        await notification_model_1.NotificationModel.create({
            userId: partnerId,
            type: 'SYSTEM',
            title,
            description,
            actionUrl,
            isRead: false,
        });
    } catch (e) {
        console.error('Failed to notify partner:', e);
    }
}

async function notifyPartnerApplicationSubmitted(partnerName, partnerId) {
    await notifyAdminsAndSuperAdmins(
        'New Delivery Partner Application',
        `Verification required for ${partnerName}. Documents submitted for KYC review.`,
        '/partners'
    );
}
exports.notifyPartnerApplicationSubmitted = notifyPartnerApplicationSubmitted;

async function notifyAdminApprovedPartner(partnerName) {
    await notifySuperAdmins(
        'Partner Approved by Admin',
        `Delivery Partner application for ${partnerName} has been approved by Operations Admin. Super Admin verification required.`,
        '/partners'
    );
}
exports.notifyAdminApprovedPartner = notifyAdminApprovedPartner;

async function notifySuperAdminApprovedPartner(partnerName, partnerId, isFullyActivated) {
    if (isFullyActivated) {
        await notifyPartner(
            partnerId,
            'Application Approved & Activated',
            'Your H2H Delivery Partner application has been fully approved by Admin & Super Admin. You can now go online and accept delivery orders!'
        );
        await notifyAdminsAndSuperAdmins(
            'Delivery Partner Activated',
            `Delivery Partner ${partnerName} has been fully approved and is now active.`
        );
    } else {
        await notifyAdminsAndSuperAdmins(
            'Partner Approved by Super Admin',
            `Delivery Partner ${partnerName} approved by Super Admin. Operations Admin verification pending.`
        );
    }
}
exports.notifySuperAdminApprovedPartner = notifySuperAdminApprovedPartner;

async function notifyPartnerRejected(partnerId, partnerName, reason, rejectedByRole) {
    await notifyPartner(
        partnerId,
        'Application Rejected',
        `Your Delivery Partner application was rejected by ${rejectedByRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}. Reason: ${reason || 'Incomplete / unclear documentation'}. You may resubmit with updated details.`
    );
}
exports.notifyPartnerRejected = notifyPartnerRejected;
