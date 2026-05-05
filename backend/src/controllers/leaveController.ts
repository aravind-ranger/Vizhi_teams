import { Request, Response } from 'express';
import pool from '../db';
import { sendEmail } from '../services/emailService';

export const getLeaves = async (req: any, res: Response) => {
  try {
    const { role, id: userId } = req.user;
    let query = `
      SELECT l.*, u.name as employee_name, u.email as employee_email 
      FROM leaves l
      JOIN users u ON l.user_id = u.id
    `;

    if (role === 'employee') {
      query += ` WHERE l.user_id = $1`;
    }

    const leaves = await pool.query(query, role === 'employee' ? [userId] : []);
    res.json(leaves.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const applyLeave = async (req: any, res: Response) => {
  const { leave_type, from_date, to_date, reason } = req.body;
  const user_id = req.user.id;

  try {
    const newLeave = await pool.query(`
      INSERT INTO leaves (user_id, leave_type, from_date, to_date, reason, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `, [user_id, leave_type, from_date, to_date, reason]);

    res.status(201).json(newLeave.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateLeaveStatus = async (req: any, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const admin_id = req.user.id;

  try {
    const leaveResult = await pool.query(`
      UPDATE leaves SET status = $1, approved_by = $2 WHERE id = $3 RETURNING *
    `, [status, admin_id, id]);

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    const leave = leaveResult.rows[0];
    const userResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [leave.user_id]);
    const user = userResult.rows[0];

    // Send email notification (non-blocking, don't fail if email fails)
    try {
      const emailSubject = `Leave Request ${status.toUpperCase()}`;
      const emailContent = `
        <div style="font-family: sans-serif; color: #333;">
          <h2 style="color: ${status === 'approved' ? '#2F9E44' : '#E03131'};">Leave ${status.charAt(0).toUpperCase() + status.slice(1)}</h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Your leave request for <strong>${new Date(leave.from_date).toLocaleDateString()} - ${new Date(leave.to_date).toLocaleDateString()}</strong> has been <strong>${status}</strong>.</p>
          <p>Reason: ${leave.reason}</p>
          <br/>
          <p>Regards,<br/>Vizhi Teams Admin</p>
        </div>
      `;

      await sendEmail(user.email, emailSubject, emailContent);
    } catch (emailErr) {
      console.error('Failed to send leave status email:', emailErr);
    }

    res.json(leave);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
