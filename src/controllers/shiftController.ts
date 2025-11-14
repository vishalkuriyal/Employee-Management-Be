// controllers/shiftController.ts
import type { Request, Response } from "express";
import Shift from "../models/shift.ts";

// ========================================
// GET ALL SHIFTS
// ========================================
const getAllShifts = async (req: Request, res: Response): Promise<void> => {
  try {
    const shifts = await Shift.find()
      .sort({ startTime: 1 }) // Sort by start time
      .lean();

    res.status(200).json({
      success: true,
      shifts,
      count: shifts.length
    });
  } catch (error) {
    console.error('Error in getAllShifts:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching shifts",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// ========================================
// GET SHIFT BY ID
// ========================================
const getShiftById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const shift = await Shift.findById(id);

    if (!shift) {
      res.status(404).json({
        success: false,
        error: "Shift not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      shift
    });
  } catch (error) {
    console.error('Error in getShiftById:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching shift",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};
// CREATE NEW SHIFT
// ========================================
const createShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      displayName, // ⭐ ADD THIS
      startTime,
      endTime,
      graceMinutes,
      minimumHours,
      isCrossMidnight,
      description
    } = req.body;

    // Validation
    if (!name || !displayName || !startTime || !endTime) { // ⭐ ADD displayName validation
      res.status(400).json({
        success: false,
        error: "Name, display name, start time, and end time are required"
      });
      return;
    }

    // Check if shift with same displayName already exists (changed from name)
    const existingShift = await Shift.findOne({ displayName }); // ⭐ CHANGED
    if (existingShift) {
      res.status(400).json({
        success: false,
        error: "Shift with this display name already exists"
      });
      return;
    }

    const newShift = new Shift({
      name,
      displayName, // ⭐ ADD THIS
      startTime,
      endTime,
      graceMinutes: graceMinutes || 15,
      minimumHours: minimumHours || 8,
      isCrossMidnight: isCrossMidnight || false,
      description: description || ''
    });

    await newShift.save();

    res.status(201).json({
      success: true,
      message: "Shift created successfully",
      shift: newShift
    });
  } catch (error) {
    console.error('Error in createShift:', error);
    res.status(500).json({
      success: false,
      error: "Error creating shift",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// ========================================
// UPDATE SHIFT
// ========================================
const updateShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      displayName, // ⭐ ADD THIS
      startTime,
      endTime,
      graceMinutes,
      minimumHours,
      isCrossMidnight,
      description,
      isActive // ⭐ ADD THIS (for edit form)
    } = req.body;

    const shift = await Shift.findById(id);

    if (!shift) {
      res.status(404).json({
        success: false,
        error: "Shift not found"
      });
      return;
    }

    // Check if new displayName conflicts with existing shift
    if (displayName && displayName !== shift.displayName) { // ⭐ CHANGED
      const existingShift = await Shift.findOne({ displayName });
      if (existingShift) {
        res.status(400).json({
          success: false,
          error: "Shift with this display name already exists"
        });
        return;
      }
    }

    // Update fields
    if (name) shift.name = name;
    if (displayName) shift.displayName = displayName; // ⭐ ADD THIS
    if (startTime) shift.startTime = startTime;
    if (endTime) shift.endTime = endTime;
    if (graceMinutes !== undefined) shift.graceMinutes = graceMinutes;
    if (minimumHours !== undefined) shift.minimumHours = minimumHours;
    if (isCrossMidnight !== undefined) shift.isCrossMidnight = isCrossMidnight;
    if (description !== undefined) shift.description = description;
    if (isActive !== undefined) shift.isActive = isActive; // ⭐ ADD THIS

    await shift.save();

    res.status(200).json({
      success: true,
      message: "Shift updated successfully",
      shift
    });
  } catch (error) {
    console.error('Error in updateShift:', error);
    res.status(500).json({
      success: false,
      error: "Error updating shift",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// ========================================
// DELETE SHIFT
// ========================================
const deleteShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if any employees are assigned to this shift
    const Employee = (await import("../models/employee.ts")).default;
    const employeesWithShift = await Employee.countDocuments({ shiftId: id });

    if (employeesWithShift > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete shift. ${employeesWithShift} employee(s) are assigned to this shift. Please reassign them first.`
      });
      return;
    }

    const shift = await Shift.findByIdAndDelete(id);

    if (!shift) {
      res.status(404).json({
        success: false,
        error: "Shift not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Shift deleted successfully"
    });
  } catch (error) {
    console.error('Error in deleteShift:', error);
    res.status(500).json({
      success: false,
      error: "Error deleting shift",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// ========================================
// GET SHIFT STATISTICS
// ========================================
const getShiftStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const Employee = (await import("../models/employee.ts")).default;
    
    const shifts = await Shift.find();
    
    const statistics = await Promise.all(
      shifts.map(async (shift) => {
        const employeeCount = await Employee.countDocuments({ 
          shiftId: shift._id 
        });

        return {
          shiftId: shift._id,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isCrossMidnight: shift.isCrossMidnight,
          employeeCount
        };
      })
    );

    res.status(200).json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Error in getShiftStatistics:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching shift statistics",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

export {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  getShiftStatistics
};