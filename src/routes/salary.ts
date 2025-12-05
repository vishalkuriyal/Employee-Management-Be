import express from "express"
import authMiddleWare from "../middleware/authMiddleware"
import { addSalary } from "../controllers/salaryController"

const router = express.Router()

router.post('/add', authMiddleWare, addSalary)

export default router