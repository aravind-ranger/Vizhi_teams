import pool from './index';
import { hashPassword } from '../utils/auth';

const seed = async () => {
  console.log('Seeding database with real employees and projects...');
  
  try {
    // Clear existing data in correct order
    await pool.query('DELETE FROM task_sessions');
    await pool.query('DELETE FROM tasks');
    await pool.query('DELETE FROM projects');
    await pool.query('DELETE FROM attendance');
    await pool.query('DELETE FROM leaves');
    await pool.query('DELETE FROM blocked_logins');
    await pool.query('DELETE FROM users');

    // Admin Users
    const admins = [
      { name: 'Aadhi', email: 'aadhi@gmail.com', role: 'admin', department: 'Management', title: 'Founder' },
      { name: 'Sathish', email: 'sathish@gmail.com', role: 'admin', department: 'Management', title: 'Co-Founder' },
      { name: 'Abdul', email: 'abdul@gmail.com', role: 'admin', department: 'Management', title: 'CEO' },
      { name: 'Aravind', email: 'aravind@gmail.com', role: 'admin', department: 'Technology', title: 'CTO' },
    ];

    // Employee Users
    const employees = [
      { name: 'Guru Gokul', email: 'gurugokul@gmail.com', role: 'employee', department: 'Engineering', title: 'Intern' },
      { name: 'Shreeram', email: 'shreeram@gmail.com', role: 'employee', department: 'Engineering', title: 'Intern' },
    ];

    const userMap: Record<string, string> = {};

    for (const user of [...admins, ...employees]) {
      const firstName = user.name.split(' ')[0].toLowerCase();
      const password = await hashPassword(`${firstName}@123`);
      
      const res = await pool.query(`
        INSERT INTO users (name, email, password, role, department, is_active, is_verified, avatar_url)
        VALUES ($1, $2, $3, $4, $5, true, true, $6)
        RETURNING id
      `, [
        user.name, 
        user.email.toLowerCase(), 
        password, 
        user.role, 
        user.department, 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`
      ]);
      userMap[user.name] = res.rows[0].id;
    }

    // Insert Projects
    const projects = [
      { name: 'Vizhi Teams Portal', description: 'Internal team management system', creator: 'Aadhi' },
      { name: 'Mobile App Revamp', description: 'New React Native mobile application', creator: 'Aravind' },
      { name: 'AI Integration', description: 'Adding AI features to our platform', creator: 'Abdul' },
    ];

    for (const p of projects) {
      await pool.query(`
        INSERT INTO projects (name, description, created_by, status)
        VALUES ($1, $2, $3, 'active')
      `, [p.name, p.description, userMap[p.creator]]);
    }

    console.log('Seed completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
