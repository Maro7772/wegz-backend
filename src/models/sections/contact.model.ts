import { Schema, model, Document, Types } from "mongoose";

export interface IContactField {
  _id?: Types.ObjectId;
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea";
  required: boolean;
  order: number;
}

export interface IContact extends Document {
  heading: string;
  subheading: string;
  fields: IContactField[];
  submitText: string;
  phone: string;
  email: string;
  address: string;
  bgColor: string;
  textColor: string;
  isVisible: boolean;
}

const ContactFieldSchema = new Schema<IContactField>(
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

const ContactSchema = new Schema<IContact>(
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

export const Contact = model<IContact>("Contact", ContactSchema);
