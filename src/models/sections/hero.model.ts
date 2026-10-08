import { Schema, model, Document } from "mongoose";

export interface IHero extends Document {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl: string;
  ctaColor: string;
  image: string;
  bgColor: string;
  textColor: string;
  isVisible: boolean;
}

const HeroSchema = new Schema<IHero>(
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

export const Hero = model<IHero>("Hero", HeroSchema);
