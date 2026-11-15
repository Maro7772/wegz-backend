import { Request, Response } from "express";
import mongoose from "mongoose";
import { AVAILABLE_MODES, Theme } from "../models/Theme.js";
import { getMasterThemeModel } from "../config/tenant.js";

/**
 * GET /api/admin/themes
 * جلب جميع الثيمات من Super Admin (Master DB) فقط
 * وتحديد الثيم الذي اختاره العميل كـ isActive: true، والباقي false.
 */
export const getAllThemes = async (_req: Request, res: Response) => {
  try {
    const MasterTheme = await getMasterThemeModel();

    // 1. جلب ثيمات السوبر أدمن من Master DB فقط
    let masterThemes = await MasterTheme.find({ status: { $ne: "inactive" } })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    if (!masterThemes || masterThemes.length === 0) {
      const defaultThemes = [
        {
          key: "theme-1",
          name: "Theme 1",
          description: "Default Classic Light & Dark Theme",
          status: "active",
          availableModes: ["dark", "light"],
          defaultMode: "light",
          order: 1,
        },
        {
          key: "theme-2",
          name: "Theme 2",
          description: "Modern Minimalist Theme",
          status: "active",
          availableModes: ["dark", "light"],
          defaultMode: "light",
          order: 2,
        },
      ];
      try {
        await MasterTheme.insertMany(defaultThemes);
        masterThemes = await MasterTheme.find({ status: { $ne: "inactive" } })
          .sort({ order: 1, createdAt: 1 })
          .lean();
      } catch {
        masterThemes = defaultThemes as any[];
      }
    }

    // 2. فحص الثيم المختار حالياً عند الـ tenant في قاعدة بياناته
    let currentTenantTheme = await Theme.findOne({ isActive: true }).lean();
    if (!currentTenantTheme) {
      currentTenantTheme = await Theme.findOne().lean();
    }

    // التحقق مما إذا كان الثيم المسجل عند العميل هو أحد ثيمات السوبر أدمن المعتمدة
    const isMatchingMaster = masterThemes.some(
      (mt: any) =>
        mt.name === currentTenantTheme?.name ||
        (mt.key && mt.key === currentTenantTheme?.name),
    );

    // إذا لم يكن العميل قد اختار بعد، أو كان عنده ثيم قديم غير موجود في السوبر أدمن:
    // نعتمد الثيم الأول من السوبر أدمن كافتراضي وننظف القديم
    if (!isMatchingMaster && masterThemes.length > 0) {
      const first = masterThemes[0];
      try {
        await Theme.deleteMany({});
        currentTenantTheme = await Theme.create({
          name: first.name,
          description: first.description || "",
          isActive: true,
          activeMode: first.defaultMode || "light",
          availableModes: first.availableModes || ["dark", "light"],
        });
      } catch {
        // Fallback
      }
    }

    const activeThemeName = currentTenantTheme?.name;
    const activeMode = currentTenantTheme?.activeMode || "light";

    // 3. إرجاع قائمة السوبر أدمن مع وضع isActive: true للثيم المختار فقط
    const data = masterThemes.map((mt: any) => {
      const isSelected = activeThemeName
        ? mt.name === activeThemeName || (mt.key && mt.key === activeThemeName)
        : false;

      return {
        _id: mt._id,
        name: mt.name,
        key: mt.key || mt.name.toLowerCase().replace(/\s+/g, "-"),
        description: mt.description || "",
        preview_image: mt.preview_image || "",
        availableModes: mt.availableModes || ["dark", "light"],
        isActive: isSelected,
        activeMode: isSelected ? activeMode : (mt.defaultMode || "light"),
        createdAt: mt.createdAt,
        updatedAt: mt.updatedAt,
      };
    });

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/admin/themes/:id
 */
export const getThemeById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim();
    const MasterTheme = await getMasterThemeModel();
    let masterTheme = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      masterTheme = await MasterTheme.findById(id).lean();
    }
    if (!masterTheme) {
      masterTheme = await MasterTheme.findOne({
        $or: [{ key: id.toLowerCase() }, { name: id }],
      }).lean();
    }

    if (!masterTheme) {
      return res.status(404).json({ message: "Theme not found" });
    }

    const currentTenantTheme = await Theme.findOne().lean();
    const isSelected = currentTenantTheme?.name === masterTheme.name;

    res.json({
      data: {
        _id: masterTheme._id,
        name: masterTheme.name,
        key: masterTheme.key || masterTheme.name.toLowerCase().replace(/\s+/g, "-"),
        description: masterTheme.description || "",
        preview_image: masterTheme.preview_image || "",
        availableModes: masterTheme.availableModes || ["dark", "light"],
        isActive: isSelected,
        activeMode: isSelected
          ? currentTenantTheme?.activeMode || "light"
          : masterTheme.defaultMode || "light",
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * PATCH /api/admin/themes/:id/activate
 * تفعيل ثيم للمتجر الحالي:
 * 1. مسح أي ثيم قديم موجود عند الـ tenant
 * 2. تسجيل الثيم المختار فقط كـ active
 */
export const activateTheme = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim();

    const MasterTheme = await getMasterThemeModel();
    let masterTheme = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      masterTheme = await MasterTheme.findById(id).lean();
    }
    if (!masterTheme) {
      masterTheme = await MasterTheme.findOne({
        $or: [
          { key: id.toLowerCase() },
          { name: id },
        ],
      }).lean();
    }

    if (!masterTheme) {
      return res.status(404).json({ message: "Theme not found in Super Admin catalog" });
    }

    // مسح القديم
    await Theme.deleteMany({});

    // إنشاء وحفظ المختار فقط
    const chosenMode = masterTheme.defaultMode || "light";
    const tenantTheme = await Theme.create({
      name: masterTheme.name,
      description: masterTheme.description || "",
      isActive: true,
      activeMode: chosenMode,
      availableModes: masterTheme.availableModes || ["dark", "light"],
    });

    res.json({
      message: `Theme "${masterTheme.name}" activated successfully`,
      data: {
        _id: masterTheme._id,
        name: masterTheme.name,
        key: masterTheme.key || masterTheme.name.toLowerCase().replace(/\s+/g, "-"),
        isActive: true,
        activeMode: tenantTheme.activeMode,
        availableModes: tenantTheme.availableModes,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * PATCH /api/admin/themes/:id/mode
 */
export const changeMode = async (req: Request, res: Response) => {
  try {
    const { mode } = req.body;

    if (!mode) {
      return res.status(400).json({ message: "mode is required" });
    }

    if (!AVAILABLE_MODES.includes(mode)) {
      return res.status(400).json({
        message: `Invalid mode. Available: ${AVAILABLE_MODES.join(", ")}`,
      });
    }

    let tenantTheme = await Theme.findOne();
    if (!tenantTheme) {
      return res.status(404).json({ message: "No active theme found for this tenant" });
    }

    if (!tenantTheme.availableModes.includes(mode)) {
      return res.status(400).json({
        message: `Mode "${mode}" is not available for theme "${tenantTheme.name}". Available: ${tenantTheme.availableModes.join(", ")}`,
      });
    }

    tenantTheme.activeMode = mode;
    await tenantTheme.save();

    res.json({
      message: `Mode changed to "${mode}" successfully`,
      data: tenantTheme,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * حظر عمليات الإنشاء والتعديل والحذف من الـ Tenant Admin
 */
export const forbiddenInTenantAdmin = async (_req: Request, res: Response) => {
  res.status(403).json({
    message: "Theme management (create/edit/delete) is managed centrally by Super Admin.",
  });
};
