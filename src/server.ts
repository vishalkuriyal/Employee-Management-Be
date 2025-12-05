import dotenv from "dotenv"
// Load environment variables before other imports
dotenv.config();

import express from "express";
import cors from "cors"
import { connectToDatabase } from "./config/db";
import authRouter from "./routes/auth"
import departmentRouter from "./routes/department"
import employeeRouter from "./routes/employee"
import salaryRouter from "./routes/salary"
import leaveRouter from "./routes/leave"
import settingRouter from "./routes/setting"
import dashboardRouter from "./routes/dashboard"
import attendanceRouter from "./routes/attendance"
import shiftRoutes from "./routes/shifts"

const app = express()
const port = process.env.PORT

async function startServer() {
  try {
    await connectToDatabase();
    // Middleware
    // app.use(cors({
    //   origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5173',
    //   credentials: true
    // }))
    app.use(cors({
      origin: ['http://localhost:5173', 'https://management.techqilla.com', 'https://www.management.techqilla.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
    }))
    app.use(express.json())
    app.use('/uploads', express.static('public/uploads'))
    app.use('/api/auth', authRouter)
    app.use('/api/department', departmentRouter)
    app.use('/api/employees', employeeRouter)
    app.use('/api/salary', salaryRouter)
    app.use('/api/leave', leaveRouter)
    app.use('/api/setting', settingRouter)
    app.use('/api/dashboard', dashboardRouter)
    app.use('/api/attendance', attendanceRouter)
    app.use('/api/shifts', shiftRoutes);



    // // Routes
    // app.use('/api', routes);

    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();