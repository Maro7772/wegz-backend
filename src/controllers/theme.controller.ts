import { Request, Response } from "express";
import { AVAILABLE_MODES, Theme, type ModeKey } from "../models/Theme.js";
import { getMasterThemeModel } from "../config/tenant.js";

/**
 * GET /api/admin/themes
 * جلب جميع الثيمات المتاحة للمنصة من الـ Master DB مع تحديد الثيم المفعّل حالياً للمتجر
 */
export const getAllThemes = async (_req: Request, res: Response) => {
  try {
    const MasterTheme = await getMasterThemeModel();
    const masterThemes = await MasterTheme.find({ status: "active" })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    // جلب الثيم النشط حالياً للمتجر من قاعدة بيانات الـ tenant
    const currentActive = await Theme.findOne({ isActive: true }).lean();

    const data = masterThemes.map((mt: any, index: number) => {
      // هل هذا الثيم هو المفعّل للمتجر؟
      const isSelected = currentActive
        ? currentActive.name === mt.name
        : index === 0; // افتراضياً الأول مفعّل إذا لم يكن هناك اختيار سابق

      return {
        _id: mt._id,
        name: mt.name,
        key: mt.key,
        description: mt.description || "",
        preview_image: mt.preview_image || "",
        availableModes: mt.availableModes || ["dark", "light"],
        isActive: isSelected,
        activeMode: isSelected && currentActive?.activeMode
          ? currentActive.activeMode
          : mt.defaultMode || "light",
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
 * جلب تفاصيل ثيم محدد من Master DB
 */
export const getThemeById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const MasterTheme = await getMasterThemeModel();
    const masterTheme = await MasterTheme.findById(id).lean();

    if (!masterTheme) {
      return res.status(404).json({ message: "Theme not found" });
    }

    const currentActive = await Theme.findOne({ isActive: true }).lean();
    const isSelected = currentActive?.name === masterTheme.name;

    res.json({
      data: {
        _id: masterTheme._id,
        name: masterTheme.name,
        key: masterTheme.key,
        description: masterTheme.description || "",
        preview_image: masterTheme.preview_image || "",
        availableModes: masterTheme.availableModes || ["dark", "light"],
        isActive: isSelected,
        activeMode: isSelected && currentActive?.activeMode
          ? currentActive.activeMode
          : masterTheme.defaultMode || "light",
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * PATCH /api/admin/themes/:id/activate
 * تفعيل ثيم للمتجر الحالي
 */
export const activateTheme = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    // البحث في Master DB
    const MasterTheme = await getMasterThemeModel();
    let masterTheme = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      masterTheme = await MasterTheme.findById(id);
    }
    if (!masterTheme) {
      masterTheme = await MasterTheme.findOne({
        $or: [{ key: id }, { name: id }],
      });
    }

    if (!masterTheme) {
      return res.status(404).json({ message: "Theme not found in Master catalog" });
    }

    // تعطيل كل الثيمات في الـ Tenant DB
    await Theme.updateMany({}, { isActive: false });

    // تحديث أو إنشاء سجل الثيم في الـ Tenant DB وتفعيله
    const tenantTheme = await Theme.findOneAndUpdate(
      { name: masterTheme.name },
      {
        name: masterTheme.name,
        description: masterTheme.description || "",
        isActive: true,
        availableModes: masterTheme.availableModes || ["dark", "light"],
        activeMode: masterTheme.defaultMode || "light",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({
      message: `Theme "${masterTheme.name}" activated successfully`,
      data: {
        _id: masterTheme._id,
        name: masterTheme.name,
        key: masterTheme.key,
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
 * تغيير الوضع (dark / light) للثيم المفعّل في المتجر
 */
export const changeMode = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { mode } = req.body;

    if (!mode) {
      return res.status(400).json({ message: "mode is required" });
    }

    if (!AVAILABLE_MODES.includes(mode)) {
      return res.status(400).json({
        message: `Invalid mode. Available: ${AVAILABLE_MODES.join(", ")}`,
      });
    }

    // جلب الثيم من Master DB للتحقق من المودات المدعومة
    const MasterTheme = await getMasterThemeModel();
    let masterTheme = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      masterTheme = await MasterTheme.findById(id);
    }
    if (!masterTheme) {
      masterTheme = await MasterTheme.findOne({
        $or: [{ key: id }, { name: id }],
      });
    }

    const availableModes = masterTheme?.availableModes || ["dark", "light"];
    if (!availableModes.includes(mode)) {
      return res.status(400).json({
        message: `Mode "${mode}" is not supported for this theme`,
      });
    }

    // تحديث المود في قاعدة بيانات الـ Tenant
    const targetName = masterTheme?.name;
    let tenantTheme = null;

    if (targetName) {
      tenantTheme = await Theme.findOne({ name: targetName });
    }
    if (!tenantTheme) {
      tenantTheme = await Theme.findOne({ isActive: true });
    }

    if (!tenantTheme) {
      return res.status(404).json({ message: "Active theme not found in tenant DB" });
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
