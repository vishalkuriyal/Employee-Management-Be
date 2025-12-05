import express from "express"
import authMiddleWare from "../middleware/authMiddleware"
import { addEmployee, upload, getEmployees, getEmployee, UpdateEmployee, DeleteEmployee, fetchEmployeesByDepId } from "../controllers/employeeControler"

const router = express.Router()

router.post('/add', authMiddleWare, upload.single('image'), addEmployee)
router.get('/', authMiddleWare, getEmployees)
// Specific routes MUST come before generic :id routes
router.get('/department/:id', authMiddleWare, fetchEmployeesByDepId)
router.get('/:id', authMiddleWare, getEmployee)
router.put('/:id', authMiddleWare, upload.single('image'), UpdateEmployee)
router.delete('/:id', authMiddleWare, DeleteEmployee)

export default router