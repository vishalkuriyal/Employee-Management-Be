import express from "express"
import authMiddleWare from "../middleware/authMiddleware.ts"
import { addDepartment, getDepartments, getDepartment, UpdateDepartment, deleteDepartment } from "../controllers/departmentController.ts"

const router = express.Router()

router.post('/add', authMiddleWare, addDepartment)
router.get('/', authMiddleWare, getDepartments)
router.get('/:id', authMiddleWare, getDepartment)
router.put('/:id', authMiddleWare, UpdateDepartment)
router.delete('/:id', authMiddleWare, deleteDepartment)

export default router