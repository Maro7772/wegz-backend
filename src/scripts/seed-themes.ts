import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Theme } from "../models/Theme.js";

const run = async () => {
  await connectDB();

  const themes = [
    { key: "theme1", name: "Theme 1", isActive: true },
    { key: "theme2", name: "Theme 2", isActive: false },
  ];

  for (const t of themes) {
    const exists = await Theme.findOne({ key: t.key });
    if (!exists) {
      await Theme.create(t);
      console.log(`✅ Created ${t.key}`);
    } else {
      console.log(`⚠️ ${t.key} already exists`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
};

run();
