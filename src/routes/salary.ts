import express from "express"
import authMiddleWare from "../middleware/authMiddleware.ts"
import { addSalary } from "../controllers/salaryController.ts"

const router = express.Router()

router.post('/add', authMiddleWare, addSalary)

export default router