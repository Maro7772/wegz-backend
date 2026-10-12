import { Schema, model, Document } from "mongoose";

export const AVAILABLE_MODES = ["dark", "light"] as const;
export type ModeKey = (typeof AVAILABLE_MODES)[number];

export interface ITheme extends Document {
  name: string;
  description: string;
  isActive: boolean;
  activeMode: ModeKey; // ← الوضع الحالي
  availableModes: ModeKey[]; // ← المتاحين للثيم
}

const ThemeSchema = new Schema<ITheme>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: false },
    activeMode: { type: String, enum: AVAILABLE_MODES, default: "light" },
    availableModes: {
      type: [String],
      enum: AVAILABLE_MODES,
      default: ["dark", "light"],
    },
  },
  { timestamps: true },
);

export const Theme = model<ITheme>("Theme", ThemeSchema);
