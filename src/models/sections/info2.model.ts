import { Schema, model, Document } from "mongoose";

export interface IInfo2 extends Document {
  heading: string;
  paragraph: string;
  image: string;
  imagePosition: "left" | "right";
  bgColor: string;
  textColor: string;
  isVisible: boolean;
}

const Info2Schema = new Schema<IInfo2>(
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

export const Info2 = model<IInfo2>("Info2", Info2Schema);
