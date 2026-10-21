import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { signToken } from "../utils/jwt.js";

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const stored = user.password || "";
    const valid = isBcryptHash(stored)
      ? await bcrypt.compare(password, stored)
      : stored === password;

    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ترقية تلقائية للباسوردات القديمة المخزنة كنص صريح
    if (!isBcryptHash(stored)) {
      user.password = await bcrypt.hash(password, 10);
      await user.save();
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is disabled" });
    }

    const token = signToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
};

// GET /api/auth/me
export const me = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /api/auth/me
export const updateMe = async (req: any, res: Response) => {
  try {
    const { name, email, phone } = req.body;
    const updates: any = {};

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (phone !== undefined) updates.phone = phone;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // نتأكد إن الـ email مش مستخدمين
    if (updates.email) {
      const conflict = await User.findOne({
        _id: { $ne: req.user.id },
        email: updates.email,
      });

      if (conflict) {
        return res.status(409).json({ message: "ُEmail already in use" });
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /api/auth/change-password
export const changePassword = async (req: any, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "currentPassword and newPassword required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const stored = user.password || "";
    const valid = isBcryptHash(stored)
      ? await bcrypt.compare(currentPassword, stored)
      : stored === currentPassword;

    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
