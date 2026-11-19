import { Request, Response } from "express";
import { Announcement } from "../models/sections/announcement.model.js";
import { Header } from "../models/sections/header.model.js";
import { Hero } from "../models/sections/hero.model.js";
import { Info } from "../models/sections/info.model.js";
import { Info2 } from "../models/sections/info2.model.js";
import { Testimonials } from "../models/sections/testimonials.model.js";
import { Contact } from "../models/sections/contact.model.js";
import { Footer } from "../models/sections/footer.model.js";
import { Theme } from "../models/Theme.js";

// GET /api/admin/dashboard/sections
// بترجّع كل السكاشن بكل النسخ، عشان الداشبورد يعرضها مرة واحدة
export const getAllSections = async (req: Request, res: Response) => {
  try {
    const models = req.tenantModels;
    const AnnouncementModel = (models?.Announcement || Announcement) as any;
    const HeaderModel = (models?.Header || Header) as any;
    const HeroModel = (models?.Hero || Hero) as any;
    const InfoModel = (models?.Info || Info) as any;
    const Info2Model = (models?.Info2 || Info2) as any;
    const TestimonialsModel = (models?.Testimonials || Testimonials) as any;
    const ContactModel = (models?.Contact || Contact) as any;
    const FooterModel = (models?.Footer || Footer) as any;

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
      AnnouncementModel.find().sort({ createdAt: -1 }),
      HeaderModel.find().sort({ createdAt: -1 }),
      HeroModel.find().sort({ createdAt: -1 }),
      InfoModel.find().sort({ createdAt: -1 }),
      Info2Model.find().sort({ createdAt: -1 }),
      TestimonialsModel.find().sort({ createdAt: -1 }),
      ContactModel.find().sort({ createdAt: -1 }),
      FooterModel.find().sort({ createdAt: -1 }),
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

export const getCounts = async (req: Request, res: Response) => {
  try {
    const models = req.tenantModels;
    const AnnouncementModel = (models?.Announcement || Announcement) as any;
    const HeaderModel = (models?.Header || Header) as any;
    const HeroModel = (models?.Hero || Hero) as any;
    const InfoModel = (models?.Info || Info) as any;
    const Info2Model = (models?.Info2 || Info2) as any;
    const TestimonialsModel = (models?.Testimonials || Testimonials) as any;
    const ContactModel = (models?.Contact || Contact) as any;
    const FooterModel = (models?.Footer || Footer) as any;
    const ThemeModel = (models?.Theme || Theme) as any;

    const [
      announcement,
      header,
      hero,
      info,
      info2,
      testimonials,
      contact,
      footer,
      themes,
    ] = await Promise.all([
      AnnouncementModel.countDocuments(),
      HeaderModel.countDocuments(),
      HeroModel.countDocuments(),
      InfoModel.countDocuments(),
      Info2Model.countDocuments(),
      TestimonialsModel.countDocuments(),
      ContactModel.countDocuments(),
      FooterModel.countDocuments(),
      ThemeModel.countDocuments(),
    ]);

    const total =
      announcement +
      header +
      hero +
      info +
      info2 +
      testimonials +
      contact +
      footer;

    res.json({
      data: {
        announcement,
        header,
        hero,
        info,
        info2,
        testimonials,
        contact,
        footer,
        themes,
        total,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
