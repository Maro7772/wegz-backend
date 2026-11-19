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
import { getMasterThemeModel } from "../config/tenant.js";

export const getLanding = async (req: Request, res: Response) => {
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
      activeThemeDoc,
    ] = await Promise.all([
      AnnouncementModel.findOne({ isVisible: true }).sort({ createdAt: -1 }).lean(),
      HeaderModel.findOne({ isVisible: true }).sort({ createdAt: -1 }).lean(),
      HeroModel.findOne({ isVisible: true }).sort({ createdAt: -1 }).lean(),
      InfoModel.findOne({ isVisible: true }).sort({ createdAt: -1 }).lean(),
      Info2Model.findOne({ isVisible: true }).sort({ createdAt: -1 }).lean(),
      TestimonialsModel.findOne({ isVisible: true }).sort({ createdAt: -1 }).lean(),
      ContactModel.findOne({ isVisible: true }).sort({ createdAt: -1 }).lean(),
      FooterModel.findOne({ isVisible: true }).sort({ createdAt: -1 }).lean(),
      ThemeModel.findOne({ isActive: true }).lean(),
    ]);

    let activeTheme = activeThemeDoc;
    if (!activeTheme) {
      activeTheme = await ThemeModel.findOne().lean();
    }

    let themeName = activeTheme?.name;
    let themeMode = activeTheme?.activeMode || "light";

    if (!themeName) {
      try {
        const MasterTheme = await getMasterThemeModel();
        const defaultMasterTheme = await MasterTheme.findOne({
          status: { $ne: "inactive" },
        })
          .sort({ order: 1, createdAt: 1 })
          .lean();
        if (defaultMasterTheme) {
          themeName = defaultMasterTheme.name;
          themeMode = defaultMasterTheme.defaultMode || "light";
        }
      } catch {
        // Fallback
      }
    }

    // نفلتر اللينكات المفعّلة بس جوه الـ header، ومرتبة بالـ order
    const cleanedHeader = header
      ? {
          ...header,
          links: (header.links || [])
            .filter((l: any) => l.isActive)
            .sort((a: any, b: any) => a.order - b.order),
        }
      : null;

    // وكمان الـ footer links مرتبين بالـ order
    const cleanedFooter = footer
      ? {
          ...footer,
          links: (footer.links || []).sort(
            (a: any, b: any) => a.order - b.order,
          ),
        }
      : null;

    res.json({
      theme: themeName || "Theme 1",
      mode: themeMode,
      sections: {
        announcement,
        header: cleanedHeader,
        hero,
        info,
        info2,
        testimonials,
        contact,
        footer: cleanedFooter,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
