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
import { sendContactEmail } from "../services/mail.service.js";

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

export const sendContactMessage = async (req: Request, res: Response) => {
  try {
    const models = req.tenantModels;
    const ContactModel = (models?.Contact || Contact) as any;

    // البحث عن إيميل التواصل المخصص لهذا المتجر من سكشن contact
    let contact = await ContactModel.findOne({ isVisible: true }).sort({ createdAt: -1 }).lean();
    if (!contact || !contact.email) {
      contact = await ContactModel.findOne({ email: { $exists: true, $ne: "" } }).sort({ createdAt: -1 }).lean();
    }

    const recipientEmail = contact?.email?.trim();
    if (!recipientEmail) {
      return res.status(404).json({
        success: false,
        message: "No recipient email configured in the landing contact section",
      });
    }

    // استلام الرسالة بالكامل من الـ API
    const body = req.body || {};
    const message = body.message ?? body.msg ?? body.text;

    if (!message || (typeof message === "string" && !message.trim())) {
      return res.status(400).json({
        success: false,
        message: "message is required",
      });
    }

    const finalMessage = typeof message === "string" ? message.trim() : String(message);

    const tenantSubdomain = req.tenant?.subdomain;
    const hostHeader = req.headers.host ? req.headers.host.split(":")[0] : undefined;
    const tenantIdentifier = tenantSubdomain ? `${tenantSubdomain}.wegz.org` : hostHeader;

    // إرسال الإيميل بتصميم نظيف واحترافي
    await sendContactEmail({
      to: recipientEmail,
      message: finalMessage,
      replyTo: typeof body.email === "string" && body.email.trim() ? body.email.trim() : undefined,
      subject:
        typeof body.subject === "string" && body.subject.trim()
          ? body.subject.trim()
          : `New Message from ${tenantIdentifier || "Landing Page"}`,
      senderName: typeof body.name === "string" ? body.name.trim() : undefined,
      senderEmail: typeof body.email === "string" ? body.email.trim() : undefined,
      phone: typeof body.phone === "string" ? body.phone.trim() : undefined,
      extraFields: body,
      tenant: tenantIdentifier,
    });

    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
    });
  } catch (err: any) {
    console.error("Error sending contact message:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: err.message,
    });
  }
};
