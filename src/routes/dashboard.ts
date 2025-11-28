import express from "express"
import authMiddleWare from "../middleware/authMiddleware"
import { getEmployeeDashboard, getLeaveReport, getWorkingEmployeesToday } from "../controllers/employeeDashboard";

const router = express.Router()

router.get('/employee-detail', authMiddleWare, getEmployeeDashboard);
router.get('/working-today', authMiddleWare, getWorkingEmployeesToday);
router.get('/leave-report', authMiddleWare, getLeaveReport);

export default router