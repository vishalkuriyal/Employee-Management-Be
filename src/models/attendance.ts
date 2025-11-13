// models/attendance.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IAttendance extends Document {
  employeeId: mongoose.Types.ObjectId;
  date: Date; // Shift date (not clock date)
  shiftId: mongoose.Types.ObjectId;
  checkIn?: Date;
  checkOut?: Date;
  status: "present" | "absent" | "half-day" | "leave" | "late";
  workingHours?: number;
  isLate: boolean;
  lateByMinutes: number;
  leaveId?: mongoose.Types.ObjectId;
  remarks?: string;
  isManualEntry: boolean;
  markedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    employeeId: { 
      type: Schema.Types.ObjectId, 
      ref: "Employee", 
      required: true 
    },
    date: { 
      type: Date, 
      required: true,
      index: true
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: "Shift",
      required: true
    },
    checkIn: { 
      type: Date 
    },
    checkOut: { 
      type: Date 
    },
    status: { 
      type: String, 
      enum: ["present", "absent", "half-day", "leave", "late"], 
      required: true,
      default: "absent"
    },
    workingHours: { 
      type: Number,
      default: 0 
    },
    isLate: {
      type: Boolean,
      default: false
    },
    lateByMinutes: {
      type: Number,
      default: 0
    },
    leaveId: { 
      type: Schema.Types.ObjectId, 
      ref: "Leave" 
    },
    remarks: { 
      type: String 
    },
    isManualEntry: { 
      type: Boolean, 
      default: false 
    },
    markedBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User" 
    }
  },
  { 
    timestamps: true 
  }
);

// Compound index to ensure one attendance record per employee per shift date
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model<IAttendance>("Attendance", attendanceSchema);
export default Attendance;