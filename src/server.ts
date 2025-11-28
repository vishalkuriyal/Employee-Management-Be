import dotenv from "dotenv"
// Load environment variables before other imports
dotenv.config();

import express from "express";
import cors from "cors"
import path from "path";
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
const port = process.env.PORT || "8001"
const BASE_URL = process.env.BASE_URL // e.g. https://management.techqilla.com
// default FRONTEND_ORIGIN to BASE_URL or localhost with port so logs and CORS have a sensible fallback
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || BASE_URL || `http://localhost:${port}`

const allowedOrigins = [FRONTEND_ORIGIN, BASE_URL].filter(Boolean)

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // allow non-browser tools like curl/postman (no origin)
    if (!origin) return callback(null, true)

    // allow exact configured origins
    if (allowedOrigins.includes(origin)) return callback(null, true)

    // allow any localhost origins during development (http or https)
    if (origin.startsWith('http://localhost') || origin.startsWith('https://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('https://127.0.0.1')) {
      return callback(null, true)
    }

    // otherwise reject
    return callback(new Error('CORS policy: origin not allowed'))
  }
}

async function startServer() {
  try {
    await connectToDatabase();
    // Middleware
    app.use(cors(corsOptions))
    app.use(express.json())
    app.use('/uploads', express.static(path.resolve('public', 'uploads')))
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

    app.listen(Number(port), () => {
      const serverUrl = BASE_URL || `http://localhost:${port}`
      console.log(`Server running at ${serverUrl} (port ${port})`)
      console.log(`CORS allowed origins: ${allowedOrigins.length ? allowedOrigins.join(', ') : 'localhost and 127.0.0.1'}`)
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();