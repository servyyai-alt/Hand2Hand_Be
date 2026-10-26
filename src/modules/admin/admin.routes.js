"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("./admin.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");

const router = (0, express_1.Router)();
const ctrl = new admin_controller_1.AdminController();

// All admin routes require authentication
router.use(auth_middleware_1.authenticate);

// General operations routes accessible by ADMIN and SUPER_ADMIN
const adminAccess = (0, role_middleware_1.authorize)('ADMIN', 'SUPER_ADMIN');
router.get('/dashboard', adminAccess, ctrl.getDashboard.bind(ctrl));
router.get('/customers', adminAccess, ctrl.getCustomers.bind(ctrl));
router.patch('/customers/:id/status', adminAccess, ctrl.updateCustomerStatus.bind(ctrl));
router.get('/customers/:id/orders', adminAccess, ctrl.getCustomerOrderHistory.bind(ctrl));
router.get('/partners', adminAccess, ctrl.getPartners.bind(ctrl));
router.get('/partners/:id', adminAccess, ctrl.getPartnerApplicationById.bind(ctrl));
router.post('/partners/:id/approve', adminAccess, ctrl.approvePartnerByAdmin.bind(ctrl));
router.patch('/partners/:id/approve', adminAccess, ctrl.approvePartnerByAdmin.bind(ctrl));
router.post('/partners/:id/admin-approve', adminAccess, ctrl.approvePartnerByAdmin.bind(ctrl));
router.patch('/partners/:id/admin-approve', adminAccess, ctrl.approvePartnerByAdmin.bind(ctrl));
router.post('/partners/:id/reject', adminAccess, ctrl.rejectPartnerByAdmin.bind(ctrl));
router.patch('/partners/:id/reject', adminAccess, ctrl.rejectPartnerByAdmin.bind(ctrl));
router.post('/partners/:id/admin-reject', adminAccess, ctrl.rejectPartnerByAdmin.bind(ctrl));
router.patch('/partners/:id/admin-reject', adminAccess, ctrl.rejectPartnerByAdmin.bind(ctrl));
router.patch('/partners/:id/kyc', adminAccess, ctrl.updatePartnerKyc.bind(ctrl));
router.patch('/partners/:id/status', adminAccess, ctrl.updatePartnerStatus.bind(ctrl));

// Aliased delivery-partner-applications endpoints as requested in spec
router.get('/delivery-partner-applications', adminAccess, ctrl.getPartners.bind(ctrl));
router.get('/delivery-partner-applications/:id', adminAccess, ctrl.getPartnerApplicationById.bind(ctrl));
router.post('/delivery-partner-applications/:id/approve', adminAccess, ctrl.approvePartnerByAdmin.bind(ctrl));
router.patch('/delivery-partner-applications/:id/approve', adminAccess, ctrl.approvePartnerByAdmin.bind(ctrl));
router.post('/delivery-partner-applications/:id/reject', adminAccess, ctrl.rejectPartnerByAdmin.bind(ctrl));
router.patch('/delivery-partner-applications/:id/reject', adminAccess, ctrl.rejectPartnerByAdmin.bind(ctrl));
router.get('/documents/:filename', adminAccess, ctrl.serveSecureDocument.bind(ctrl));

// Super Admin partner approval routes
router.post('/partners/:id/super-admin-approve', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.approvePartnerBySuperAdmin.bind(ctrl));
router.patch('/partners/:id/super-admin-approve', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.approvePartnerBySuperAdmin.bind(ctrl));
router.post('/partners/:id/super-admin/approve', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.approvePartnerBySuperAdmin.bind(ctrl));
router.patch('/partners/:id/super-admin/approve', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.approvePartnerBySuperAdmin.bind(ctrl));
router.post('/partners/:id/super-admin-reject', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.rejectPartnerBySuperAdmin.bind(ctrl));
router.patch('/partners/:id/super-admin-reject', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.rejectPartnerBySuperAdmin.bind(ctrl));
router.post('/partners/:id/super-admin/reject', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.rejectPartnerBySuperAdmin.bind(ctrl));
router.patch('/partners/:id/super-admin/reject', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.rejectPartnerBySuperAdmin.bind(ctrl));
router.post('/super-admin/partners/:id/approve', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.approvePartnerBySuperAdmin.bind(ctrl));
router.patch('/super-admin/partners/:id/approve', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.approvePartnerBySuperAdmin.bind(ctrl));
router.post('/super-admin/partners/:id/reject', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.rejectPartnerBySuperAdmin.bind(ctrl));
router.patch('/super-admin/partners/:id/reject', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.rejectPartnerBySuperAdmin.bind(ctrl));
router.post('/super-admin/delivery-partner-applications/:id/approve', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.approvePartnerBySuperAdmin.bind(ctrl));
router.patch('/super-admin/delivery-partner-applications/:id/approve', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.approvePartnerBySuperAdmin.bind(ctrl));
router.post('/super-admin/delivery-partner-applications/:id/reject', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.rejectPartnerBySuperAdmin.bind(ctrl));
router.patch('/super-admin/delivery-partner-applications/:id/reject', (0, role_middleware_1.authorize)('SUPER_ADMIN'), ctrl.rejectPartnerBySuperAdmin.bind(ctrl));

router.get('/deliveries', adminAccess, ctrl.getDeliveries.bind(ctrl));
router.patch('/deliveries/:id/reassign', adminAccess, ctrl.reassignDeliveryPartner.bind(ctrl));
router.patch('/deliveries/:id/cancel', adminAccess, ctrl.cancelDelivery.bind(ctrl));
router.post('/deliveries/:id/resolve-mismatch', adminAccess, ctrl.resolveMismatch.bind(ctrl));
router.get('/users', adminAccess, ctrl.getUsers.bind(ctrl));
router.put('/users/:id/status', adminAccess, ctrl.updateUserStatus.bind(ctrl));

// Management and Owner-level routes strictly restricted to SUPER_ADMIN only
const superAdminOnly = (0, role_middleware_1.authorize)('SUPER_ADMIN');

// 1. Admin Management
router.get('/admins', superAdminOnly, ctrl.getAdmins.bind(ctrl));
router.post('/admins', superAdminOnly, ctrl.createAdmin.bind(ctrl));
router.get('/admins/approvals', superAdminOnly, ctrl.getAdminApprovals.bind(ctrl));
router.get('/admins/audit-logs', superAdminOnly, ctrl.getAuditLogs.bind(ctrl));
router.get('/admins/:id', superAdminOnly, ctrl.getAdminById.bind(ctrl));
router.put('/admins/:id', superAdminOnly, ctrl.updateAdmin.bind(ctrl));
router.post('/admins/:id/approve', superAdminOnly, ctrl.approveAdmin.bind(ctrl));
router.post('/admins/:id/reject', superAdminOnly, ctrl.rejectAdmin.bind(ctrl));
router.patch('/admins/:id/status', superAdminOnly, ctrl.updateAdminStatus.bind(ctrl));
router.post('/admins/:id/resend-invitation', superAdminOnly, ctrl.resendInvitation.bind(ctrl));
router.post('/admins/:id/reset-password', superAdminOnly, ctrl.resetAdminPassword.bind(ctrl));

// 2. Platform Settings
router.get('/settings', superAdminOnly, ctrl.getSettings.bind(ctrl));
router.put('/settings', superAdminOnly, ctrl.updateSettings.bind(ctrl));

// 3. Payments & Financial Overview
router.get('/payments/overview', superAdminOnly, ctrl.getPaymentsOverview.bind(ctrl));
router.get('/payments/transactions', superAdminOnly, ctrl.getPaymentTransactions.bind(ctrl));
router.post('/payments/process-payout', superAdminOnly, ctrl.processPartnerPayout.bind(ctrl));

// 4. Reports & Analytics
router.get('/reports/overview', superAdminOnly, ctrl.getReportsOverview.bind(ctrl));

// 5. Support & Dispute Oversight
router.get('/support/oversight', superAdminOnly, ctrl.getSupportOversight.bind(ctrl));
router.patch('/support/oversight/:id/resolve', superAdminOnly, ctrl.resolveDispute.bind(ctrl));

// 6. Security & Activity Logs
router.get('/audit-logs', superAdminOnly, ctrl.getAuditLogs.bind(ctrl));

// 7. Content Management Broadcast
router.post('/cms/broadcast', superAdminOnly, ctrl.broadcastNotification.bind(ctrl));

exports.default = router;
