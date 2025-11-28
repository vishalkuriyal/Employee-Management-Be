
import express from "express"
import authMiddleWare from "../middleware/authMiddleware"
import { addLeave, getAllLeaves, getLeaveBalance, getLeaveBreakdown, updateLeaveStatus } from "../controllers/leaveController"

const router = express.Router()

router.post('/add', authMiddleWare, addLeave)
router.get('/balance/:userId', authMiddleWare, getLeaveBalance)
router.get('/breakdown/:userId', authMiddleWare, getLeaveBreakdown)

// Admin routes
router.get('/all', authMiddleWare, getAllLeaves)
router.put('/status/:leaveId', authMiddleWare, updateLeaveStatus)

export default router