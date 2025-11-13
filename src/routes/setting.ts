import express from "express"
import authMiddleWare from "../middleware/authMiddleware.ts"
import { changePassword } from "../controllers/settingController.ts"

const router = express.Router()

router.put('/change-password', authMiddleWare, changePassword)

export default router