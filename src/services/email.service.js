"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");

class EmailService {
    constructor() {
        this.isConfigured = !!(
            process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS
        );
        if (this.isConfigured) {
            this.transporter = nodemailer_1.default.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        }
    }

    async sendAdminInvitation({ to, name, invitationToken, designation }) {
        const baseUrl = env_1.env.ADMIN_WEB_URL || 'http://localhost:3000';
        const invitationLink = `${baseUrl}/setup-password?token=${invitationToken}`;

        if (env_1.env.NODE_ENV === 'test' && !process.env.TEST_REAL_EMAIL) {
            if (!this.isConfigured) {
                return {
                    sent: false,
                    reason: 'EMAIL_NOT_CONFIGURED',
                    message: 'Email delivery is not currently configured. Please configure SMTP settings (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) in environment variables to deliver automated emails.',
                    invitationLink,
                };
            }
            return {
                sent: true,
                message: `Invitation email sent successfully to ${to}`,
                invitationLink,
            };
        }

        if (!this.isConfigured || !this.transporter) {
            logger_1.logger.info(`[EmailService: Not Configured] Admin invitation for ${to} (${name}). Setup Link: ${invitationLink}`);
            return {
                sent: false,
                reason: 'EMAIL_NOT_CONFIGURED',
                message: 'Email delivery is not currently configured. Please configure SMTP settings (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) in environment variables to deliver automated emails.',
                invitationLink,
            };
        }

        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"Hyperlocal Delivery" <noreply@hyperlocal.in>',
                to,
                subject: 'You have been invited as an Admin on H2H Platform',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px;">
                        <h2 style="color: #4f46e5;">Welcome to H2H Admin Platform</h2>
                        <p>Hello <strong>${name}</strong>,</p>
                        <p>You have been invited to join the H2H Admin team as <strong>${designation || 'Administrator'}</strong>.</p>
                        <p>To set up your account password and get started, please click the button below:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${invitationLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Up Password</a>
                        </div>
                        <p style="color: #6b7280; font-size: 14px;">This invitation link will expire in 48 hours.</p>
                        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Note: Your account will also require Super Admin approval before you can access protected dashboard features.</p>
                    </div>
                `,
            });
            logger_1.logger.info(`[EmailService] Invitation email successfully sent to ${to}`);
            return {
                sent: true,
                message: `Invitation email sent successfully to ${to}`,
                invitationLink,
            };
        } catch (err) {
            logger_1.logger.error(`[EmailService] Failed to send email to ${to}: ${err.message}`);
            return {
                sent: false,
                reason: 'DELIVERY_FAILED',
                message: `Email sending failed (${err.message}). You may manually share the setup link.`,
                invitationLink,
            };
        }
    }

    async sendApprovalNotification({ to, name, approved, reason }) {
        if (env_1.env.NODE_ENV === 'test' && !process.env.TEST_REAL_EMAIL) {
            if (!this.isConfigured) {
                return {
                    sent: false,
                    reason: 'EMAIL_NOT_CONFIGURED',
                    message: 'Email delivery is not configured. Configure SMTP settings in environment variables to deliver notifications.',
                };
            }
            return { sent: true, message: 'Approval notification sent.' };
        }

        if (!this.isConfigured || !this.transporter) {
            logger_1.logger.info(`[EmailService: Not Configured] Admin ${approved ? 'approval' : 'rejection'} notice for ${to} (${name})`);
            return {
                sent: false,
                reason: 'EMAIL_NOT_CONFIGURED',
                message: 'Email delivery is not configured. Configure SMTP settings in environment variables to deliver notifications.',
            };
        }

        try {
            const subject = approved
                ? 'Your H2H Admin Account Has Been Approved'
                : 'Update on Your H2H Admin Account';
            const html = approved
                ? `<p>Hello <strong>${name}</strong>,</p><p>Your H2H administrator account has been approved by the Super Admin. You can now log in to the dashboard.</p>`
                : `<p>Hello <strong>${name}</strong>,</p><p>Your administrator account request was not approved.${reason ? `<br/>Reason: <em>${reason}</em>` : ''}</p>`;

            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"Hyperlocal Delivery" <noreply@hyperlocal.in>',
                to,
                subject,
                html,
            });
            return { sent: true, message: 'Approval notification sent.' };
        } catch (err) {
            logger_1.logger.error(`[EmailService] Failed to send approval notice to ${to}: ${err.message}`);
            return { sent: false, reason: 'DELIVERY_FAILED', message: err.message };
        }
    }
}

exports.EmailService = EmailService;
