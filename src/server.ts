import express from "express";
import cors from "cors";
import path from "path";
import "dotenv/config";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import sectionRoutes from "./routes/section.routes.js";
import publicRoutes from "./routes/public.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

const app = express();
app.use(cors());
app.use(express.json());
// serve uploads statically
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/sections", sectionRoutes);
app.use("/api/admin/upload", uploadRoutes);
app.use("/api/public", publicRoutes);

const PORT = process.env.PORT || 3000;
const start = async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`🚀 API on http://localhost:${PORT}`));
};

start();
