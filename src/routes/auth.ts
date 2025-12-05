import express from "express"
import { login, verify } from "../controllers/authController"
import authMiddleWare from "../middleware/authMiddleware"

const router = express.Router()

router.post('/login', login)
router.get('/verify', authMiddleWare, verify)

export default router;