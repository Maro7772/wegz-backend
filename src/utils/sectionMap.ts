import { Announcement } from "../models/sections/announcement.model.js";
import { Header } from "../models/sections/header.model.js";
import { Hero } from "../models/sections/hero.model.js";
import { Info } from "../models/sections/info.model.js";
import { Info2 } from "../models/sections/info2.model.js";
import { Testimonials } from "../models/sections/testimonials.model.js";
import { Contact } from "../models/sections/contact.model.js";
import { Footer } from "../models/sections/footer.model.js";

export const sectionMap = {
  announcement: Announcement,
  header: Header,
  hero: Hero,
  info: Info,
  info2: Info2,
  testimonials: Testimonials,
  contact: Contact,
  footer: Footer,
} as const;

export type SectionType = keyof typeof sectionMap;

export const isValidSection = (type: string): type is SectionType => {
  return type in sectionMap;
};
