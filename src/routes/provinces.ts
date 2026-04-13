import { Elysia } from "elysia";
import { db } from "../db";
import { provinces } from "../schema";
import { asc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

export const provinceRoutes = new Elysia({ prefix: "/api/provinces" })
  .use(authMiddleware)

  // --------------------------------------------------
  // GET /api/provinces
  // ดึงรายชื่อจังหวัดทั้งหมด เรียงตามชื่อภาษาไทย
  // --------------------------------------------------
  .get("/", async ({ set }) => {
    try {
      const data = await db.query.provinces.findMany({
        orderBy: [asc(provinces.nameTh)],
      });
      return { success: true, data };
    } catch (error: any) {
      set.status = 500;
      return { success: false, message: error.message ?? "เกิดข้อผิดพลาดในการดึงข้อมูลจังหวัด" };
    }
  });
