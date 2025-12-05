import type { Request, Response } from "express";
import User from "../models/user";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken";

const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, error: "Wrong password" });
      return;
    }

    if (!process.env.JWT_KEY) {
      throw new Error("JWT_KEY is not defined in environment variables.");
    }

    const token = jwt.sign(
      { _id: user._id, role: user.role },
      process.env.JWT_KEY,
      { expiresIn: "10d" }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    res.status(500).json({ success: false, error: message });
  }
};

const verify = (
  req: Request,
  res: Response
): Promise<void> => {
  res.status(200).json({
    success: true,
    user: {
      _id: (req as any).user._id,
      name: (req as any).user.name,
      role: (req as any).user.role,
    },
  });
  return Promise.resolve();
};

export { login, verify };
