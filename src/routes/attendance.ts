import express from "express"
import authMiddleWare from "../middleware/authMiddleware.ts"
import {
  checkIn,
  checkOut,
  getTodayAttendance,
  getEmployeeAttendance,
  markAttendance,
  getAllEmployeesAttendance,
  getAttendanceStatistics,
  getTodayAttendanceDetails
} from "../controllers/attendanceController.ts"

const router = express.Router()
// Employee routes
router.post("/check-in", authMiddleWare, checkIn);
router.post("/check-out", authMiddleWare, checkOut);
router.get("/today/:userId", authMiddleWare, getTodayAttendance);
router.get("/employee/:userId", authMiddleWare, getEmployeeAttendance);

// Admin routes
router.post("/mark", authMiddleWare, markAttendance); // Manual attendance marking
router.get("/all", authMiddleWare, getAllEmployeesAttendance); // Get all employees attendance
router.get("/statistics", authMiddleWare, getAttendanceStatistics); // Get attendance statistics
router.get("/today-attendance", authMiddleWare, getTodayAttendanceDetails); // Get today's attendance details

export default router