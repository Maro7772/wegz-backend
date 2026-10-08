import { Schema, model, Document, Types } from "mongoose";

export interface IFooterLink {
  _id?: Types.ObjectId;
  label: string;
  url: string;
  order: number;
}

export interface IFooterSocial {
  _id?: Types.ObjectId;
  platform: string;
  url: string;
}

export interface IFooter extends Document {
  brandName: string;
  logo: string;
  description: string;
  links: IFooterLink[];
  socials: IFooterSocial[];
  copyright: string;
  bgColor: string;
  textColor: string;
  isVisible: boolean;
}

const FooterLinkSchema = new Schema<IFooterLink>(
  {
    label: { type: String, default: "" },
    url: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const FooterSocialSchema = new Schema<IFooterSocial>(
  {
    platform: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  { _id: true },
);

const FooterSchema = new Schema<IFooter>(
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

export const Footer = model<IFooter>("Footer", FooterSchema);
