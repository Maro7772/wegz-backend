import { Schema, model, Document } from "mongoose";

export interface IAnnouncement extends Document {
  text: string;
  bgColor: string;
  textColor: string;
  isVisible: boolean;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    text: { type: String, default: "" },
    bgColor: { type: String, default: "#000000" },
    textColor: { type: String, default: "#ffffff" },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Announcement = model<IAnnouncement>(
  "Announcement",
  AnnouncementSchema,
);
