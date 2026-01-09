import cron from 'node-cron';
import Attendance from '../models/attendance';
import Employee from '../models/employee';

const AUTO_CHECKOUT_HOURS = 11;
const HOURS_TO_MS = 60 * 60 * 1000;

/**
 * Auto-checkout employees who have been checked in for more than 11 hours
 * and haven't checked out yet (assumed to have forgotten)
 */
export const autoCheckoutEmployees = async (): Promise<void> => {
  try {
    const now = new Date();
    const elevenHoursAgo = new Date(now.getTime() - AUTO_CHECKOUT_HOURS * HOURS_TO_MS);

    console.log(`[Auto Checkout] Running at ${now.toISOString()}`);

    // Find all attendance records where:
    // 1. Employee checked in
    // 2. Employee has NOT checked out
    // 3. Check-in time is more than 11 hours ago
    const recordsToCheckout = await Attendance.find({
      checkIn: { $lte: elevenHoursAgo },
      checkOut: null
    })
      .populate('employeeId')
      .populate('shiftId');

    if (recordsToCheckout.length === 0) {
      console.log(`[Auto Checkout] No employees to auto-checkout`);
      return;
    }

    console.log(`[Auto Checkout] Found ${recordsToCheckout.length} employee(s) to auto-checkout`);

    for (const attendance of recordsToCheckout) {
      try {
        const checkInTime = new Date(attendance.checkIn!);
        const autoCheckoutTime = new Date(now);
        const workingMilliseconds = autoCheckoutTime.getTime() - checkInTime.getTime();
        const workingHours = workingMilliseconds / (1000 * 60 * 60);

        const shift = attendance.shiftId as any;
        const minimumHours = shift?.minimumHours || 8;
        const halfDayThreshold = minimumHours / 2;

        // Determine final status
        let status: 'present' | 'half-day' | 'late' = 'present';
        if (workingHours < halfDayThreshold) {
          status = 'half-day';
        } else if (workingHours >= minimumHours) {
          status = attendance.isLate ? 'late' : 'present';
        } else {
          status = 'half-day';
        }

        // Update attendance with auto-checkout
        attendance.checkOut = autoCheckoutTime;
        attendance.workingHours = parseFloat(workingHours.toFixed(2));
        attendance.status = status;
        await attendance.save();

        const employee = attendance.employeeId as any;
        console.log(
          `[Auto Checkout] Employee ${employee?.employeeId} auto-checked out after ${workingHours.toFixed(2)} hours`
        );
      } catch (error) {
        console.error(
          `[Auto Checkout] Error auto-checking out employee ${(attendance.employeeId as any)?._id}:`,
          error
        );
      }
    }

    console.log(`[Auto Checkout] Completed auto-checkout process`);
  } catch (error) {
    console.error('[Auto Checkout] Error in autoCheckoutEmployees:', error);
  }
};

/**
 * Initialize the auto-checkout cron job
 * Runs every 10 minutes
 */
export const initializeAutoCheckoutScheduler = (): void => {
  console.log('[Auto Checkout Scheduler] Initializing...');

  // Run every 10 minutes (*/10 * * * *)
  cron.schedule('*/10 * * * *', async () => {
    await autoCheckoutEmployees();
  });

  console.log('[Auto Checkout Scheduler] Started - will run every 10 minutes');
};
