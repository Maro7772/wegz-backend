import { Request, Response } from "express";
import { sectionMap, isValidSection } from "../utils/sectionMap.js";

// helper: يحول الملفات المرفوعة لـ URLs ويحطها في الـ body
const mergeUploadedFiles = (body: any, files: any) => {
  const result: any = { ...body };

  // 1) تحويل booleans
  if (result.isVisible === "true") result.isVisible = true;
  if (result.isVisible === "false") result.isVisible = false;

  // 2) تحويل arrays اللي بتيجي كـ JSON string
  ["links", "socials", "items", "fields"].forEach((key) => {
    if (typeof result[key] === "string") {
      try {
        result[key] = JSON.parse(result[key]);
      } catch {
        // مش JSON صالح — سيبها زي ما هي
      }
    }
  });

  // 3) لو مفيش ملفات → خلاص
  if (!files || !Array.isArray(files) || files.length === 0) return result;

  // 4) نعالج كل ملف
  files.forEach((file: any) => {
    const url = `/uploads/${file.filename}`;

    // 4a) الحقل عادي (image, logo, avatar, ...)
    if (!file.fieldname.includes(".")) {
      result[file.fieldname] = url;
      return;
    }

    // 4b) الحقل جوا array (زي "items.0.icon")
    const parts = file.fieldname.split(".");
    // parts = ["items", "0", "icon"]

    let current: any = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const nextKey = parts[i + 1];
      const isNextIndex = !isNaN(Number(nextKey));

      if (!current[key]) {
        current[key] = isNextIndex ? [] : {};
      }
      current = current[key];
    }
    current[parts[parts.length - 1]] = url;
  });

  return result;
};

// CREATE
export const createSection = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const sectionType = Array.isArray(type) ? type[0] : type;
    if (!isValidSection(sectionType)) {
      return res.status(400).json({ message: "Invalid section type" });
    }

    const Model = sectionMap[sectionType];
    const files = req.files as Express.Multer.File[] | undefined;
    const body = mergeUploadedFiles(req.body, files);

    // 1) لو isVisible مش محددة:
    //    - أول نسخة → true
    //    - غير كده → false
    const count = await Model.countDocuments();
    if (body.isVisible === undefined) {
      body.isVisible = count === 0;
    }

    // 2) لو isVisible: true → نخلي الباقي false
    if (body.isVisible === true || body.isVisible === "true") {
      body.isVisible = true; // نضمن إنها boolean
      await Model.updateMany({}, { isVisible: false });
    }

    const doc = await Model.create(body);
    res.status(201).json({ data: doc });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET ALL
export const getAllSections = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const sectionType = Array.isArray(type) ? type[0] : type;
    if (!isValidSection(sectionType)) {
      return res.status(400).json({ message: "Invalid section type" });
    }

    const Model = sectionMap[sectionType];
    const docs = await Model.find().sort({ createdAt: -1 });
    res.json({ data: docs });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET ONE
export const getSectionById = async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const sectionType = Array.isArray(type) ? type[0] : type;
    if (!isValidSection(sectionType)) {
      return res.status(400).json({ message: "Invalid section type" });
    }

    const Model = sectionMap[sectionType];
    const doc = await Model.findById(id);
    if (!doc)
      return res.status(404).json({ message: `${sectionType} not found` });

    res.json({ data: doc });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// UPDATE
export const updateSection = async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const sectionType = Array.isArray(type) ? type[0] : type;
    if (!isValidSection(sectionType)) {
      return res.status(400).json({ message: "Invalid section type" });
    }

    const Model = sectionMap[sectionType];
    const files = req.files as Express.Multer.File[] | undefined;
    const body = mergeUploadedFiles(req.body, files);

    // لو isVisible: true → نخلي الباقي false
    if (body.isVisible === true || body.isVisible === "true") {
      body.isVisible = true; // نضمن إنها boolean
      await Model.updateMany({ _id: { $ne: id } }, { isVisible: false });
    }

    // لو isVisible: false صريحة → نخليها boolean
    if (body.isVisible === "false") {
      body.isVisible = false;
    }

    const doc = await Model.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!doc)
      return res.status(404).json({ message: `${sectionType} not found` });

    res.json({ data: doc });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// DELETE
export const deleteSection = async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const sectionType = Array.isArray(type) ? type[0] : type;
    if (!isValidSection(sectionType)) {
      return res.status(400).json({ message: "Invalid section type" });
    }

    const Model = sectionMap[sectionType];
    const doc = await Model.findByIdAndDelete(id);
    if (!doc)
      return res.status(404).json({ message: `${sectionType} deleted` });

    res.json({ message: `${sectionType} deleted` });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
