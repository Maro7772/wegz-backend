import { Schema, Document } from "mongoose";
import { createModelProxy } from "../../config/proxyModel.js";

export interface IAnnouncement extends Document {
  text: string;
  bgColor: string;
  textColor: string;
  isVisible: boolean;
}

export const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    text: { type: String, default: "" },
    bgColor: { type: String, default: "#000000" },
    textColor: { type: String, default: "#ffffff" },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Announcement = createModelProxy<IAnnouncement>(
  "Announcement",
  AnnouncementSchema,
);
