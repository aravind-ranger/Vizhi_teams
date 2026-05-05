import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/auth';
import { sendEarlyExitAlert } from '../services/emailService';

export const checkIn = async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const date = new Date().toISOString().split('T')[0];

  try {
    // Check if already checked in
    const existing = await pool.query(
      'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    if (existing.rows.length > 0 && existing.rows[0].check_in) {
      return res.status(400).json({ message: 'Already checked in for today' });
    }

    const { work_location } = req.body;
    const checkInTime = new Date();
    const scheduledCheckout = new Date(checkInTime.getTime() + 8 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO attendance (user_id, date, check_in, scheduled_checkout, status, work_location) 
       VALUES ($1, $2, $3, $4, 'present', $5) 
       ON CONFLICT (user_id, date) DO UPDATE 
       SET check_in = $3, scheduled_checkout = $4, status = 'present', work_location = $5
       RETURNING *`,
      [userId, date, checkInTime, scheduledCheckout, work_location]
    );

    res.json({ attendance: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const checkOut = async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const date = new Date().toISOString().split('T')[0];

  try {
    const existing = await pool.query(
      'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    if (existing.rows.length === 0 || !existing.rows[0].check_in) {
      return res.status(400).json({ message: 'No check-in record found for today' });
    }

    const checkOutTime = new Date();
    const checkInTime = new Date(existing.rows[0].check_in);
    const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
    
    const isEarlyExit = durationMinutes < 8 * 60;

    const result = await pool.query(
      `UPDATE attendance 
       SET check_out = $1, duration_minutes = $2, early_exit = $3, 
           status = $4
       WHERE id = $5 RETURNING *`,
      [checkOutTime, durationMinutes, isEarlyExit, isEarlyExit ? 'early_exit' : 'present', existing.rows[0].id]
    );

    if (isEarlyExit) {
      // Block login for today
      await pool.query(
        'INSERT INTO blocked_logins (user_id, date) VALUES ($1, $2) ON CONFLICT (user_id, date) DO NOTHING',
        [userId, date]
      );
      
      // Get all admin emails
      const adminResult = await pool.query("SELECT email FROM users WHERE role = 'admin'");
      const adminEmails = adminResult.rows.map(r => r.email);

      if (adminEmails.length > 0) {
        sendEarlyExitAlert(
          adminEmails,
          req.user.name,
          checkInTime.toLocaleTimeString(),
          checkOutTime.toLocaleTimeString(),
          new Date(existing.rows[0].scheduled_checkout).toLocaleTimeString()
        ).catch(err => console.error('Failed to send early exit email', err));
      }
    }

    res.json({ attendance: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getTodayAttendance = async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const date = new Date().toISOString().split('T')[0];

  try {
    const attendance = await pool.query(
      'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    const block = await pool.query(
      'SELECT admin_unblocked FROM blocked_logins WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    res.json({ 
      attendance: attendance.rows[0] || null,
      isBlocked: block.rows.length > 0 && !block.rows[0].admin_unblocked
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAttendanceHistory = async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      'SELECT * FROM attendance WHERE user_id = $1 ORDER BY date DESC LIMIT 30',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
