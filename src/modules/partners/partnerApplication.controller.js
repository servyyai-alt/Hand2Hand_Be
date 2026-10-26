"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerApplicationController = void 0;
const user_model_1 = require("../users/user.model");
const partnerProfile_model_1 = require("./partnerProfile.model");
const auditLog_model_1 = require("../admin/auditLog.model");
const response_1 = require("../../utils/response");
const AppError_1 = require("../../errors/AppError");
const kycStorage_util_1 = require("../../utils/kycStorage.util");
const partnerNotification_util_1 = require("../../utils/partnerNotification.util");
const auth_service_1 = require("../auth/auth.service");

const authService = new auth_service_1.AuthService();

class PartnerApplicationController {
    async apply(req, res, next) {
        try {
            const data = req.body;
            // Force role to DELIVERY_PARTNER
            data.role = 'DELIVERY_PARTNER';
            const result = await authService.register(data);
            const partnerId = result.partnerId || (result.userId ? `H2H-DP-${result.userId.toString().slice(-6).toUpperCase()}` : 'H2H-DP-PENDING');
            const applicationRef = result.applicationRef || partnerId;
            (0, response_1.sendSuccess)(res, {
                ...result,
                partnerId,
                applicationRef,
                email: data.email ? data.email.trim().toLowerCase() : '',
                phone: data.phone ? data.phone.trim() : '',
                status: 'PENDING_VERIFICATION'
            }, 'Application submitted for verification.', 201);
        } catch (err) {
            next(err);
        }
    }

    async getApplicationStatus(req, res, next) {
        try {
            const userId = req.user?.userId;
            const queryPhone = req.query?.phone;
            const queryAppId = req.query?.applicationId;

            let userQuery = null;
            if (userId) {
                userQuery = { _id: userId };
            } else if (queryPhone) {
                const cleanPhone = String(queryPhone).replace(/[\s\-\(\)]/g, '').replace(/^\+91/, '');
                userQuery = { phone: cleanPhone, role: 'DELIVERY_PARTNER' };
            } else if (queryAppId) {
                const cleanId = String(queryAppId).replace(/^#H2H-/, '').trim();
                if (cleanId.match(/^[0-9a-fA-F]{24}$/)) {
                    userQuery = { _id: cleanId, role: 'DELIVERY_PARTNER' };
                } else if (cleanId.length >= 6) {
                    userQuery = {
                        $or: [
                            { phone: cleanId },
                            { phone: `+91${cleanId}` }
                        ],
                        role: 'DELIVERY_PARTNER'
                    };
                }
            }

            if (!userQuery) {
                throw new AppError_1.AppError('Authentication token or phone number query is required', 400);
            }

            const user = await user_model_1.UserModel.findOne(userQuery)
                .select('name phone email avatar role status partnerId applicationRef approvalStatus adminApprovalStatus superAdminApprovalStatus accountStatus isActive canWork canAcceptDeliveries rejectionReason applicationSubmittedAt adminApprovedAt superAdminApprovedAt rejectedAt createdAt')
                .populate('approvedByAdmin', 'name email designation')
                .populate('approvedBySuperAdmin', 'name email designation')
                .populate('rejectedBy', 'name email designation')
                .lean();

            if (!user) throw new AppError_1.NotFoundError('Partner application');

            const profile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: user._id })
                .select('vehicle kyc kycStatus documents rejectionReason')
                .lean();

            let detailedStatus = 'PENDING_ADMIN_REVIEW';
            if (user.status === 'BLOCKED' || user.accountStatus === 'SUSPENDED') {
                detailedStatus = 'SUSPENDED';
            } else if (user.approvalStatus === 'REJECTED' || user.adminApprovalStatus === 'REJECTED' || user.superAdminApprovalStatus === 'REJECTED') {
                detailedStatus = 'REJECTED';
            } else if (
                user.approvalStatus === 'APPROVED' ||
                user.status === 'ACTIVE' ||
                user.accountStatus === 'ACTIVE' ||
                user.superAdminApprovalStatus === 'APPROVED' ||
                user.adminApprovalStatus === 'APPROVED'
            ) {
                detailedStatus = 'APPROVED';
            }

            const partnerId = user.partnerId || `H2H-DP-${user._id.toString().slice(-6).toUpperCase()}`;
            const applicationRef = user.applicationRef || partnerId;

            // Safe masking helpers
            const maskAadhaar = (num) => {
                if (!num) return '';
                const clean = String(num).replace(/\D/g, '');
                return clean.length >= 4 ? `XXXX XXXX ${clean.slice(-4)}` : 'XXXX XXXX XXXX';
            };
            const maskPan = (num) => {
                if (!num) return '';
                const clean = String(num).trim().toUpperCase();
                return clean.length >= 6 ? `${clean.slice(0, 5)}****${clean.slice(-1)}` : 'ABCDE****F';
            };
            const maskLicence = (num) => {
                if (!num) return '';
                const clean = String(num).trim().toUpperCase();
                return clean.length >= 5 ? `${clean.slice(0, 2)}********${clean.slice(-3)}` : 'DL********';
            };

            const kycDocs = [
                {
                    name: 'Driving Licence',
                    type: 'DRIVING_LICENCE',
                    submitted: Boolean(profile?.kyc?.drivingLicencePhoto),
                    maskedNumber: maskLicence(profile?.kyc?.drivingLicenceNumber),
                    status: Boolean(profile?.kyc?.drivingLicencePhoto) ? 'SUBMITTED' : 'PENDING_UPLOAD',
                },
                {
                    name: 'PAN Card',
                    type: 'PAN_CARD',
                    submitted: Boolean(profile?.kyc?.panPhoto),
                    maskedNumber: maskPan(profile?.kyc?.panNumber),
                    status: Boolean(profile?.kyc?.panPhoto) ? 'SUBMITTED' : 'PENDING_UPLOAD',
                },
                {
                    name: 'Aadhaar Card',
                    type: 'AADHAAR_CARD',
                    submitted: Boolean(profile?.kyc?.aadhaarPhoto),
                    maskedNumber: maskAadhaar(profile?.kyc?.aadhaarNumber),
                    status: Boolean(profile?.kyc?.aadhaarPhoto) ? 'SUBMITTED' : 'PENDING_UPLOAD',
                },
            ];

            const isApproved = detailedStatus === 'APPROVED';
            const effAccountStatus = isApproved ? 'ACTIVE' : (user.accountStatus || 'PENDING_VERIFICATION');
            const effApprovalStatus = isApproved ? 'APPROVED' : (user.approvalStatus || 'PENDING');
            const effIsActive = isApproved ? true : Boolean(user.isActive);
            const effCanWork = isApproved ? true : Boolean(user.canWork);

            const applicationData = {
                applicationId: user._id,
                partnerId,
                applicationRef,
                user: {
                    id: user._id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    avatar: user.avatar,
                    role: user.role,
                    partnerId,
                    applicationRef,
                    accountStatus: effAccountStatus,
                    isActive: effIsActive,
                    canWork: effCanWork,
                    approvalStatus: effApprovalStatus,
                    adminApprovalStatus: isApproved ? 'APPROVED' : (user.adminApprovalStatus || 'PENDING'),
                    superAdminApprovalStatus: isApproved ? 'APPROVED' : (user.superAdminApprovalStatus || 'PENDING'),
                },
                detailedStatus,
                status: isApproved ? 'ACTIVE' : effApprovalStatus,
                accountStatus: effAccountStatus,
                approvalStatus: effApprovalStatus,
                adminApprovalStatus: isApproved ? 'APPROVED' : (user.adminApprovalStatus || 'PENDING'),
                superAdminApprovalStatus: isApproved ? 'APPROVED' : (user.superAdminApprovalStatus || 'PENDING'),
                adminApproval: {
                    status: isApproved ? 'APPROVED' : (user.adminApprovalStatus || 'PENDING'),
                    approvedBy: user.approvedByAdmin,
                    approvedAt: user.adminApprovedAt,
                },
                superAdminApproval: {
                    status: isApproved ? 'APPROVED' : (user.superAdminApprovalStatus || 'PENDING'),
                    approvedBy: user.approvedBySuperAdmin,
                    approvedAt: user.superAdminApprovedAt,
                },
                isActive: effIsActive,
                canWork: effCanWork,
                canAcceptDeliveries: isApproved ? true : Boolean(user.canAcceptDeliveries),
                rejectionReason: user.rejectionReason || profile?.rejectionReason || '',
                rejectedBy: user.rejectedBy,
                rejectedAt: user.rejectedAt,
                approvedByAdmin: user.approvedByAdmin,
                adminApprovedAt: user.adminApprovedAt,
                approvedBySuperAdmin: user.approvedBySuperAdmin,
                superAdminApprovedAt: user.superAdminApprovedAt,
                applicationSubmittedAt: user.applicationSubmittedAt || user.createdAt,
                vehicle: profile?.vehicle || { type: 'MOTORCYCLE', registrationNumber: '' },
                kyc: {
                    ...(profile?.kyc || {}),
                    maskedDrivingLicenceNumber: maskLicence(profile?.kyc?.drivingLicenceNumber),
                    maskedPanNumber: maskPan(profile?.kyc?.panNumber),
                    maskedAadhaarNumber: maskAadhaar(profile?.kyc?.aadhaarNumber),
                    hasDrivingLicence: Boolean(profile?.kyc?.drivingLicencePhoto),
                    hasPanCard: Boolean(profile?.kyc?.panPhoto),
                    hasAadhaarCard: Boolean(profile?.kyc?.aadhaarPhoto),
                    hasProfilePhoto: Boolean(profile?.kyc?.profilePhoto || user.avatar),
                },
                kycDocuments: kycDocs,
                documents: profile?.documents || [],
            };

            (0, response_1.sendSuccess)(res, applicationData, 'Application status loaded');
        } catch (err) {
            next(err);
        }
    }

    async resubmit(req, res, next) {
        try {
            const userId = req.user.userId;
            const data = req.body;

            const user = await user_model_1.UserModel.findById(userId);
            if (!user) throw new AppError_1.NotFoundError('User');
            if (user.role !== 'DELIVERY_PARTNER') throw new AppError_1.ForbiddenError('Not a delivery partner');

            let savedDlPhoto = data.drivingLicencePhoto ? (0, kycStorage_util_1.saveKycBase64)(data.drivingLicencePhoto, 'dl') : undefined;
            let savedPanPhoto = data.panPhoto ? (0, kycStorage_util_1.saveKycBase64)(data.panPhoto, 'pan') : undefined;
            let savedAadhaarPhoto = data.aadhaarPhoto ? (0, kycStorage_util_1.saveKycBase64)(data.aadhaarPhoto, 'aadhaar') : undefined;
            let savedProfilePhoto = (data.profilePhoto || data.avatar) ? (0, kycStorage_util_1.saveKycBase64)(data.profilePhoto || data.avatar, 'profile') : undefined;

            user.approvalStatus = 'PENDING';
            user.adminApprovalStatus = 'PENDING';
            user.superAdminApprovalStatus = 'PENDING';
            user.accountStatus = 'PENDING_VERIFICATION';
            user.status = 'PENDING_VERIFICATION';
            user.isActive = false;
            user.canWork = false;
            user.canAcceptDeliveries = false;
            user.rejectionReason = '';
            user.rejectedBy = undefined;
            user.rejectedAt = undefined;
            user.applicationSubmittedAt = new Date();
            if (savedProfilePhoto) user.avatar = savedProfilePhoto;
            if (data.name) user.name = data.name.trim();
            if (data.email) user.email = data.email.trim().toLowerCase();
            await user.save();

            let profile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId });
            if (!profile) {
                profile = new partnerProfile_model_1.PartnerProfileModel({ userId });
            }

            if (data.vehicleType) profile.vehicle.type = data.vehicleType;
            if (data.vehicleNumber || data.registrationNumber) {
                profile.vehicle.registrationNumber = data.vehicleNumber || data.registrationNumber;
            }

            if (data.drivingLicenceNumber) profile.kyc.drivingLicenceNumber = data.drivingLicenceNumber;
            if (savedDlPhoto) profile.kyc.drivingLicencePhoto = savedDlPhoto;
            if (data.panNumber) profile.kyc.panNumber = data.panNumber;
            if (savedPanPhoto) profile.kyc.panPhoto = savedPanPhoto;
            if (data.aadhaarNumber) profile.kyc.aadhaarNumber = data.aadhaarNumber;
            if (savedAadhaarPhoto) profile.kyc.aadhaarPhoto = savedAadhaarPhoto;
            if (savedProfilePhoto) profile.kyc.profilePhoto = savedProfilePhoto;

            profile.kycStatus = 'PENDING';
            profile.rejectionReason = '';

            const documents = [];
            if (profile.kyc.drivingLicencePhoto) {
                documents.push({ type: 'DRIVING_LICENCE', url: profile.kyc.drivingLicencePhoto, number: profile.kyc.drivingLicenceNumber, status: 'PENDING' });
            }
            if (profile.kyc.panPhoto) {
                documents.push({ type: 'PAN_CARD', url: profile.kyc.panPhoto, number: profile.kyc.panNumber, status: 'PENDING' });
            }
            if (profile.kyc.aadhaarPhoto) {
                documents.push({ type: 'AADHAAR_CARD', url: profile.kyc.aadhaarPhoto, number: profile.kyc.aadhaarNumber, status: 'PENDING' });
            }
            profile.documents = documents;
            await profile.save();

            await (0, partnerNotification_util_1.notifyPartnerApplicationSubmitted)(user.name, user._id);
            try {
                await auditLog_model_1.AdminAuditLogModel.create({
                    action: 'PARTNER_RESUBMITTED',
                    performedBy: user._id,
                    targetUser: user._id,
                    details: { name: user.name, phone: user.phone },
                });
            } catch (e) {}

            (0, response_1.sendSuccess)(res, { message: 'Application resubmitted successfully for review' }, 'Application resubmitted');
        } catch (err) {
            next(err);
        }
    }

    async serveSecureDocument(req, res, next) {
        try {
            const filename = req.params.filename;
            const filePath = (0, kycStorage_util_1.getKycFilePath)(filename);
            if (!filePath) {
                return res.status(404).json({ success: false, error: { message: 'Document not found' } });
            }
            res.sendFile(filePath);
        } catch (err) {
            next(err);
        }
    }
}

exports.PartnerApplicationController = PartnerApplicationController;
