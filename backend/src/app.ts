import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as authController from './controllers/authController';
import * as attendanceController from './controllers/attendanceController';
import * as projectController from './controllers/projectController';
import * as taskController from './controllers/taskController';
import * as dashboardController from './controllers/dashboardController';
import * as userController from './controllers/userController';
import { authenticate, authorize } from './middleware/auth';
import sprintRoutes from './routes/sprintRoutes';
import taskRoutes from './routes/taskRoutes';
import leaveRoutes from './routes/leaveRoutes';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'Vizhi Teams API is running' });
});

// Auth Routes
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', authenticate, authController.getMe);

// Attendance Routes
app.post('/api/attendance/checkin', authenticate, attendanceController.checkIn);
app.post('/api/attendance/checkout', authenticate, attendanceController.checkOut);
app.get('/api/attendance/today', authenticate, attendanceController.getTodayAttendance);
app.get('/api/attendance/history', authenticate, attendanceController.getAttendanceHistory);

// Project Routes
app.get('/api/projects', authenticate, projectController.getProjects);
app.use('/api/sprint', sprintRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/leaves', leaveRoutes);
app.post('/api/projects', authenticate, authorize(['admin', 'manager']), projectController.createProject);

// Dashboard Routes
app.get('/api/dashboard', authenticate, dashboardController.getDashboardStats);

import * as notificationController from './controllers/notificationController';

// Availability Status
app.patch('/api/users/status', authenticate, userController.updateAvailabilityStatus);

// Notification Routes
app.get('/api/notifications', authenticate, notificationController.getNotifications);
app.post('/api/notifications/mark-all-read', authenticate, notificationController.markAllAsRead);
app.patch('/api/notifications/:id/read', authenticate, notificationController.markAsRead);

// Employee Management
app.get('/api/employees', authenticate, userController.getEmployees);
app.post('/api/employees/invite', authenticate, authorize(['admin', 'manager']), userController.inviteEmployee);

export default app;
