import { Request, Response } from 'express';
import pool from '../db';
import { comparePassword, generateToken } from '../utils/auth';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check if blocked for today
    const blockResult = await pool.query(
      'SELECT admin_unblocked FROM blocked_logins WHERE user_id = $1 AND date = CURRENT_DATE',
      [user.id]
    );

    if (blockResult.rows.length > 0 && !blockResult.rows[0].admin_unblocked) {
      return res.status(403).json({ 
        message: 'Your login is blocked due to an early exit today.', 
        code: 'LOGIN_BLOCKED' 
      });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    
    // Remove password from response
    delete user.password;

    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMe = async (req: any, res: Response) => {
  res.json({ user: req.user });
};
