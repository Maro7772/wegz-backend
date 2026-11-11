import { Schema, Document, Types } from "mongoose";
import { createModelProxy } from "../../config/proxyModel.js";

export interface IHeaderLink {
  _id?: Types.ObjectId;
  label: string;
  url: string;
  isActive: boolean;
  order: number;
}

export interface IHeader extends Document {
  logo: string;
  brandName: string;
  bgColor: string;
  textColor: string;
  isVisible: boolean;
  links: IHeaderLink[];
}

const HeaderLinkSchema = new Schema<IHeaderLink>(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

export const HeaderSchema = new Schema<IHeader>(
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

export const Header = createModelProxy<IHeader>("Header", HeaderSchema);
