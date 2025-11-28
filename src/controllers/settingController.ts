import type { Request, Response } from "express";
import User from "../models/user";
import bcrypt from "bcryptjs"

const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    const user = await User.findById({ _id: userId })

    if (!user) {
      res.status(404).json({ success: false, error: "user not found" })
      return
    }

    const isMatched = await bcrypt.compare(oldPassword, user.password)
    if (!isMatched) {
      res.status(404).json({ success: false, error: "Wrong Old Password" })
      return
    }

    const hashPassword = await bcrypt.hash(newPassword, 10)

    const newUser = await User.findByIdAndUpdate({ _id: userId }, { password: hashPassword })

    res.status(200).json({ success: true })
    return

  } catch (error) {
    res.status(500).json({ success: false, error: "setting error" })
    return
  }
}

export { changePassword }