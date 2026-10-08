import { Schema, model, Document } from "mongoose";

export interface ITheme extends Document {
  key: string;
  name: string;
  description: string;
  isActive: boolean;
}

const ThemeSchema = new Schema<ITheme>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Theme = model<ITheme>("Theme", ThemeSchema);
