import { Schema, model, Document, Types } from "mongoose";

export interface ITestimonialItem {
  _id?: Types.ObjectId;
  name: string;
  role: string;
  avatar: string;
  message: string;
  rating: number;
  order: number;
}

export interface ITestimonials extends Document {
  heading: string;
  subheading: string;
  items: ITestimonialItem[];
  bgColor: string;
  textColor: string;
  isVisible: boolean;
}

const TestimonialItemSchema = new Schema<ITestimonialItem>(
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

const TestimonialsSchema = new Schema<ITestimonials>(
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

export const Testimonials = model<ITestimonials>(
  "Testimonials",
  TestimonialsSchema,
);
