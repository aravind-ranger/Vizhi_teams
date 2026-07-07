# 🚀 Vizhi Teams - Employee Work Portal

Vizhi Teams is a premium, full-stack employee management and productivity portal. It is designed to streamline team collaboration, track attendance, and manage projects through an intuitive, highly interactive dashboard.

## ✨ Key Features

### ⏱️ Smart Attendance & Time Tracking
* **One-Click Check-In:** Real-time check-in/out system located in the top navigation bar.
* **Work Locations:** Support for Office, Work From Home (WFH), and Onsite tracking.
* **Smart Exits:** Automatic early-exit warnings and double-confirmation dialogs to prevent accidental checkouts.
* **Live Pulse:** Dashboard widget displaying real-time shift progress and overtime modes.

### 📋 Project & Task Management
* **Interactive Kanban Board:** Full drag-and-drop task management using `@dnd-kit`.
* **Task Timers:** Employees can start and stop active work sessions directly from their dashboard.
* **Progress Tracking:** Visual progress bars for project completion and daily efficiency scores.

### 👥 HR & Team Management
* **Live Status Updates:** Employees can set their current status (Available, Busy, Away, Permission) instantly.
* **Employee Directory:** View team members, their roles, and current activity.
* **Leave Management:** Built-in system to apply for, track, and approve time off.

### 🛡️ Security & Roles
* **Role-Based Access (RBAC):** Distinct permissions for Founders, CEOs, Managers, and Interns.
* **Secure Auth:** JWT-based authentication protecting all API routes.

---

## 🛠️ Technology Stack

**Frontend:**
* React 19 + Vite
* TypeScript
* Tailwind CSS (Glassmorphism & Premium UI design)
* Zustand (Global State Management)
* React Router DOM
* @dnd-kit (Drag and Drop)
* Lucide React (Icons) 

**Backend:**
* Node.js + Express.js
* TypeScript
* PostgreSQL (Database)
* JSON Web Tokens (JWT Auth)

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher)
* PostgreSQL database

### 1. Backend Setup
Navigate to the backend directory and install dependencies:
```bash
cd backend
npm install
