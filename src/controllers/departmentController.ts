import type { Request, Response } from "express";
import Department from "../models/department";

const addDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dep_name, description } = req.body;
    console.log("Attempting to save department:", { dep_name, description });

    if (!dep_name || dep_name.trim() === "") {
      res.status(400).json({ success: false, error: "Department name is required" });
      return;
    }

    const newDep = new Department({ dep_name, description });
    await newDep.save();

    res.status(200).json({ success: true, department: newDep });
  } catch (error) {
    console.error("Department save error:", error);
    res.status(500).json({ success: false, error: "Add Department Server Error" });
  }
};

const getDepartments = async (req: Request, res: Response): Promise<void> => {
  try {
    const departments = await Department.find();
    res.status(200).json({ success: true, departments });
  } catch (error) {
    res.status(500).json({ success: false, error: "Get Departments Server Error" });
  }
};

const getDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const department = await Department.findById(id);

    if (!department) {
      res.status(404).json({ success: false, error: "Department not found" });
      return;
    }

    res.status(200).json({ success: true, department });
  } catch (error) {
    res.status(500).json({ success: false, error: "Get Department Server Error" });
  }
};

const UpdateDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { dep_name, description } = req.body;

    const updatedDepartment = await Department.findByIdAndUpdate(
      id,
      { dep_name, description },
      { new: true }
    );

    if (!updatedDepartment) {
      res.status(404).json({ success: false, error: "Department not found" });
      return;
    }

    res.status(200).json({ success: true, department: updatedDepartment });
  } catch (error) {
    res.status(500).json({ success: false, error: "Update Department Server Error" });
  }
};

const deleteDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);
    if (!department) {
      res.status(404).json({ success: false, error: "Department not found" });
      return;
    }

    await department.deleteOne();

    res.status(200).json({ success: true, message: "Department deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Delete Department Server Error" });
  }
};

export { addDepartment, getDepartments, getDepartment, UpdateDepartment, deleteDepartment };
