import { Request, Response } from "express";
import { Announcement } from "../models/sections/announcement.model.js";
import { Header } from "../models/sections/header.model.js";
import { Hero } from "../models/sections/hero.model.js";
import { Info } from "../models/sections/info.model.js";
import { Info2 } from "../models/sections/info2.model.js";
import { Testimonials } from "../models/sections/testimonials.model.js";
import { Contact } from "../models/sections/contact.model.js";
import { Footer } from "../models/sections/footer.model.js";

// GET /api/admin/dashboard/sections
// بترجّع كل السكاشن بكل النسخ، عشان الداشبورد يعرضها مرة واحدة
export const getAllSections = async (_req: Request, res: Response) => {
  try {
    const [
      announcements,
      headers,
      heroes,
      infos,
      info2s,
      testimonials,
      contacts,
      footers,
    ] = await Promise.all([
      Announcement.find().sort({ createdAt: -1 }),
      Header.find().sort({ createdAt: -1 }),
      Hero.find().sort({ createdAt: -1 }),
      Info.find().sort({ createdAt: -1 }),
      Info2.find().sort({ createdAt: -1 }),
      Testimonials.find().sort({ createdAt: -1 }),
      Contact.find().sort({ createdAt: -1 }),
      Footer.find().sort({ createdAt: -1 }),
    ]);

    res.json({
      sections: {
        announcement: announcements,
        header: headers,
        hero: heroes,
        info: infos,
        info2: info2s,
        testimonials: testimonials,
        contact: contacts,
        footer: footers,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
