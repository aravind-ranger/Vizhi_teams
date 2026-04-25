import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendInviteEmail = async (email: string, token: string, role: string) => {
  const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;
  
  const html = `
    <div style="font-family: 'Plus Jakarta Sans', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #DEE2E6; border-radius: 12px; overflow: hidden;">
      <div style="background: #3B5BDB; padding: 40px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Vizhi Teams</h1>
      </div>
      <div style="padding: 40px 30px;">
        <h2 style="color: #212529; margin-top: 0;">You're Invited!</h2>
        <p style="color: #495057; line-height: 1.6;">You have been invited to join the <strong>Vizhi Teams</strong> portal as a <strong>${role}</strong>.</p>
        <p style="color: #495057; line-height: 1.6;">Click the button below to accept your invitation and set up your account. This link will expire in 48 hours.</p>
        <div style="text-align: center; margin: 40px 0;">
          <a href="${inviteLink}" style="background: #3B5BDB; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
        </div>
        <p style="color: #868E96; font-size: 12px; margin-top: 40px; border-top: 1px solid #DEE2E6; pt-20">If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'You are invited to join Vizhi Teams',
    html,
  });
};

export const sendEarlyExitAlert = async (adminEmails: string[], employeeName: string, checkIn: string, checkOut: string, expected: string) => {
  const html = `
    <div style="font-family: 'Plus Jakarta Sans', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #DEE2E6; border-radius: 12px; overflow: hidden;">
      <div style="background: #E03131; padding: 40px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Early Exit Alert</h1>
      </div>
      <div style="padding: 40px 30px;">
        <h2 style="color: #212529; margin-top: 0;">Action Required</h2>
        <p style="color: #495057; line-height: 1.6;"><strong>${employeeName}</strong> has checked out early today. Their account has been automatically blocked.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #DEE2E6; font-weight: bold; background: #F8F9FA;">Check-In</td>
            <td style="padding: 10px; border: 1px solid #DEE2E6;">${checkIn}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #DEE2E6; font-weight: bold; background: #F8F9FA;">Check-Out</td>
            <td style="padding: 10px; border: 1px solid #DEE2E6;">${checkOut}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #DEE2E6; font-weight: bold; background: #F8F9FA;">Expected</td>
            <td style="padding: 10px; border: 1px solid #DEE2E6;">${expected}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${process.env.FRONTEND_URL}/attendance" style="background: #E03131; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Review & Take Action</a>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: adminEmails,
    subject: `Early Exit Alert: ${employeeName}`,
    html,
  });
};

export const sendReloginApprovedEmail = async (email: string, allowedFrom: string) => {
  const html = `
    <div style="font-family: 'Plus Jakarta Sans', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #DEE2E6; border-radius: 12px; overflow: hidden;">
      <div style="background: #2F9E44; padding: 40px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Login Approved</h1>
      </div>
      <div style="padding: 40px 30px;">
        <h2 style="color: #212529; margin-top: 0;">You're Back!</h2>
        <p style="color: #495057; line-height: 1.6;">Your request for re-login has been approved by the administrator.</p>
        <p style="color: #495057; line-height: 1.6;">You can now check in again and resume your work.</p>
        
        <div style="background: #F8F9FA; border-left: 4px solid #2F9E44; padding: 20px; margin: 30px 0;">
          <p style="margin: 0; font-weight: bold; color: #212529;">Allowed From:</p>
          <p style="margin: 5px 0 0; font-size: 18px; color: #2F9E44;">${allowedFrom}</p>
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #2F9E44; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Go to Dashboard</a>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Re-login Approved: Vizhi Teams',
    html,
  });
};

export const sendEmail = async (to: string, subject: string, html: string) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
};
