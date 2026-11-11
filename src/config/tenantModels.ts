/**
 * Wildcard Multi-Tenancy — Tenant Model Factory
 *
 * بدل ما كل model يتسجل على الـ default connection (mongoose.model)،
 * هنا بنسجل الـ schemas على الـ tenant connection ونحطها على req.models.
 *
 * كده كل request بيشتغل على الـ DB الصح بدون ما الـ controllers يعرفوا.
 *
 * ⚠️ الـ Schemas هنا **مطابقة بالظبط** للـ models الأصلية في src/models/
 *    عشان الداتا الموجودة فعلاً في الـ tenant DBs تشتغل بدون مشاكل.
 */
import mongoose from "mongoose";
import type { Connection, Model } from "mongoose";

const { Schema } = mongoose;

// ════════════════════════════════════════════════════════════════════════════
// User
// ════════════════════════════════════════════════════════════════════════════
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "admin" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ════════════════════════════════════════════════════════════════════════════
// Theme
// ════════════════════════════════════════════════════════════════════════════
export const AVAILABLE_MODES = ["dark", "light"] as const;

const ThemeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: false },
    activeMode: { type: String, enum: AVAILABLE_MODES, default: "light" },
    availableModes: {
      type: [String],
      enum: AVAILABLE_MODES,
      default: ["dark", "light"],
    },
  },
  { timestamps: true },
);

// ════════════════════════════════════════════════════════════════════════════
// Section Schemas — مطابقة بالظبط للأصلية
// ════════════════════════════════════════════════════════════════════════════

// ── Announcement ───────────────────────────────────────────────────────────
const AnnouncementSchema = new Schema(
  {
    text: { type: String, default: "" },
    bgColor: { type: String, default: "#000000" },
    textColor: { type: String, default: "#ffffff" },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ── Header ─────────────────────────────────────────────────────────────────
const HeaderLinkSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const HeaderSchema = new Schema(
  {
    logo: { type: String, default: "" },
    brandName: { type: String, default: "" },
    bgColor: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#000000" },
    isVisible: { type: Boolean, default: true },
    links: { type: [HeaderLinkSchema], default: [] },
  },
  { timestamps: true },
);

// ── Hero ───────────────────────────────────────────────────────────────────
const HeroSchema = new Schema(
  {
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    ctaText: { type: String, default: "" },
    ctaUrl: { type: String, default: "" },
    ctaColor: { type: String, default: "#000000" },
    image: { type: String, default: "" },
    bgColor: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#000000" },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ── Info ───────────────────────────────────────────────────────────────────
const InfoItemSchema = new Schema(
  {
    icon: { type: String, default: "" },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const InfoSchema = new Schema(
  {
    heading: { type: String, default: "" },
    subheading: { type: String, default: "" },
    items: { type: [InfoItemSchema], default: [] },
    bgColor: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#000000" },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ── Info2 ──────────────────────────────────────────────────────────────────
const Info2Schema = new Schema(
  {
    heading: { type: String, default: "" },
    paragraph: { type: String, default: "" },
    image: { type: String, default: "" },
    imagePosition: { type: String, enum: ["left", "right"], default: "right" },
    bgColor: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#000000" },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ── Testimonials ───────────────────────────────────────────────────────────
const TestimonialItemSchema = new Schema(
  {
    name: { type: String, default: "" },
    role: { type: String, default: "" },
    avatar: { type: String, default: "" },
    message: { type: String, default: "" },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const TestimonialsSchema = new Schema(
  {
    heading: { type: String, default: "" },
    subheading: { type: String, default: "" },
    items: { type: [TestimonialItemSchema], default: [] },
    bgColor: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#000000" },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ── Contact ────────────────────────────────────────────────────────────────
const ContactFieldSchema = new Schema(
  {
    name: { type: String, required: true },
    label: { type: String, default: "" },
    type: {
      type: String,
      enum: ["text", "email", "tel", "textarea"],
      default: "text",
    },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const ContactSchema = new Schema(
  {
    heading: { type: String, default: "" },
    subheading: { type: String, default: "" },
    fields: { type: [ContactFieldSchema], default: [] },
    submitText: { type: String, default: "Send" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    bgColor: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#000000" },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ── Footer ─────────────────────────────────────────────────────────────────
const FooterLinkSchema = new Schema(
  {
    label: { type: String, default: "" },
    url: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const FooterSocialSchema = new Schema(
  {
    platform: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  { _id: true },
);

const FooterSchema = new Schema(
  {
    brandName: { type: String, default: "" },
    logo: { type: String, default: "" },
    description: { type: String, default: "" },
    links: { type: [FooterLinkSchema], default: [] },
    socials: { type: [FooterSocialSchema], default: [] },
    copyright: { type: String, default: "" },
    bgColor: { type: String, default: "#111111" },
    textColor: { type: String, default: "#ffffff" },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ════════════════════════════════════════════════════════════════════════════
// Tenant Models Interface
// ════════════════════════════════════════════════════════════════════════════

export interface TenantModels {
  User: Model<any>;
  Theme: Model<any>;
  Announcement: Model<any>;
  Header: Model<any>;
  Hero: Model<any>;
  Info: Model<any>;
  Info2: Model<any>;
  Testimonials: Model<any>;
  Contact: Model<any>;
  Footer: Model<any>;
}

// ════════════════════════════════════════════════════════════════════════════
// Section Map
// ════════════════════════════════════════════════════════════════════════════

export type SectionType =
  | "announcement"
  | "header"
  | "hero"
  | "info"
  | "info2"
  | "testimonials"
  | "contact"
  | "footer";

export function isValidSection(type: string): type is SectionType {
  return [
    "announcement",
    "header",
    "hero",
    "info",
    "info2",
    "testimonials",
    "contact",
    "footer",
  ].includes(type);
}

// ════════════════════════════════════════════════════════════════════════════
// Build Models
// ════════════════════════════════════════════════════════════════════════════

/**
 * يسجل كل الـ schemas على الـ tenant connection ويرجع object بالـ models.
 * لو الـ model اتسجل قبل كده على نفس الـ connection، mongoose بيرجع نفس الـ instance.
 */
export function buildTenantModels(conn: Connection): TenantModels {
  return {
    User: getOrCreate(conn, "User", UserSchema),
    Theme: getOrCreate(conn, "Theme", ThemeSchema),
    Announcement: getOrCreate(conn, "Announcement", AnnouncementSchema),
    Header: getOrCreate(conn, "Header", HeaderSchema),
    Hero: getOrCreate(conn, "Hero", HeroSchema),
    Info: getOrCreate(conn, "Info", InfoSchema),
    Info2: getOrCreate(conn, "Info2", Info2Schema),
    Testimonials: getOrCreate(conn, "Testimonials", TestimonialsSchema),
    Contact: getOrCreate(conn, "Contact", ContactSchema),
    Footer: getOrCreate(conn, "Footer", FooterSchema),
  };
}

function getOrCreate(
  conn: Connection,
  name: string,
  schema: mongoose.Schema,
): Model<any> {
  return conn.models[name] || conn.model(name, schema);
}

/**
 * يبني section map من الـ tenant models.
 */
export function buildSectionMap(
  models: TenantModels,
): Record<SectionType, Model<any>> {
  return {
    announcement: models.Announcement,
    header: models.Header,
    hero: models.Hero,
    info: models.Info,
    info2: models.Info2,
    testimonials: models.Testimonials,
    contact: models.Contact,
    footer: models.Footer,
  };
}
