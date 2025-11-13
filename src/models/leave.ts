import mongoose, { Schema, Document } from "mongoose";

export interface ILeave extends Document {
  employeeId: mongoose.Types.ObjectId;
  leaveType: "sick" | "casual";
  fromDate: Date;
  endDate: Date;
  isHalfDay: boolean;
  halfDayPeriod?: "morning" | "afternoon";
  reason: string;
  status: "pending" | "approved" | "rejected";
  appliedDate: Date;
  totalDays: number;
  adminComments?: string;   // ✅ Add
  reviewedDate?: Date;      // ✅ Add
  createdAt?: Date;
  updatedAt?: Date;
}

const leaveSchema = new Schema<ILeave>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    leaveType: { type: String, enum: ["sick", "casual"], required: true },
    fromDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isHalfDay: { type: Boolean, default: false },
    halfDayPeriod: { type: String, enum: ["morning", "afternoon"] },
    reason: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    appliedDate: { type: Date, default: Date.now },
    totalDays: { type: Number, required: true },
    
    // ✅ Add these schema fields too
    adminComments: { type: String, default: "" },
    reviewedDate: { type: Date },
  },
  { timestamps: true }
);

const Leave = mongoose.model<ILeave>("Leave", leaveSchema);
export default Leave;
