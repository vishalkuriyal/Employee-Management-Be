// models/shift.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IShift extends Document {
  name: string;
  displayName: string; // ⭐ ADD THIS
  startTime: string;
  endTime: string;
  isCrossMidnight: boolean;
  graceMinutes: number;
  minimumHours: number;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const shiftSchema = new Schema<IShift>(
  {
    name: {
      type: String,
      required: true,
      enum: ['Morning', 'Night', 'General']
      // Remove unique: true
    },
    displayName: { // ⭐ ADD THIS FIELD
      type: String,
      required: true,
      unique: true
    },
    startTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    isCrossMidnight: {
      type: Boolean,
      default: false
    },
    graceMinutes: {
      type: Number,
      default: 15,
      min: 0,
      max: 60
    },
    minimumHours: {
      type: Number,
      default: 8,
      min: 0
    },
    description: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const Shift = mongoose.model<IShift>("Shift", shiftSchema);
export default Shift;