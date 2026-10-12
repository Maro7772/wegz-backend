import { Request, Response } from "express";
import { AVAILABLE_MODES, Theme } from "../models/Theme.js";

// GET /api/admin/themes  → كل الثيمات
export const getAllThemes = async (_req: Request, res: Response) => {
  try {
    const themes = await Theme.find().sort({ createdAt: 1 });
    res.json({ data: themes });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /api/admin/themes/:id  → ثيم واحد
export const getThemeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const theme = await Theme.findById(id);
    if (!theme) return res.status(404).json({ message: "Theme not found" });
    res.json({ data: theme });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// POST /api/admin/themes  → إنشاء ثيم جديد
export const createTheme = async (req: Request, res: Response) => {
  try {
    const { name, description, availableModes } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "name is required" });
    }

    const exists = await Theme.findOne({ name: name.trim() });
    if (exists) {
      return res.status(409).json({ message: "Theme name already exists" });
    }

    const count = await Theme.countDocuments();

    const theme = await Theme.create({
      name: name.trim(),
      description: description || "",
      isActive: count === 0,
      availableModes: availableModes || ["dark", "light"],
      activeMode: "light",
    });

    res.status(201).json({ data: theme });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /api/admin/themes/:id  → تعديل ثيم
export const updateTheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // ⚠️ التحقق من الاسم
    if (updates.name) {
      const conflict = await Theme.findOne({
        _id: { $ne: id }, // مش نفس الـ document
        name: updates.name,
      });
      if (conflict) {
        return res.status(409).json({ message: "Theme name already exists" });
      }
    }

    const theme = await Theme.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!theme) return res.status(404).json({ message: "Theme not found" });

    res.json({ data: theme });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /api/admin/themes/:id/activate  → تفعيل ثيم
export const activateTheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const theme = await Theme.findById(id);
    if (!theme) return res.status(404).json({ message: "Theme not found" });

    // كل الثيمات false، واللي عايزينه true
    await Theme.updateMany({}, { isActive: false });
    theme.isActive = true;
    await theme.save();

    res.json({ data: theme });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /api/admin/themes/:id/mode  → تغيير الوضع
export const changeMode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { mode } = req.body;

    if (!mode) {
      return res.status(400).json({ message: "mode is required" });
    }

    if (!AVAILABLE_MODES.includes(mode)) {
      return res.status(400).json({
        message: `Invalid mode. Available: ${AVAILABLE_MODES.join(", ")}`,
      });
    }

    const theme = await Theme.findById(id);
    if (!theme) return res.status(404).json({ message: "Theme not found" });

    // نتأكد إن الـ mode متاح للثيم ده
    if (!theme.availableModes.includes(mode)) {
      return res.status(400).json({
        message: `Mode "${mode}" not available for this theme. Available: ${theme.availableModes.join(", ")}`,
      });
    }

    theme.activeMode = mode;
    await theme.save();

    res.json({ data: theme });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// DELETE /api/admin/themes/:id  → مسح ثيم
export const deleteTheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const theme = await Theme.findById(id);
    if (!theme) return res.status(404).json({ message: "Theme not found" });

    // ممنوع تمسح الثيم النشط
    if (theme.isActive) {
      return res.status(400).json({ message: "Cannot delete active theme" });
    }

    await theme.deleteOne();
    res.json({ message: "Theme deleted" });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
