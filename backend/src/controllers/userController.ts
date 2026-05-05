import { Request, Response } from 'express';
import pool from '../db';
import { hashPassword } from '../utils/auth';
import { sendEmail } from '../services/emailService';
import { v4 as uuidv4 } from 'uuid';

export const inviteEmployee = async (req: any, res: Response) => {
  const { email, role, department, name } = req.body;
  const invited_by = req.user.id;

  try {
    // Check if user already exists
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Default password logic as requested: {name}@123
    const defaultPassword = `${name.split(' ')[0]}@123`;
    const hashedPassword = await hashPassword(defaultPassword);

    const newUser = await pool.query(`
      INSERT INTO users (name, email, password, role, department, is_active, is_verified)
      VALUES ($1, $2, $3, $4, $5, true, true)
      RETURNING id, name, email, role
    `, [name, email, hashedPassword, role, department]);

    // Send invitation email with the default password
    const emailSubject = 'Welcome to Vizhi Teams!';
    const emailContent = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 12px;">
        <h2 style="color: #3B5BDB;">Welcome, ${name}!</h2>
        <p>You have been added to the <strong>Vizhi Teams</strong> portal as a <strong>${role}</strong>.</p>
        <p>Your account has been created with the following credentials:</p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Password:</strong> ${defaultPassword}</p>
        </div>
        <p>Please log in and change your password as soon as possible.</p>
        <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; background: #3B5BDB; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Login Now</a>
        <br/><br/>
        <p>Regards,<br/>Vizhi Teams HR</p>
      </div>
    `;

    try {
      await sendEmail(email, emailSubject, emailContent);
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr);
    }

    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getEmployees = async (req: Request, res: Response) => {
  try {
    const employees = await pool.query(`
      SELECT id, name, email, role, department, is_active, avatar_url, created_at 
      FROM users 
      ORDER BY name ASC
    `);
    res.json(employees.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateAvailabilityStatus = async (req: any, res: Response) => {
  const userId = req.user.id;
  const userName = req.user.name;
  const { status } = req.body;

  try {
    const updated = await pool.query(
      'UPDATE users SET availability_status = $1 WHERE id = $2 RETURNING availability_status',
      [status, userId]
    );

    // Notify all other users about status change
    const statusLabels: Record<string, string> = {
      available: 'Available 🟢',
      busy: 'Busy 🔴',
      away: 'Away 🟡',
      permission: 'on Permission 🔵'
    };

    await pool.query(`
      INSERT INTO notifications (user_id, title, message, type)
      SELECT id, $1, $2, 'info'
      FROM users
      WHERE id != $3
    `, ['Status Update', `${userName} is now ${statusLabels[status] || status}`, userId]);

    res.json({ status: updated.rows[0].availability_status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
