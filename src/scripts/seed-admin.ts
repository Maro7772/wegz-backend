import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";

const run = async () => {
  await connectDB();

  const adminData = {
    name: "Admin",
    username: "admin",
    email: "admin@gmail.com",
    phone: "01000000000",
    password: "123456",
    role: "admin" as const,
    isActive: true,
  };

  const existing = await User.findOne({ email: adminData.email });

  if (existing) {
    console.log("⚠️ Admin already exists");
  } else {
    await User.create(adminData);
    console.log("✅ Admin created:", adminData.email, "/", adminData.password);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run();
