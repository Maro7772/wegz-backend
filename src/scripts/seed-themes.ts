import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Theme, AVAILABLE_MODES, type ModeKey } from "../models/Theme.js";

const run = async () => {
  await connectDB();

  const themes: Array<{
    name: string;
    isActive: boolean;
    availableModes: ModeKey[];
    activeMode: ModeKey;
  }> = [
    {
      name: "Theme 1",
      isActive: true,
      availableModes: ["dark", "light"],
      activeMode: "light",
    },
    {
      name: "Theme 2",
      isActive: false,
      availableModes: ["dark", "light"],
      activeMode: "light",
    },
  ];

  for (const t of themes) {
    const exists = await Theme.findOne({ name: t.name });
    if (!exists) {
      await Theme.create(t);
      console.log(`✅ Created ${t.name}`);
    } else {
      console.log(`⚠️ ${t.name} already exists`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
};

run();
