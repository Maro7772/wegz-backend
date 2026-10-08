import { Schema, model, Document, Types } from "mongoose";

export interface IInfoItem {
  _id?: Types.ObjectId;
  icon: string;
  title: string;
  description: string;
  order: number;
}

export interface IInfo extends Document {
  heading: string;
  subheading: string;
  items: IInfoItem[];
  bgColor: string;
  textColor: string;
  isVisible: boolean;
}

const InfoItemSchema = new Schema<IInfoItem>(
  {
    icon: { type: String, default: "" },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const InfoSchema = new Schema<IInfo>(
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

export const Info = model<IInfo>("Info", InfoSchema);
