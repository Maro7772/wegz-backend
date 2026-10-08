import { Request, Response } from "express";
import { Announcement } from "../models/sections/announcement.model.js";
import { Header } from "../models/sections/header.model.js";
import { Hero } from "../models/sections/hero.model.js";
import { Info } from "../models/sections/info.model.js";
import { Info2 } from "../models/sections/info2.model.js";
import { Testimonials } from "../models/sections/testimonials.model.js";
import { Contact } from "../models/sections/contact.model.js";
import { Footer } from "../models/sections/footer.model.js";

export const getLanding = async (_req: Request, res: Response) => {
  try {
    const [
      announcement,
      header,
      hero,
      info,
      info2,
      testimonials,
      contact,
      footer,
    ] = await Promise.all([
      Announcement.findOne({ isVisible: true }).lean(),
      Header.findOne({ isVisible: true }).lean(),
      Hero.findOne({ isVisible: true }).lean(),
      Info.findOne({ isVisible: true }).lean(),
      Info2.findOne({ isVisible: true }).lean(),
      Testimonials.findOne({ isVisible: true }).lean(),
      Contact.findOne({ isVisible: true }).lean(),
      Footer.findOne({ isVisible: true }).lean(),
    ]);

    // نفلتر اللينكات المفعّلة بس جوه الـ header، ومرتبة بالـ order
    const cleanedHeader = header
      ? {
          ...header,
          links: (header.links || [])
            .filter((l: any) => l.isActive)
            .sort((a: any, b: any) => a.order - b.order),
        }
      : null;

    // وكمان الـ footer links + socials مرتبين
    const cleanedFooter = footer
      ? {
          ...footer,
          links: (footer.links || []).sort(
            (a: any, b: any) => a.order - b.order,
          ),
        }
      : null;

    res.json({
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
