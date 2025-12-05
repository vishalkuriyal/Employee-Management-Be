// utils/shiftHelpers.ts
import type { IShift } from "../models/shift";

interface ShiftTime {
  hours: number;
  minutes: number;
}

/**
 * Parse time string "HH:MM" to hours and minutes
 */
export const parseTime = (timeStr: string): ShiftTime => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};

/**
 * Get the shift date for a given timestamp
 * For cross-midnight shifts, timestamps after midnight belong to previous day's shift
 */
export const getShiftDateForTimestamp = (timestamp: Date, shift: IShift): Date => {
  const shiftDate = new Date(timestamp);
  shiftDate.setHours(0, 0, 0, 0);
  
  // If shift crosses midnight and current time is before noon (early morning)
  // This check-in belongs to previous day's shift
  if (shift.isCrossMidnight && timestamp.getHours() < 12) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }
  
  return shiftDate;
};

/**
 * Get shift start and end times for a given shift date
 */
export const getShiftWindow = (shiftDate: Date, shift: IShift) => {
  const startTime = parseTime(shift.startTime);
  const endTime = parseTime(shift.endTime);
  
  // Shift start time
  const shiftStart = new Date(shiftDate);
  shiftStart.setHours(startTime.hours, startTime.minutes, 0, 0);
  
  // Shift end time
  const shiftEnd = new Date(shiftDate);
  shiftEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
  
  // If shift crosses midnight, end time is next day
  if (shift.isCrossMidnight) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }
  
  // Grace period for late check-in
  const graceEndTime = new Date(shiftStart);
  graceEndTime.setMinutes(graceEndTime.getMinutes() + shift.graceMinutes);
  
  // Allow check-in from 1 hour before shift starts
  const checkInWindowStart = new Date(shiftStart);
  checkInWindowStart.setHours(checkInWindowStart.getHours() - 1);
  
  return {
    shiftStart,
    shiftEnd,
    graceEndTime,
    checkInWindowStart,
    expectedDurationHours: (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60)
  };
};

/**
 * Calculate if employee is late and by how many minutes
 */
export const calculateLateStatus = (
  checkInTime: Date, 
  shift: IShift, 
  shiftDate: Date
): { isLate: boolean; lateByMinutes: number } => {
  const { shiftStart, graceEndTime } = getShiftWindow(shiftDate, shift);
  
  // Not late if checked in before grace period ends
  if (checkInTime <= graceEndTime) {
    return { isLate: false, lateByMinutes: 0 };
  }
  
  // Calculate how late
  const lateByMs = checkInTime.getTime() - shiftStart.getTime();
  const lateByMinutes = Math.floor(lateByMs / (1000 * 60));
  
  return { isLate: true, lateByMinutes };
};

/**
 * Validate if check-in time is within acceptable window
 */
export const isValidCheckInTime = (
  checkInTime: Date,
  shift: IShift,
  shiftDate: Date
): { valid: boolean; reason?: string } => {
  const { checkInWindowStart, shiftEnd } = getShiftWindow(shiftDate, shift);
  
  // Too early (more than 1 hour before shift)
  if (checkInTime < checkInWindowStart) {
    return { 
      valid: false, 
      reason: `Check-in too early. Shift starts at ${shift.startTime}` 
    };
  }
  
  // Too late (after shift ends)
  if (checkInTime > shiftEnd) {
    return { 
      valid: false, 
      reason: `Check-in too late. Shift ended at ${shift.endTime}` 
    };
  }
  
  return { valid: true };
};