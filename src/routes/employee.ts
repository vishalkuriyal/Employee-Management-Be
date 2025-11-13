import express from "express"
import authMiddleWare from "../middleware/authMiddleware.ts"
import { addEmployee, upload, getEmployees, getEmployee , UpdateEmployee, DeleteEmployee , fetchEmployeesByDepId} from "../controllers/employeeControler.ts"

const router = express.Router()

router.post('/add', authMiddleWare, upload.single('image') , addEmployee)
router.get('/', authMiddleWare, getEmployees)
router.get('/:id', authMiddleWare, getEmployee)
router.put('/:id', authMiddleWare, upload.single('image'), UpdateEmployee)
router.delete('/:id', authMiddleWare, DeleteEmployee)
router.get('/department/:id', authMiddleWare, fetchEmployeesByDepId)

export default router