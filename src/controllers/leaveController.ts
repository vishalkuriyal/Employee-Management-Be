import type { Request, Response } from "express";
import Leave from "../models/leave.ts";
import Employee from "../models/employee.ts";
import Attendance from "../models/attendance.ts";
import mongoose, { Types } from "mongoose";
import nodemailer from "nodemailer";

const MONTHLY_LEAVE_ALLOCATION = {
  casual: 1,
  sick: 1
};

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASSWORD // Your Gmail app password
  }
});

// Function to send leave application email
const sendLeaveApplicationEmail = async (
  employeeName: string,
  employeeEmail: string,
  employeeCode: string,
  department: string,
  leaveType: string,
  fromDate: Date,
  endDate: Date,
  totalDays: number,
  reason: string,
  isHalfDay: boolean,
  halfDayPeriod?: string
) => {
  try {
    const mailOptions = {
      from: `${employeeName} <${process.env.EMAIL_USER}>`,
      replyTo: employeeEmail, // Employee's email for replies
      to: process.env.ADMIN_EMAIL, // Your Gmail where you want to receive notifications
      subject: `New Leave Application - ${employeeName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
            New Leave Application
          </h2>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #555; margin-top: 0;">Employee Details</h3>
            <p><strong>Name:</strong> ${employeeName}</p>
            <p><strong>Email:</strong> ${employeeEmail}</p>
            <p><strong>Employee Code:</strong> ${employeeCode}</p>
            <p><strong>Department:</strong> ${department}</p>
          </div>
          
          <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h3 style="color: #555; margin-top: 0;">Leave Details</h3>
            <p><strong>Leave Type:</strong> <span style="text-transform: capitalize;">${leaveType}</span></p>
            <p><strong>From Date:</strong> ${fromDate.toLocaleDateString('en-IN', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric' 
            })}</p>
            <p><strong>To Date:</strong> ${endDate.toLocaleDateString('en-IN', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric' 
            })}</p>
            <p><strong>Duration:</strong> ${totalDays} ${totalDays === 1 ? 'day' : 'days'}</p>
            ${isHalfDay ? `<p><strong>Half Day Period:</strong> ${halfDayPeriod}</p>` : ''}
            <p><strong>Reason:</strong> ${reason}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 5px;">
            <p style="margin: 0; color: #856404;">
              ⏰ <strong>Action Required:</strong> Please review and approve/reject this leave application.
            </p>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #888; font-size: 12px;">
            <p>This is an automated notification from the Employee Management System</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Leave application email sent successfully');
  } catch (error) {
    console.error('Error sending leave application email:', error);
    // Don't throw error - we don't want email failure to stop leave creation
  }
};

interface PopulatedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
}

interface PopulatedDepartment {
  _id: Types.ObjectId;
  name: string;
}

interface PopulatedEmployee {
  _id: Types.ObjectId;
  userId: PopulatedUser;
  employeeId: string;
  department: PopulatedDepartment;
  doj: Date;
  dob?: Date;
  gender?: string;
  phoneNumber?: string;
  salary: number;
}

const isPopulatedEmployee = (employeeId: any): employeeId is PopulatedEmployee => {
  return employeeId && typeof employeeId === 'object' && 'userId' in employeeId;
};

const getEmployeeInfo = (employeeId: any) => {
  if (isPopulatedEmployee(employeeId)) {
    return {
      name: employeeId.userId?.name || 'Unknown',
      employeeCode: employeeId.employeeId || 'N/A',
      department: employeeId.department?.name || 'N/A'
    };
  }
  return {
    name: 'Unknown',
    employeeCode: 'N/A',
    department: 'N/A'
  };
};

const calculateAvailableLeaves = (doj: Date, leaveType: keyof typeof MONTHLY_LEAVE_ALLOCATION) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const joiningYear = doj.getFullYear();

  let startMonth: number;
  let startYear: number;

  if (joiningYear === currentYear) {
    startMonth = doj.getMonth();
    startYear = joiningYear;
  } else {
    startMonth = 0;
    startYear = currentYear;
  }

  const currentMonth = currentDate.getMonth();

  let totalMonths: number;
  if (startYear === currentYear) {
    totalMonths = currentMonth - startMonth + 1;
  } else {
    totalMonths = 12;
  }

  totalMonths = Math.max(0, totalMonths);

  return totalMonths * MONTHLY_LEAVE_ALLOCATION[leaveType];
};

// Helper function to mark attendance for leave dates
const markLeaveAttendance = async (
  employeeId: Types.ObjectId,
  fromDate: Date,
  endDate: Date,
  leaveId: Types.ObjectId,
  isHalfDay: boolean
) => {
  try {
    const attendanceRecords = [];
    const currentDate = new Date(fromDate);
    currentDate.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (currentDate <= end) {
      const dateToMark = new Date(currentDate);

      const attendanceData = {
        employeeId,
        date: dateToMark,
        status: isHalfDay ? "half-day" as const : "leave" as const,
        leaveId,
        isManualEntry: false,
        remarks: "Auto-marked due to approved leave"
      };

      // Use findOneAndUpdate with upsert to avoid duplicates
      await Attendance.findOneAndUpdate(
        { employeeId, date: dateToMark },
        attendanceData,
        { upsert: true, new: true }
      );

      attendanceRecords.push(dateToMark);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return attendanceRecords;
  } catch (error) {
    console.error('Error marking leave attendance:', error);
    throw error;
  }
};

// Helper function to remove attendance when leave is rejected
const removeLeaveAttendance = async (
  employeeId: Types.ObjectId,
  fromDate: Date,
  endDate: Date
) => {
  try {
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Remove attendance records that were auto-marked for leave
    await Attendance.deleteMany({
      employeeId,
      date: { $gte: start, $lte: end },
      status: { $in: ['leave', 'half-day'] },
      isManualEntry: false
    });

  } catch (error) {
    console.error('Error removing leave attendance:', error);
    throw error;
  }
};

// ... (keep your existing addLeave, getLeaveBalance, getLeaveBreakdown, getAllLeaves functions)

const addLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, leaveType, fromDate, endDate, reason, isHalfDay, halfDayPeriod } = req.body;

    if (!userId || !leaveType || !fromDate || !endDate || !reason) {
      res.status(400).json({
        success: false,
        error: "All fields are required"
      });
      return
    }

    if (isHalfDay && !halfDayPeriod) {
      res.status(400).json({
        success: false,
        error: "Half day period is required when selecting half day leave"
      });
      return
    }

    const employee = await Employee.findOne({ userId })
      .populate('userId', 'name email')
      .populate('department', 'name');

    if (!employee) {
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return
    }

    if (!employee.doj) {
      res.status(400).json({
        success: false,
        error: "Employee date of joining not found. Please contact HR."
      });
      return
    }

    const startDate = new Date(fromDate);
    const endDateObj = new Date(endDate);

    let totalDays: number;

    if (isHalfDay) {
      totalDays = 0.5;
      if (startDate.getTime() !== endDateObj.getTime()) {
        res.status(400).json({
          success: false,
          error: "For half day leave, from date and end date must be the same"
        });
        return
      }
    } else {
      const timeDiff = endDateObj.getTime() - startDate.getTime();
      totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

      if (totalDays <= 0) {
        res.status(400).json({
          success: false,
          error: "End date must be after or equal to start date"
        });
        return
      }
    }

    const availableLeaves = calculateAvailableLeaves(
      employee.doj,
      leaveType as keyof typeof MONTHLY_LEAVE_ALLOCATION
    );

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    const existingLeaves = await Leave.find({
      employeeId: employee._id,
      leaveType: leaveType,
      status: { $in: ['approved', 'pending'] },
      fromDate: { $gte: yearStart, $lte: yearEnd }
    });

    const totalUsedLeaves = existingLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);
    const remainingLeaves = availableLeaves - totalUsedLeaves;

    if (totalDays > remainingLeaves) {
      res.status(400).json({
        success: false,
        error: `Insufficient ${leaveType} leave balance. You have ${remainingLeaves} days remaining out of ${availableLeaves} available, but requested ${totalDays} days.`
      });
      return
    }

    const newLeave = new Leave({
      employeeId: employee._id,
      leaveType,
      fromDate: startDate,
      endDate: endDateObj,
      reason,
      totalDays,
      isHalfDay: isHalfDay || false,
      halfDayPeriod: isHalfDay ? halfDayPeriod : undefined
    });

    await newLeave.save();

    // Get employee info for email - make sure it's populated
    const populatedEmployee = await Employee.findById(employee._id)
      .populate('userId', 'name email')
      .populate('department', 'name');

    const employeeInfo = getEmployeeInfo(populatedEmployee);
    const employeeEmail = isPopulatedEmployee(populatedEmployee) 
      ? populatedEmployee.userId?.email 
      : '';
    
    await sendLeaveApplicationEmail(
      employeeInfo.name,
      employeeEmail || 'noreply@company.com',
      employeeInfo.employeeCode,
      employeeInfo.department,
      leaveType,
      startDate,
      endDateObj,
      totalDays,
      reason,
      isHalfDay || false,
      halfDayPeriod
    );

    const newRemainingLeaves = remainingLeaves - totalDays;

    res.status(200).json({
      success: true,
      message: "Leave application submitted successfully",
      leave: newLeave,
      leaveBalance: {
        totalAvailable: availableLeaves,
        totalUsed: totalUsedLeaves + totalDays,
        remaining: newRemainingLeaves,
        monthlyAllocation: MONTHLY_LEAVE_ALLOCATION[leaveType as keyof typeof MONTHLY_LEAVE_ALLOCATION],
        doj: employee.doj
      }
    });
    return

  } catch (error) {
    console.error('Error in addLeave:', error);
    res.status(500).json({
      success: false,
      error: "Leave add server error",
      details: error instanceof Error ? error.message : String(error)
    });
    return
  }
};

const getLeaveBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const employee = await Employee.findOne({ userId });
    if (!employee) {
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return
    }

    if (!employee.doj) {
      res.status(400).json({
        success: false,
        error: "Employee date of joining not found. Please contact HR."
      });
      return
    }

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    const availableCasualLeaves = calculateAvailableLeaves(employee.doj, 'casual');
    const availableSickLeaves = calculateAvailableLeaves(employee.doj, 'sick');

    const casualLeaves = await Leave.find({
      employeeId: employee._id,
      leaveType: 'casual',
      status: { $in: ['approved', 'pending'] },
      fromDate: { $gte: yearStart, $lte: yearEnd }
    });

    const sickLeaves = await Leave.find({
      employeeId: employee._id,
      leaveType: 'sick',
      status: { $in: ['approved', 'pending'] },
      fromDate: { $gte: yearStart, $lte: yearEnd }
    });

    const casualUsed = casualLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);
    const sickUsed = sickLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);

    res.status(200).json({
      success: true,
      leaveBalance: {
        casual: {
          available: availableCasualLeaves,
          used: casualUsed,
          remaining: availableCasualLeaves - casualUsed,
          monthlyAllocation: MONTHLY_LEAVE_ALLOCATION.casual
        },
        sick: {
          available: availableSickLeaves,
          used: sickUsed,
          remaining: availableSickLeaves - sickUsed,
          monthlyAllocation: MONTHLY_LEAVE_ALLOCATION.sick
        },
        doj: employee.doj,
        currentYear: currentYear
      }
    });
    return

  } catch (error) {
    console.error('Error in getLeaveBalance:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching leave balance"
    });
    return
  }
};

const getLeaveBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { year } = req.query;

    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    const employee = await Employee.findOne({ userId });
    if (!employee) {
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return
    }

    if (!employee.doj) {
      res.status(400).json({
        success: false,
        error: "Employee date of joining not found."
      });
      return
    }

    const doj = employee.doj;
    const joiningYear = doj.getFullYear();
    const joiningMonth = doj.getMonth();

    const monthlyBreakdown = [];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let startMonth = 0;
    if (joiningYear === targetYear) {
      startMonth = joiningMonth;
    }

    for (let month = startMonth; month < 12; month++) {
      const monthStart = new Date(targetYear, month, 1);
      const monthEnd = new Date(targetYear, month + 1, 0);

      const monthLeaves = await Leave.find({
        employeeId: employee._id,
        status: { $in: ['approved', 'pending'] },
        $or: [
          { fromDate: { $gte: monthStart, $lte: monthEnd } },
          { endDate: { $gte: monthStart, $lte: monthEnd } },
          { fromDate: { $lt: monthStart }, endDate: { $gt: monthEnd } }
        ]
      });

      const casualTaken = monthLeaves
        .filter(leave => leave.leaveType === 'casual')
        .reduce((sum, leave) => sum + leave.totalDays, 0);

      const sickTaken = monthLeaves
        .filter(leave => leave.leaveType === 'sick')
        .reduce((sum, leave) => sum + leave.totalDays, 0);

      monthlyBreakdown.push({
        month: monthNames[month],
        monthNumber: month + 1,
        allocated: {
          casual: MONTHLY_LEAVE_ALLOCATION.casual,
          sick: MONTHLY_LEAVE_ALLOCATION.sick
        },
        taken: {
          casual: casualTaken,
          sick: sickTaken
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        year: targetYear,
        doj: doj,
        monthlyAllocation: MONTHLY_LEAVE_ALLOCATION,
        breakdown: monthlyBreakdown
      }
    });
    return

  } catch (error) {
    console.error('Error in getLeaveBreakdown:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching leave breakdown"
    });
    return
  }
};

const getAllLeaves = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, leaveType, search } = req.query;

    const filter: any = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (leaveType && leaveType !== 'all') {
      filter.leaveType = leaveType;
    }

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const leaves = await Leave.find(filter)
      .populate({
        path: 'employeeId',
        populate: [
          {
            path: 'userId',
            select: 'name email'
          },
          {
            path: 'department',
            select: 'name'
          }
        ]
      })
      .sort({ appliedDate: -1 })
      .skip(skip)
      .limit(limitNumber);

    let filteredLeaves = leaves;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredLeaves = leaves.filter(leave => {
        const employeeInfo = getEmployeeInfo(leave.employeeId);
        return employeeInfo.name.toLowerCase().includes(searchTerm) ||
          employeeInfo.employeeCode.toLowerCase().includes(searchTerm);
      });
    }

    const totalCount = await Leave.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNumber);

    const formattedLeaves = filteredLeaves.map(leave => {
      const employeeInfo = getEmployeeInfo(leave.employeeId);
      return {
        _id: leave._id,
        employeeName: employeeInfo.name,
        employeeCode: employeeInfo.employeeCode,
        department: employeeInfo.department,
        leaveType: leave.leaveType,
        fromDate: leave.fromDate,
        endDate: leave.endDate,
        totalDays: leave.totalDays,
        isHalfDay: leave.isHalfDay,
        halfDayPeriod: leave.halfDayPeriod,
        reason: leave.reason,
        status: leave.status,
        appliedDate: leave.appliedDate
      };
    });

    res.status(200).json({
      success: true,
      data: {
        leaves: formattedLeaves,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalCount,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1
        }
      }
    });
    return

  } catch (error) {
    console.error('Error in getAllLeaves:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching leaves",
      details: error instanceof Error ? error.message : String(error)
    });
    return
  }
};

// UPDATED: Now marks attendance when leave is approved/rejected
const updateLeaveStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { leaveId } = req.params;
    const { status, comments } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({
        success: false,
        error: "Invalid status. Must be 'approved' or 'rejected'"
      });
      return
    }

    const leave = await Leave.findById(leaveId);
    if (!leave) {
      res.status(404).json({
        success: false,
        error: "Leave request not found"
      });
      return
    }

    // Update leave status
    leave.status = status;
    leave.adminComments = comments || '';
    leave.reviewedDate = new Date();
    await leave.save();

    // Handle attendance marking based on status
    if (status === 'approved') {
      // Mark attendance as leave/half-day for approved dates
      await markLeaveAttendance(
        leave.employeeId,
        leave.fromDate,
        leave.endDate,
        leave._id as mongoose.Types.ObjectId,
        leave.isHalfDay
      );
    } else if (status === 'rejected') {
      // Remove any attendance records that were marked for this leave
      await removeLeaveAttendance(
        leave.employeeId,
        leave.fromDate,
        leave.endDate
      );
    }

    // Populate and return updated leave
    const populatedLeave = await Leave.findById(leaveId).populate({
      path: 'employeeId',
      populate: [
        {
          path: 'userId',
          select: 'name email'
        },
        {
          path: 'department',
          select: 'name'
        }
      ]
    });

    const employeeInfo = getEmployeeInfo(populatedLeave?.employeeId);

    res.status(200).json({
      success: true,
      message: `Leave ${status} successfully${status === 'approved' ? ' and attendance marked' : ''}`,
      leave: {
        _id: populatedLeave?._id,
        employeeName: employeeInfo.name,
        employeeCode: employeeInfo.employeeCode,
        department: employeeInfo.department,
        leaveType: populatedLeave?.leaveType,
        fromDate: populatedLeave?.fromDate,
        endDate: populatedLeave?.endDate,
        totalDays: populatedLeave?.totalDays,
        status: populatedLeave?.status,
        appliedDate: populatedLeave?.appliedDate
      }
    });
    return

  } catch (error) {
    console.error('Error in updateLeaveStatus:', error);
    res.status(500).json({
      success: false,
      error: "Error updating leave status"
    });
    return
  }
};

export { addLeave, getLeaveBalance, getLeaveBreakdown, getAllLeaves, updateLeaveStatus };