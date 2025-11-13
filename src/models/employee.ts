// models/employee.ts
import mongoose from "mongoose";
import { Schema } from "mongoose";

const employeeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  employeeId: { type: String, required: true, unique: true },
  dob: { type: Date },
  doj: { type: Date },
  gender: { type: String },
  department: { type: Schema.Types.ObjectId, ref: "Department", required: true },
  phoneNumber: { type: String },
  salary: { type: Number, required: true },
  bankBranch: { type: String },
  bankIfsc: { type: String },
  accountNumber: { type: String },
  
  // ⭐ NEW: Shift assignment
  shiftId: { 
    type: Schema.Types.ObjectId, 
    ref: "Shift", 
    required: true 
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;