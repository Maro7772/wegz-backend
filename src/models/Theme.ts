import { Schema, model, Document } from "mongoose";

export interface ITheme extends Document {
  name: string;
  description: string;
  isActive: boolean;
}

const ThemeSchema = new Schema<ITheme>(
  {
    name: { type: String, required: true, trim: true,unique:true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Theme = model<ITheme>("Theme", ThemeSchema);
