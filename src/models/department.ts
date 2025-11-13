import mongoose from "mongoose";
import Employee from "./employee.ts";
import Leave from "./leave.ts";
import Salary from "./salary.ts";

const departmentSchema = new mongoose.Schema({
  dep_name: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now }, 
  updatedAt: { type: Date, default: Date.now },
})

departmentSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
  try {
    const employees = await Employee.find({ department: this._id })
    const empIds = employees.map(emp => emp._id)

    await Employee.deleteMany({ department: this._id })
    await Leave.deleteMany({ employeeId: { $in: empIds } })
    await Salary.deleteMany({ employeeId: { $in: empIds } })

    next()
  } catch (error) {
    const mongooseError = error instanceof Error ? error : new Error('Unknown error occurred');
    next(mongooseError)
  }
})
const Department = mongoose.model("Department", departmentSchema)

export default Department;