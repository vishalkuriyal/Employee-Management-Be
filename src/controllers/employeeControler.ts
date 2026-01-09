import type { Request, Response } from "express";
import Employee from "../models/employee";
import User from "../models/user";
import bcrypt from "bcryptjs";
import multer from "multer";
import fs from "fs";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads")
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// ========================================
// ADD EMPLOYEE (Updated with Shift)
// ========================================
const addEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      email,
      password,
      dob,
      doj,
      gender,
      department,
      shiftId, // ⭐ NEW: Shift assignment
      phoneNumber,
      salary,
      role,
      bankBranch,
      bankIfsc,
      accountNumber,
      employeeId
    } = req.body;

    // Validation for required fields
    if (!shiftId) {
      res.status(400).json({
        success: false,
        error: "Shift assignment is required"
      });
      return;
    }

    const user = await User.findOne({ email });

    if (user) {
      res.status(400).json({
        success: false,
        error: "User already registered"
      });
      return;
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashPassword,
      role,
      image: req.file ? req.file.filename : ""
    });

    const savedUser = await newUser.save();

    const newEmployee = new Employee({
      userId: savedUser._id,
      employeeId,
      dob,
      doj,
      gender,
      phoneNumber,
      accountNumber,
      bankBranch,
      bankIfsc,
      department,
      shiftId, // ⭐ NEW: Save shift assignment
      salary
    });

    await newEmployee.save();

    res.status(200).json({
      success: true,
      message: "Employee created successfully"
    });
    return;
  } catch (error) {
    console.error("Error in addEmployee:", error);
    res.status(500).json({
      success: false,
      error: "Server error in adding employee",
      details: error instanceof Error ? error.message : String(error)
    });
    return;
  }
};

// ========================================
// GET ALL EMPLOYEES (Updated with Shift)
// ========================================
const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const employees = await Employee.find()
      .populate('userId', { password: 0 })
      .populate('department')
      .populate('shiftId'); // ⭐ NEW: Populate shift information

    res.status(200).json({ success: true, employees });
    return;
  } catch (error) {
    console.error("Error in getEmployees:", error);
    res.status(500).json({
      success: false,
      error: "Get employees server error"
    });
    return;
  }
};

// ========================================
// GET SINGLE EMPLOYEE (Updated with Shift)
// ========================================
const getEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    let employee;

    employee = await Employee.findById({ _id: id })
      .populate('userId', { password: 0 })
      .populate('department')
      .populate('shiftId'); // ⭐ NEW: Populate shift information

    if (!employee) {
      employee = await Employee.findOne({ userId: id })
        .populate('userId', { password: 0 })
        .populate('department')
        .populate('shiftId'); // ⭐ NEW: Populate shift information
    }

    if (!employee) {
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return;
    }

    res.status(200).json({ success: true, employee });
    return;
  } catch (error) {
    console.error("Error in getEmployee:", error);
    res.status(500).json({
      success: false,
      error: "View employee server error"
    });
    return;
  }
};

// ========================================
// UPDATE EMPLOYEE (Updated with Shift)
// ========================================
const UpdateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Get the fields from request body
    const {
      name,
      email,
      password,
      dob,
      doj,
      gender,
      department,
      shiftId, // ⭐ NEW: Shift update
      phoneNumber,
      salary,
      role,
      bankBranch,
      bankIfsc,
      accountNumber,
      employeeId
    } = req.body;

    // First find the employee to get the userId
    const employee = await Employee.findById(id);

    if (!employee) {
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return;
    }

    // Get current user data to access the current image filename
    const currentUser = await User.findById(employee.userId);
    if (!currentUser) {
      res.status(404).json({
        success: false,
        error: "User associated with employee not found"
      });
      return;
    }

    // Update the user information
    const updateUserData: any = {};
    if (name) updateUserData.name = name;
    if (email) updateUserData.email = email;
    if (role) updateUserData.role = role;

    // Handle password update if provided
    if (password) {
      const hashPassword = await bcrypt.hash(password, 10);
      updateUserData.password = hashPassword;
    }

    // Check if new image is uploaded
    if (req.file) {
      // Delete previous image if it exists
      if (currentUser.image) {
        const imagePath = path.join(process.cwd(), "public/uploads", currentUser.image);

        // Check if file exists before attempting to delete
        if (fs.existsSync(imagePath)) {
          try {
            fs.unlinkSync(imagePath);
            console.log(`Previous image deleted: ${currentUser.image}`);
          } catch (err) {
            console.error(`Error deleting previous image: ${err}`);
            // Continue with the update even if image deletion fails
          }
        }
      }

      // Set new image filename
      updateUserData.image = req.file.filename;
    }

    // Update the user document
    await User.findByIdAndUpdate(
      employee.userId,
      updateUserData,
      { new: true }
    );

    // Prepare employee update data
    const updateEmployeeData: any = {};
    if (employeeId) updateEmployeeData.employeeId = employeeId;
    if (dob) updateEmployeeData.dob = dob;
    if (doj) updateEmployeeData.doj = doj;
    if (gender) updateEmployeeData.gender = gender;
    if (department) updateEmployeeData.department = department;
    if (shiftId) updateEmployeeData.shiftId = shiftId; // ⭐ NEW: Update shift
    if (phoneNumber) updateEmployeeData.phoneNumber = phoneNumber;
    if (salary) updateEmployeeData.salary = Number(salary);
    if (bankBranch) updateEmployeeData.bankBranch = bankBranch;
    if (bankIfsc) updateEmployeeData.bankIfsc = bankIfsc;
    if (accountNumber) updateEmployeeData.accountNumber = accountNumber;

    // Update the employee document
    const updatedEmployee = await Employee.findByIdAndUpdate(
      id,
      updateEmployeeData,
      { new: true }
    )
      .populate('userId', { password: 0 })
      .populate('department')
      .populate('shiftId'); // ⭐ NEW: Populate shift information

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      employee: updatedEmployee
    });
    return;

  } catch (error) {
    console.error("Update employee error:", error);
    res.status(500).json({
      success: false,
      error: "Server error in updating employee"
    });
    return;
  }
};

// ========================================
// DELETE EMPLOYEE
// ========================================
const DeleteEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Find the employee to get the associated userId
    const employee = await Employee.findById(id);

    if (!employee) {
      res.status(404).json({
        success: false,
        error: "Employee not found"
      });
      return;
    }

    // Get the user ID from the employee record
    const userId = employee.userId;

    // Find the user to get image filename (for deletion)
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: "User associated with employee not found"
      });
      return;
    }

    // Delete the image file if it exists
    if (user.image) {
      const imagePath = path.join(process.cwd(), "public/uploads", user.image);

      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
          console.log(`Employee image deleted: ${user.image}`);
        } catch (err) {
          console.error(`Error deleting employee image: ${err}`);
          // Continue with deletion even if image removal fails
        }
      }
    }

    // Delete the employee document
    await Employee.findByIdAndDelete(id);

    // Delete the associated user document
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully"
    });
    return;

  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({
      success: false,
      error: "Server error in deleting employee"
    });
    return;
  }
};

// ========================================
// GET EMPLOYEES BY DEPARTMENT ID
// ========================================
const fetchEmployeesByDepId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employees = await Employee.find({ department: id })
      .populate('userId', { password: 0 })
      .populate('department')
      .populate('shiftId'); // ⭐ NEW: Populate shift information

    res.status(200).json({ success: true, employees });
    return;
  } catch (error) {
    console.error("Error in fetchEmployeesByDepId:", error);
    res.status(500).json({
      success: false,
      error: "Get employees by department server error"
    });
    return;
  }
};

// ========================================
// GET EMPLOYEES BY SHIFT ID (NEW)
// ========================================
const fetchEmployeesByShiftId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employees = await Employee.find({ shiftId: id })
      .populate('userId', { password: 0 })
      .populate('department')
      .populate('shiftId');

    res.status(200).json({
      success: true,
      employees,
      count: employees.length
    });
    return;
  } catch (error) {
    console.error("Error in fetchEmployeesByShiftId:", error);
    res.status(500).json({
      success: false,
      error: "Get employees by shift server error"
    });
    return;
  }
};

export {
  addEmployee,
  upload,
  getEmployees,
  getEmployee,
  UpdateEmployee,
  DeleteEmployee,
  fetchEmployeesByDepId,
  fetchEmployeesByShiftId // ⭐ NEW: Export new function
};