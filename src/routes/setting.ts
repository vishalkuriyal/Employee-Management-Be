import express from "express"
import authMiddleWare from "../middleware/authMiddleware"
import { changePassword } from "../controllers/settingController"

const router = express.Router()

router.put('/change-password', authMiddleWare, changePassword)

export default router