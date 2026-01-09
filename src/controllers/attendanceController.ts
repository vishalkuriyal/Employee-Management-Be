import type { Request, Response } from "express";
import Attendance from "../models/attendance";
import Employee from "../models/employee";
import Leave from "../models/leave";
import Shift from "../models/shift";
import { Types } from "mongoose";
import { formatTimeUTC, formatTimeIST } from "../utils/shiftHelpers";

// ========================================
// SHIFT HELPER FUNCTIONS
// ========================================
interface ShiftTime {
  hours: number;
  minutes: number;
}

const parseTime = (timeStr: string): ShiftTime => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};

const getShiftDateForTimestamp = (timestamp: Date, shift: any): Date => {
  const shiftDate = new Date(timestamp);
  shiftDate.setHours(0, 0, 0, 0);

  // If shift crosses midnight and current time is before noon (early morning)
  // This check-in belongs to previous day's shift
  if (shift.isCrossMidnight && timestamp.getHours() < 12) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }

  return shiftDate;
};

const getShiftWindow = (shiftDate: Date, shift: any) => {
  const startTime = parseTime(shift.startTime);
  const endTime = parseTime(shift.endTime);

  const shiftStart = new Date(shiftDate);
  shiftStart.setHours(startTime.hours, startTime.minutes, 0, 0);

  const shiftEnd = new Date(shiftDate);
  shiftEnd.setHours(endTime.hours, endTime.minutes, 0, 0);

  if (shift.isCrossMidnight) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }

  const graceEndTime = new Date(shiftStart);
  graceEndTime.setMinutes(graceEndTime.getMinutes() + (shift.graceMinutes || 15));

  return { shiftStart, shiftEnd, graceEndTime };
};

const calculateLateStatus = (checkInTime: Date, shift: any, shiftDate: Date) => {
  const { shiftStart, graceEndTime } = getShiftWindow(shiftDate, shift);

  if (checkInTime <= graceEndTime) {
    return { isLate: false, lateByMinutes: 0 };
  }

  const lateByMs = checkInTime.getTime() - shiftStart.getTime();
  const lateByMinutes = Math.floor(lateByMs / (1000 * 60));

  return { isLate: true, lateByMinutes };
};

// ========================================
// EMPLOYEE CHECK-IN (Updated with Shift Support)
// ========================================
const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    // Get employee with shift info
    const employee = await Employee.findOne({ userId }).populate('shiftId');
    if (!employee) {
      console.log('Employee not found for userId:', userId);
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return
    }

    // Check if shift is assigned
    if (!employee.shiftId) {
      res.status(400).json({
        success: false,
        error: "No shift assigned. Please contact HR."
      });
      return
    }

    const shift = employee.shiftId as any;
    const now = new Date();

    // Determine which shift date this check-in belongs to
    const shiftDate = getShiftDateForTimestamp(now, shift);

    console.log('Check-in attempt:', {
      employee: employee.employeeId,
      shift: shift.name,
      actualTime: now.toISOString(),
      shiftDate: shiftDate.toISOString().split('T')[0]
    });

    // Check if employee is on leave for this shift date
    const endOfShiftDate = new Date(shiftDate);
    endOfShiftDate.setHours(23, 59, 59, 999);

    const leaveRecord = await Leave.findOne({
      employeeId: employee._id,
      status: 'approved',
      fromDate: { $lte: endOfShiftDate },
      endDate: { $gte: shiftDate }
    });

    if (leaveRecord) {
      res.status(400).json({
        success: false,
        error: "You are on approved leave for this date",
        leaveDetails: {
          type: leaveRecord.leaveType,
          from: leaveRecord.fromDate,
          to: leaveRecord.endDate
        }
      });
      return
    }

    // Check if already checked in for this shift date
    const existingAttendance = await Attendance.findOne({
      employeeId: employee._id,
      date: shiftDate
    });

    if (existingAttendance && existingAttendance.checkIn) {
      res.status(400).json({
        success: false,
        error: "Already checked in for this shift",
        checkInTime: existingAttendance.checkIn,
        shiftDate: shiftDate.toLocaleDateString('en-CA')
      });
      return
    }

    // Calculate late status
    const { isLate, lateByMinutes } = calculateLateStatus(now, shift, shiftDate);

    // Create or update attendance
    const attendance = await Attendance.findOneAndUpdate(
      { employeeId: employee._id, date: shiftDate },
      {
        checkIn: now,
        shiftId: shift._id,
        status: isLate ? "late" : "present",
        isLate,
        lateByMinutes,
        isManualEntry: false
      },
      { upsert: true, new: true }
    );

    const message = isLate
      ? `Checked in late by ${lateByMinutes} minutes`
      : 'Checked in successfully';

    res.status(200).json({
      success: true,
      message,
      checkInTime: now.toISOString(),
      status: isLate ? "late" : "present",
      data: {
        checkInTime: now,
        attendanceId: attendance._id,
        shiftDate: shiftDate.toLocaleDateString('en-CA'),
        shift: {
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime
        },
        isLate,
        lateByMinutes
      }
    });
    return

  } catch (error) {
    console.error('Error in checkIn:', error);
    res.status(500).json({
      success: false,
      error: "Check-in failed",
      details: error instanceof Error ? error.message : String(error)
    });
    return
  }
};

// ========================================
// EMPLOYEE CHECK-OUT (Updated with Shift Support)
// ========================================
const checkOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    const employee = await Employee.findOne({ userId }).populate('shiftId');
    if (!employee) {
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return
    }

    if (!employee.shiftId) {
      res.status(400).json({
        success: false,
        error: "No shift assigned"
      });
      return
    }

    const shift = employee.shiftId as any;
    const now = new Date();

    // Determine which shift date to check out from
    const shiftDate = getShiftDateForTimestamp(now, shift);

    console.log('Check-out attempt:', {
      employee: employee.employeeId,
      actualTime: now.toISOString(),
      shiftDate: shiftDate.toISOString().split('T')[0]
    });

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: shiftDate
    });

    if (!attendance || !attendance.checkIn) {
      res.status(400).json({
        success: false,
        error: "No check-in found for this shift. Please check in first.",
        shiftDate: shiftDate.toLocaleDateString('en-CA')
      });
      return
    }

    if (attendance.checkOut) {
      res.status(400).json({
        success: false,
        error: "Already checked out today",
        checkOutTime: attendance.checkOut
      });
      return
    }

    const checkOutTime = now;
    const workingMilliseconds = checkOutTime.getTime() - attendance.checkIn.getTime();
    const workingHours = workingMilliseconds / (1000 * 60 * 60);

    // Determine final status based on working hours and shift minimum
    const minimumHours = shift.minimumHours || 8;
    const halfDayThreshold = minimumHours / 2; // 4 hours if minimum is 8
    let status: "present" | "half-day" | "late" = "present";

    if (workingHours < halfDayThreshold) {
      status = "half-day";
    } else if (workingHours >= minimumHours) {
      status = attendance.isLate ? "late" : "present";
    } else {
      // Worked between half and full hours (4-8 hours)
      // This is also considered half-day
      status = "half-day";
    }

    attendance.checkOut = checkOutTime;
    attendance.workingHours = parseFloat(workingHours.toFixed(2));
    attendance.status = status;
    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Checked out successfully",
      checkOutTime: checkOutTime.toISOString(),
      workingHours: attendance.workingHours,
      status: status,
      data: {
        checkInTime: attendance.checkIn,
        checkOutTime: checkOutTime,
        workingHours: attendance.workingHours,
        status: status,
        shift: {
          name: shift.name,
          date: shiftDate.toLocaleDateString('en-CA')
        }
      }
    });
    return
  } catch (error) {
    console.error('Error in checkOut:', error);
    res.status(500).json({
      success: false,
      error: "Check-out failed",
      details: error instanceof Error ? error.message : String(error)
    });
    return
  }
};

// ========================================
// GET TODAY'S ATTENDANCE (Updated with Shift Support)
// ========================================
const getTodayAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const employee = await Employee.findOne({ userId }).populate('shiftId');
    if (!employee) {
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return
    }

    if (!employee.shiftId) {
      res.status(200).json({
        success: true,
        data: {
          hasCheckedIn: false,
          hasCheckedOut: false,
          checkInTime: null,
          checkOutTime: null,
          checkIn: null,
          checkOut: null,
          workingHours: 0,
          status: "absent",
          message: "No shift assigned"
        }
      });
      return
    }

    const shift = employee.shiftId as any;
    const now = new Date();
    const shiftDate = getShiftDateForTimestamp(now, shift);

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: shiftDate
    });

    if (!attendance) {
      res.status(200).json({
        success: true,
        data: {
          hasCheckedIn: false,
          hasCheckedOut: false,
          checkInTime: null,
          checkOutTime: null,
          checkIn: null,
          checkOut: null,
          workingHours: 0,
          status: "absent",
          message: "Not checked in yet",
          shiftDate: shiftDate.toLocaleDateString('en-CA'),
          shift: {
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime
          }
        }
      });
      return
    }

    // Calculate working hours if checked in but not out
    let workingHours = attendance.workingHours || 0;
    if (attendance.checkIn && !attendance.checkOut) {
      const nowTime = new Date();
      workingHours = Number(
        ((nowTime.getTime() - new Date(attendance.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(2)
      );
    }

    res.status(200).json({
      success: true,
      data: {
        hasCheckedIn: !!attendance.checkIn,
        hasCheckedOut: !!attendance.checkOut,
        checkInTime: attendance.checkIn ? attendance.checkIn.toISOString() : null,
        checkOutTime: attendance.checkOut ? attendance.checkOut.toISOString() : null,
        checkIn: attendance.checkIn ? attendance.checkIn.toISOString() : null,
        checkOut: attendance.checkOut ? attendance.checkOut.toISOString() : null,
        workingHours,
        status: attendance.status,
        isLate: attendance.isLate || false,
        lateByMinutes: attendance.lateByMinutes || 0,
        shiftDate: shiftDate.toLocaleDateString('en-CA'),
        shift: {
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isCrossMidnight: shift.isCrossMidnight
        }
      }
    });
    return

  } catch (error) {
    console.error('Error in getTodayAttendance:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching attendance"
    });
    return
  }
};

// ========================================
// GET EMPLOYEE ATTENDANCE HISTORY (Updated with Shift Support)
// ========================================
const getEmployeeAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { month, year, page = 1, limit = 31 } = req.query;

    const employee = await Employee.findOne({ userId });
    if (!employee) {
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return
    }

    const currentDate = new Date();
    const targetMonth = month ? parseInt(month as string) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year as string) : currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);
    endDate.setHours(23, 59, 59, 999);

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const attendance = await Attendance.find({
      employeeId: employee._id,
      date: { $gte: startDate, $lte: endDate }
    })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNumber)
      .populate('leaveId', 'leaveType reason')
      .populate('shiftId', 'name startTime endTime isCrossMidnight')
      .lean();

    const totalCount = await Attendance.countDocuments({
      employeeId: employee._id,
      date: { $gte: startDate, $lte: endDate }
    });

    // Calculate statistics
    const stats = {
      present: 0,
      absent: 0,
      halfDay: 0,
      leave: 0,
      late: 0,
      totalWorkingHours: 0
    };

    attendance.forEach((record: any) => {
      if (record.status === 'present') stats.present++;
      else if (record.status === 'absent') stats.absent++;
      else if (record.status === 'half-day') stats.halfDay++;
      else if (record.status === 'leave') stats.leave++;
      else if (record.status === 'late') stats.late++;

      stats.totalWorkingHours += record.workingHours || 0;
    });

    stats.totalWorkingHours = Number(stats.totalWorkingHours.toFixed(2));

    // Format attendance records with shift info
    const formattedAttendance = attendance.map((record: any) => ({
      date: record.date.toISOString(),
      status: record.status,
      workingHours: record.workingHours || 0,
      checkIn: record.checkIn ? record.checkIn.toISOString() : null,
      checkOut: record.checkOut ? record.checkOut.toISOString() : null,
      isLate: record.isLate || false,
      lateByMinutes: record.lateByMinutes || 0,
      shift: record.shiftId ? {
        name: record.shiftId.name,
        startTime: record.shiftId.startTime,
        endTime: record.shiftId.endTime
      } : null,
      remarks: record.remarks
    }));

    res.status(200).json({
      success: true,
      attendance: formattedAttendance,
      statistics: stats,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
        totalCount
      },
      month: targetMonth + 1,
      year: targetYear
    });
    return

  } catch (error) {
    console.error('Error in getEmployeeAttendance:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching attendance history"
    });
    return
  }
};

// ========================================
// ADMIN: MARK ATTENDANCE (Updated with Shift Support)
// ========================================
const markAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, date, status, remarks, adminUserId, checkIn, checkOut, workingHours } = req.body;

    // Validation
    const validStatuses = ['present', 'absent', 'half-day', 'leave', 'late'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: "Invalid status. Must be: present, absent, half-day, leave, or late"
      });
      return;
    }

    if (!employeeId || !date || !status) {
      res.status(400).json({
        success: false,
        error: "Employee ID, date, and status are required"
      });
      return
    }

    const employee = await Employee.findById(employeeId).populate('shiftId');
    if (!employee) {
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return
    }

    if (!employee.shiftId) {
      res.status(400).json({
        success: false,
        error: "Employee has no shift assigned"
      });
      return
    }

    const shift = employee.shiftId as any;
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      employeeId: employee._id,
      date: attendanceDate
    });

    let attendance;
    if (existingAttendance) {
      existingAttendance.status = status;
      existingAttendance.remarks = remarks;
      existingAttendance.isManualEntry = true;
      existingAttendance.markedBy = adminUserId;

      // Allow manual check-in/out times for half-day
      if (checkIn) existingAttendance.checkIn = new Date(checkIn);
      if (checkOut) existingAttendance.checkOut = new Date(checkOut);
      if (workingHours !== undefined) existingAttendance.workingHours = workingHours;

      attendance = await existingAttendance.save();
    } else {
      attendance = new Attendance({
        employeeId: employee._id,
        date: attendanceDate,
        shiftId: shift._id,
        status,
        remarks,
        checkIn: checkIn ? new Date(checkIn) : undefined,
        checkOut: checkOut ? new Date(checkOut) : undefined,
        workingHours: workingHours || 0,
        isManualEntry: true,
        markedBy: adminUserId,
        isLate: status === 'late',
        lateByMinutes: 0
      });
      await attendance.save();
    }

    res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      data: attendance
    });
    return
  } catch (error) {
    console.error('Error in markAttendance:', error);
    res.status(500).json({
      success: false,
      error: "Error marking attendance"
    });
    return
  }
};

// ========================================
// ADMIN: GET ALL EMPLOYEES ATTENDANCE (Updated with Shift Support)
// ========================================
const getAllEmployeesAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, department, status, shift: shiftFilter, page = 1, limit = 50 } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    // Build employee filter
    const employeeFilter: any = {};
    if (department && department !== 'all') {
      employeeFilter.department = department;
    }
    if (shiftFilter && shiftFilter !== 'all') {
      employeeFilter.shiftId = shiftFilter;
    }

    // Get all employees matching filter
    const employees = await Employee.find(employeeFilter)
      .populate('userId', 'name email')
      .populate('department', 'name')
      .populate('shiftId', 'name startTime endTime isCrossMidnight');

    // Get attendance records for the date
    const attendanceRecords = await Attendance.find({
      date: targetDate
    })
      .populate('leaveId', 'leaveType')
      .populate('shiftId', 'name startTime endTime');

    // Create a map for quick lookup
    const attendanceMap = new Map();
    attendanceRecords.forEach(record => {
      attendanceMap.set(record.employeeId.toString(), record);
    });

    // Combine employee and attendance data
    let employeeAttendance = employees.map(employee => {
      const attendance = attendanceMap.get(employee._id.toString());
      const empShift = employee.shiftId as any;

      return {
        employeeId: employee._id.toString(),
        employeeCode: employee.employeeId,
        name: (employee.userId as any)?.name || 'N/A',
        department: (employee.department as any)?.name || 'N/A',
        shift: empShift ? {
          name: empShift.name,
          time: `${empShift.startTime} - ${empShift.endTime}`
        } : { name: 'Not Assigned', time: '-' },
        attendance: attendance ? {
          status: attendance.status,
          checkIn: formatTimeIST(attendance.checkIn),
          checkOut: formatTimeIST(attendance.checkOut),
          workingHours: attendance.workingHours || 0,
          isLate: attendance.isLate || false,
          lateByMinutes: attendance.lateByMinutes || 0,
          remarks: attendance.remarks || ''
        } : {
          status: 'absent',
          checkIn: null,
          checkOut: null,
          workingHours: 0,
          isLate: false,
          lateByMinutes: 0,
          remarks: 'Not marked'
        }
      };
    });

    // Filter by status if provided
    if (status && status !== 'all') {
      employeeAttendance = employeeAttendance.filter(
        emp => emp.attendance.status === status
      );
    }

    const totalCount = employeeAttendance.length;
    const paginatedData = employeeAttendance.slice(skip, skip + limitNumber);

    res.status(200).json({
      success: true,
      data: paginatedData,
      date: targetDate,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
        totalCount
      }
    });
    return
  } catch (error) {
    console.error('Error in getAllEmployeesAttendance:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching attendance data"
    });
    return
  }
};

// ========================================
// ADMIN: GET ATTENDANCE STATISTICS (Updated with Shift Support)
// ========================================
const getAttendanceStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, department, shift: shiftFilter } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate ? new Date(endDate as string) : new Date();

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    console.log('=== ATTENDANCE STATISTICS DEBUG ===');
    console.log('Date range:', { start: start.toISOString(), end: end.toISOString() });

    // Build employee filter
    const employeeFilter: any = {};
    if (department && department !== 'all') {
      employeeFilter.department = department;
    }
    if (shiftFilter && shiftFilter !== 'all') {
      employeeFilter.shiftId = shiftFilter;
    }

    // Get all employees
    const employees = await Employee.find(employeeFilter);
    const totalEmployees = employees.length;
    const employeeIds = employees.map(emp => emp._id);

    console.log('Total employees:', totalEmployees);

    // Get attendance records for the date range
    const attendanceRecords = await Attendance.find({
      employeeId: { $in: employeeIds },
      date: { $gte: start, $lte: end }
    });

    console.log('Total attendance records found:', attendanceRecords.length);

    // Initialize stats
    const stats = {
      totalPresent: 0,
      totalAbsent: 0,
      totalHalfDay: 0,
      totalLeave: 0,
      totalLate: 0,
      totalEmployees: totalEmployees,
      averageWorkingHours: 0
    };

    let totalWorkingHours = 0;
    let workingHoursCount = 0;

    // Count attendance by status
    attendanceRecords.forEach(record => {
      const status = record.status.toLowerCase().trim();

      if (status === 'present') {
        stats.totalPresent++;
      } else if (status === 'absent') {
        stats.totalAbsent++;
      } else if (status === 'half-day') {
        stats.totalHalfDay++;
      } else if (status === 'leave') {
        stats.totalLeave++;
      } else if (status === 'late') {
        stats.totalLate++;
      }

      // Calculate working hours
      if (record.workingHours && record.workingHours > 0) {
        totalWorkingHours += record.workingHours;
        workingHoursCount++;
      }
    });

    // Calculate average working hours
    stats.averageWorkingHours = workingHoursCount > 0
      ? parseFloat((totalWorkingHours / workingHoursCount).toFixed(2))
      : 0;

    // Calculate absent employees (those without any attendance record)
    const employeesWithAttendance = new Set(
      attendanceRecords.map(record => record.employeeId.toString())
    );

    const employeesWithoutAttendance = employeeIds.filter(
      empId => !employeesWithAttendance.has(empId.toString())
    ).length;

    stats.totalAbsent += employeesWithoutAttendance;

    console.log('=== FINAL STATISTICS ===');
    console.log('Stats:', stats);

    res.status(200).json({
      success: true,
      statistics: stats,
      dateRange: { start, end }
    });
    return
  } catch (error) {
    console.error('Error in getAttendanceStatistics:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching attendance statistics"
    });
    return
  }
};

const getTodayAttendanceDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, shift: shiftFilter } = req.query;

    // Set today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    console.log('=== TODAY ATTENDANCE DETAILS DEBUG ===');
    console.log('Today:', today.toISOString());

    // Build employee filter
    const employeeFilter: any = {};
    if (department && department !== 'all') {
      employeeFilter.department = department;
    }
    if (shiftFilter && shiftFilter !== 'all') {
      employeeFilter.shiftId = shiftFilter;
    }

    // Get all employees matching the filter
    const employees = await Employee.find(employeeFilter).select('_id name employeeId department shiftId').lean();
    const employeeIds = employees.map((emp: any) => emp._id);

    console.log('Total employees:', employees.length);

    // Get today's attendance records
    const attendanceRecords = await Attendance.find({
      employeeId: { $in: employeeIds },
      date: { $gte: today, $lte: endOfDay }
    }).populate('employeeId', 'name employeeId department').lean();

    console.log('Attendance records found:', attendanceRecords.length);

    // Create a map of employee IDs with attendance
    const attendanceMap = new Map();
    attendanceRecords.forEach((record: any) => {
      attendanceMap.set(record.employeeId._id.toString(), record);
    });

    // Categorize employees
    const presentEmployees: any[] = [];
    const absentEmployees: any[] = [];
    const halfDayEmployees: any[] = [];
    const leaveEmployees: any[] = [];
    const lateEmployees: any[] = [];

    employees.forEach((employee: any) => {
      const empId = employee._id.toString();
      const attendanceRecord = attendanceMap.get(empId);

      if (attendanceRecord) {
        const status = attendanceRecord.status.toLowerCase().trim();
        const employeeData = {
          _id: employee._id,
          name: employee.name,
          employeeId: employee.employeeId,
          department: employee.department,
          checkIn: attendanceRecord.checkIn,
          checkOut: attendanceRecord.checkOut,
          workingHours: attendanceRecord.workingHours,
          status: attendanceRecord.status,
          remarks: attendanceRecord.remarks
        };

        if (status === 'present') {
          presentEmployees.push(employeeData);
        } else if (status === 'absent') {
          absentEmployees.push(employeeData);
        } else if (status === 'half-day') {
          halfDayEmployees.push(employeeData);
        } else if (status === 'leave') {
          leaveEmployees.push(employeeData);
        } else if (status === 'late') {
          lateEmployees.push(employeeData);
        }
      } else {
        // Employee has no attendance record - mark as absent
        absentEmployees.push({
          _id: employee._id,
          name: employee.name,
          employeeId: employee.employeeId,
          department: employee.department,
          status: 'Absent',
          remarks: 'No attendance record'
        });
      }
    });

    // Prepare response
    const response = {
      success: true,
      date: today,
      summary: {
        total: employees.length,
        present: presentEmployees.length,
        absent: absentEmployees.length,
        halfDay: halfDayEmployees.length,
        leave: leaveEmployees.length,
        late: lateEmployees.length
      },
      details: {
        present: presentEmployees,
        absent: absentEmployees,
        halfDay: halfDayEmployees,
        leave: leaveEmployees,
        late: lateEmployees
      }
    };

    console.log('=== SUMMARY ===');
    console.log('Present:', presentEmployees.length);
    console.log('Absent:', absentEmployees.length);
    console.log('Half Day:', halfDayEmployees.length);
    console.log('Leave:', leaveEmployees.length);
    console.log('Late:', lateEmployees.length);

    res.status(200).json(response);
    return;

  } catch (error) {
    console.error('Error in getTodayAttendanceDetails:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching today's attendance details"
    });
    return;
  }
};

export {
  checkIn,
  checkOut,
  getTodayAttendance,
  getEmployeeAttendance,
  markAttendance,
  getAllEmployeesAttendance,
  getAttendanceStatistics,
  getTodayAttendanceDetails
};