import type { Request, Response } from "express";
import Salary from "../models/salary.ts";

const addSalary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, basicSalary, payDate } = req.body
    const newSalary = new Salary({
      employeeId,
      basicSalary,
      payDate,
      netSalary: basicSalary
    })

    await newSalary.save()

    res.status(200).json({ success: true })
    return
  } catch (error) {
    res.status(500).json({ success: false, error: "salary add server error" })
    return

  }
}

export { addSalary }