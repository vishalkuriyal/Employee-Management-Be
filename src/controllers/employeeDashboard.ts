import type { Request, Response } from "express";
import Employee from "../models/employee";
import Leave from "../models/leave";
import Attendance from "../models/attendance";
import Shift from "../models/shift";

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
  // This belongs to previous day's shift
  if (shift.isCrossMidnight && timestamp.getHours() < 12) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }
  
  return shiftDate;
};

// ========================================
// GET EMPLOYEE DASHBOARD (Updated with Shift Support)
// ========================================
const getEmployeeDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== Dashboard API Called ===');
    console.log('User from middleware:', req.user ? `${req.user.email} (${req.user.role})` : 'Not found');

    res.setHeader('Content-Type', 'application/json');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    console.log('Querying for date range:', {
      start: today.toISOString(),
      end: endOfToday.toISOString()
    });

    // Get total number of employees
    const totalEmployees = await Employee.countDocuments();
    console.log('Total employees in database:', totalEmployees);

    // Get employees on approved leave today
    const employeesOnLeave = await Leave.find({
      status: 'approved',
      fromDate: { $lte: endOfToday },
      endDate: { $gte: today }
    }).populate({
      path: 'employeeId',
      populate: [
        {
          path: 'userId',
          select: 'name email image'
        },
        {
          path: 'department',
          select: 'name'
        },
        {
          path: 'shiftId',
          select: 'name startTime endTime isCrossMidnight'
        }
      ]
    }).lean();

    console.log('Raw approved leaves found:', employeesOnLeave.length);

    // Process employees on leave
    const employeesOnLeaveFormatted: any[] = [];
    const employeeIdsOnLeave: string[] = [];
    let casualLeaveCount = 0;
    let sickLeaveCount = 0;

    for (const leave of employeesOnLeave) {
      try {
        if (leave.employeeId &&
          typeof leave.employeeId === 'object' &&
          '_id' in leave.employeeId &&
          'userId' in leave.employeeId) {

          const employee = leave.employeeId as any;
          const employeeIdStr = employee._id.toString();

          // Only add unique employees
          if (!employeeIdsOnLeave.includes(employeeIdStr)) {
            employeeIdsOnLeave.push(employeeIdStr);

            const employeeData = {
              _id: employee._id,
              employeeId: employee.employeeId || `EMP${employee._id.toString().slice(-3)}`,
              name: employee.userId?.name || 'Unknown Employee',
              email: employee.userId?.email || 'no-email@company.com',
              image: employee.userId?.image || '',
              department: employee.department?.name || 'Unassigned',
              shift: employee.shiftId ? {
                name: employee.shiftId.name,
                time: `${employee.shiftId.startTime} - ${employee.shiftId.endTime}`
              } : { name: 'Not Assigned', time: '-' },
              phoneNumber: employee.phoneNumber || '',
              leaveDetails: {
                leaveType: leave.leaveType || 'casual',
                fromDate: leave.fromDate,
                endDate: leave.endDate,
                totalDays: leave.totalDays || 1,
                isHalfDay: leave.isHalfDay || false,
                halfDayPeriod: leave.halfDayPeriod,
                reason: leave.reason || 'No reason provided',
                appliedDate: leave.appliedDate || leave.createdAt || new Date()
              }
            };

            employeesOnLeaveFormatted.push(employeeData);

            // Count leave types
            if (leave.leaveType === 'casual') {
              casualLeaveCount++;
            } else if (leave.leaveType === 'sick') {
              sickLeaveCount++;
            }

            console.log(`Processed employee on leave:`, employeeData.name);
          }
        }
      } catch (processingError) {
        console.error('Error processing individual leave record:', processingError);
      }
    }

    // Get attendance records for today's shift date
    // This includes night shift workers whose shift date is today
    const todayAttendance = await Attendance.find({
      date: today,
      checkIn: { $exists: true, $ne: null }
    })
    .populate({
      path: 'employeeId',
      populate: [
        {
          path: 'userId',
          select: 'name email image'
        },
        {
          path: 'department',
          select: 'name'
        },
        {
          path: 'shiftId',
          select: 'name startTime endTime isCrossMidnight'
        }
      ]
    })
    .populate('shiftId', 'name startTime endTime isCrossMidnight')
    .lean();

    console.log('Employees with attendance today:', todayAttendance.length);

    // Format working employees with shift info
    const workingEmployeesFormatted: any[] = [];
    const employeeIdsCheckedIn: string[] = [];

    for (const att of todayAttendance) {
      const employee = att.employeeId as any;
      const attShift = att.shiftId as any;
      
      if (employee && employee._id && !employeeIdsOnLeave.includes(employee._id.toString())) {
        const employeeIdStr = employee._id.toString();
        
        if (!employeeIdsCheckedIn.includes(employeeIdStr)) {
          employeeIdsCheckedIn.push(employeeIdStr);
          
          // Calculate current working hours if not checked out
          let currentWorkingHours = att.workingHours || 0;
          if (att.checkIn && !att.checkOut) {
            const nowTime = new Date();
            currentWorkingHours = Number(
              ((nowTime.getTime() - new Date(att.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(2)
            );
          }

          workingEmployeesFormatted.push({
            _id: employee._id,
            employeeId: employee.employeeId || 'N/A',
            name: employee.userId?.name || 'Unknown',
            email: employee.userId?.email || '',
            image: employee.userId?.image || '',
            department: employee.department?.name || 'Unassigned',
            shift: attShift ? {
              name: attShift.name,
              time: `${attShift.startTime} - ${attShift.endTime}`,
              isCrossMidnight: attShift.isCrossMidnight
            } : { name: 'Not Assigned', time: '-', isCrossMidnight: false },
            attendanceDetails: {
              checkInTime: att.checkIn,
              checkOutTime: att.checkOut,
              workingHours: currentWorkingHours,
              status: att.status,
              isLate: att.isLate || false,
              lateByMinutes: att.lateByMinutes || 0
            }
          });
        }
      }
    }

    // Calculate shift-wise breakdown
    const shiftBreakdown: any = {};
    workingEmployeesFormatted.forEach(emp => {
      const shiftName = emp.shift.name;
      shiftBreakdown[shiftName] = (shiftBreakdown[shiftName] || 0) + 1;
    });

    const totalEmployeesWorkingToday = employeeIdsCheckedIn.length;

    const responseData = {
      success: true,
      data: {
        summary: {
          totalEmployees,
          employeesWorkingToday: totalEmployeesWorkingToday,
          employeesOnLeaveToday: employeeIdsOnLeave.length,
          employeesNotCheckedIn: Math.max(0, totalEmployees - totalEmployeesWorkingToday - employeeIdsOnLeave.length),
          leaveBreakdown: {
            casual: casualLeaveCount,
            sick: sickLeaveCount
          },
          shiftBreakdown // NEW: Shows count per shift
        },
        employeesOnLeave: employeesOnLeaveFormatted,
        workingEmployees: workingEmployeesFormatted, // NEW: Shows who's working with details
        date: today.toLocaleDateString('en-CA')
      }
    };

    console.log('=== Sending Dashboard Response ===');
    console.log('Summary:', responseData.data.summary);
    console.log('Employees on leave count:', responseData.data.employeesOnLeave.length);
    console.log('Working employees count:', responseData.data.workingEmployees.length);

    res.status(200).json(responseData);
    return;

  } catch (error) {
    console.error('=== Dashboard API Error ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');

    res.setHeader('Content-Type', 'application/json');

    res.status(500).json({
      success: false,
      error: "Error fetching employee dashboard data",
      details: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) :
        'Internal server error'
    });
    return;
  }
};

// ========================================
// GET WORKING EMPLOYEES TODAY (Updated with Shift Support)
// ========================================
const getWorkingEmployeesToday = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    // Get employees on leave today
    const employeesOnLeaveIds = await Leave.find({
      status: "approved",
      fromDate: { $lte: endOfToday },
      endDate: { $gte: today }
    }).distinct("employeeId");

    console.log('Employees on leave IDs:', employeesOnLeaveIds.length);

    // Get all employees who checked in today (by shift date)
    const todayAttendance = await Attendance.find({
      date: today,
      checkIn: { $exists: true, $ne: null }
    })
    .populate({
      path: 'employeeId',
      populate: [
        { path: 'userId', select: 'name email image role' },
        { path: 'department', select: 'name' },
        { path: 'shiftId', select: 'name startTime endTime isCrossMidnight' }
      ]
    })
    .populate('shiftId', 'name startTime endTime isCrossMidnight')
    .lean();

    console.log('Total attendance records for today:', todayAttendance.length);

    // Filter out employees on leave and format
    const workingEmployees: any[] = [];
    const processedIds = new Set<string>();

    for (const att of todayAttendance) {
      const employee = att.employeeId as any;
      const shift = att.shiftId as any;
      
      if (!employee || !employee._id) continue;
      
      const empIdStr = employee._id.toString();
      
      // Skip if on leave or already processed
      if (employeesOnLeaveIds.includes(empIdStr) || processedIds.has(empIdStr)) {
        continue;
      }
      
      processedIds.add(empIdStr);
      
      // Calculate current working hours
      let workingHours = att.workingHours || 0;
      if (att.checkIn && !att.checkOut) {
        const now = new Date();
        workingHours = Number(
          ((now.getTime() - new Date(att.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(2)
        );
      }

      workingEmployees.push({
        _id: employee._id,
        employeeId: employee.employeeId || 'N/A',
        name: employee.userId?.name || 'Unknown',
        email: employee.userId?.email || '',
        image: employee.userId?.image || '',
        department: employee.department?.name || 'Unassigned',
        phoneNumber: employee.phoneNumber || '',
        role: employee.userId?.role || 'employee',
        shift: shift ? {
          name: shift.name,
          time: `${shift.startTime} - ${shift.endTime}`,
          isCrossMidnight: shift.isCrossMidnight
        } : { name: 'Not Assigned', time: '-', isCrossMidnight: false },
        attendance: {
          checkInTime: att.checkIn,
          checkOutTime: att.checkOut,
          workingHours,
          status: att.status,
          isLate: att.isLate || false,
          lateByMinutes: att.lateByMinutes || 0
        }
      });
    }

    // Calculate shift-wise breakdown
    const shiftBreakdown: any = {};
    workingEmployees.forEach(emp => {
      const shiftName = emp.shift.name;
      shiftBreakdown[shiftName] = (shiftBreakdown[shiftName] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        totalWorkingToday: workingEmployees.length,
        shiftBreakdown,
        workingEmployees
      }
    });

  } catch (error: any) {
    console.error('Error in getWorkingEmployeesToday:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching working employees data",
      details: error.message
    });
  }
};

// ========================================
// GET LEAVE REPORT (Updated with Shift Support)
// ========================================
const getLeaveReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, department, shift: shiftFilter } = req.query;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    console.log('Leave report date range:', {
      start: start.toISOString(),
      end: end.toISOString()
    });

    // Build employee filter for pre-filtering
    const employeeFilter: any = {};
    if (department && department !== 'all') {
      employeeFilter.department = department;
    }
    if (shiftFilter && shiftFilter !== 'all') {
      employeeFilter.shiftId = shiftFilter;
    }

    // Get filtered employee IDs
    let targetEmployeeIds: any[] = [];
    if (Object.keys(employeeFilter).length > 0) {
      const filteredEmployees = await Employee.find(employeeFilter).select('_id');
      targetEmployeeIds = filteredEmployees.map(e => e._id);
    }

    // Build leave query
    const leaveQuery: any = {
      status: "approved",
      $or: [
        { fromDate: { $gte: start, $lte: end } },
        { endDate: { $gte: start, $lte: end } },
        { fromDate: { $lt: start }, endDate: { $gt: end } }
      ]
    };

    // Add employee filter if specified
    if (targetEmployeeIds.length > 0) {
      leaveQuery.employeeId = { $in: targetEmployeeIds };
    }

    const leaves = await Leave.find(leaveQuery)
      .populate({
        path: 'employeeId',
        populate: [
          { path: 'userId', select: 'name email image' },
          { path: 'department', select: 'name' },
          { path: 'shiftId', select: 'name startTime endTime isCrossMidnight' }
        ]
      })
      .lean();

    console.log('Total leaves found:', leaves.length);

    // Get total employees (with filters if applied)
    const totalEmployees = await Employee.countDocuments(employeeFilter);

    // Get unique employees on leave
    const uniqueEmployeesOnLeave = [
      ...new Set(leaves.map(l => (l.employeeId as any)?._id?.toString()))
    ].filter(Boolean);

    // Format leave details with shift info
    const formatted = leaves
      .filter(leave => leave.employeeId) // Ensure employeeId is populated
      .map((leave: any) => {
        const emp = leave.employeeId;
        return {
          leaveId: leave._id,
          employeeName: emp?.userId?.name || 'Unknown',
          employeeCode: emp?.employeeId || 'N/A',
          department: emp?.department?.name || 'Unassigned',
          shift: emp?.shiftId ? {
            name: emp.shiftId.name,
            time: `${emp.shiftId.startTime} - ${emp.shiftId.endTime}`
          } : { name: 'Not Assigned', time: '-' },
          leaveType: leave.leaveType,
          fromDate: leave.fromDate,
          endDate: leave.endDate,
          totalDays: leave.totalDays,
          isHalfDay: leave.isHalfDay || false,
          reason: leave.reason || 'No reason provided'
        };
      });

    // Calculate leave type breakdown
    const leaveTypeBreakdown = {
      casual: leaves.filter(l => l.leaveType === 'casual').length,
      sick: leaves.filter(l => l.leaveType === 'sick').length,
      // annual: leaves.filter(l => l.leaveType === 'annual').length,
      // unpaid: leaves.filter(l => l.leaveType === 'unpaid').length
    };

    // Calculate shift-wise leave breakdown
    const shiftLeaveBreakdown: any = {};
    leaves.forEach((leave: any) => {
      const emp = leave.employeeId;
      if (emp?.shiftId) {
        const shiftName = emp.shiftId.name;
        shiftLeaveBreakdown[shiftName] = (shiftLeaveBreakdown[shiftName] || 0) + 1;
      } else {
        shiftLeaveBreakdown['Not Assigned'] = (shiftLeaveBreakdown['Not Assigned'] || 0) + 1;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          startDate: start.toLocaleDateString('en-CA'),
          endDate: end.toLocaleDateString('en-CA')
        },
        summary: {
          totalEmployees,
          employeesOnLeave: uniqueEmployeesOnLeave.length,
          employeesWorking: totalEmployees - uniqueEmployeesOnLeave.length,
          totalLeaveRequests: leaves.length,
          leaveTypeBreakdown,
          shiftLeaveBreakdown
        },
        leaveDetails: formatted
      }
    });

  } catch (error: any) {
    console.error('Error in getLeaveReport:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching leave report",
      details: error.message
    });
  }
};

// ========================================
// GET SHIFT STATISTICS (NEW)
// ========================================
const getShiftStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.query;
    
    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Get all shifts
    const shifts = await Shift.find({ isActive: true }).lean();

    // Get all employees grouped by shift
    const shiftStats = await Promise.all(
      shifts.map(async (shift) => {
        // Total employees in this shift
        const totalInShift = await Employee.countDocuments({ shiftId: shift._id });

        // Employees on leave
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const employeesOnLeave = await Leave.find({
          status: 'approved',
          fromDate: { $lte: endOfDay },
          endDate: { $gte: targetDate }
        }).distinct('employeeId');

        const employeesInShiftOnLeave = await Employee.countDocuments({
          shiftId: shift._id,
          _id: { $in: employeesOnLeave }
        });

        // Employees who checked in
        const checkedInCount = await Attendance.countDocuments({
          date: targetDate,
          shiftId: shift._id,
          checkIn: { $exists: true, $ne: null }
        });

        // Late employees
        const lateCount = await Attendance.countDocuments({
          date: targetDate,
          shiftId: shift._id,
          isLate: true
        });

        return {
          shift: {
            id: shift._id,
            name: shift.name,
            time: `${shift.startTime} - ${shift.endTime}`,
            isCrossMidnight: shift.isCrossMidnight
          },
          statistics: {
            totalEmployees: totalInShift,
            present: checkedInCount,
            onLeave: employeesInShiftOnLeave,
            absent: Math.max(0, totalInShift - checkedInCount - employeesInShiftOnLeave),
            late: lateCount,
            attendanceRate: totalInShift > 0 
              ? ((checkedInCount / totalInShift) * 100).toFixed(2) + '%'
              : '0%'
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      date: targetDate.toLocaleDateString('en-CA'),
      shiftStatistics: shiftStats
    });

  } catch (error: any) {
    console.error('Error in getShiftStatistics:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching shift statistics",
      details: error.message
    });
  }
};

export { 
  getEmployeeDashboard, 
  getWorkingEmployeesToday, 
  getLeaveReport,
  getShiftStatistics 
};