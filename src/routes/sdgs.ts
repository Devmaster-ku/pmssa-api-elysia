import { Elysia } from "elysia";
import { db } from "../db";
import { sdgs } from "../schema";
import { isNull, eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

export const sdgRoutes = new Elysia({ prefix: "/api/sdgs" })
  .use(authMiddleware)

  // --------------------------------------------------
  // GET /api/sdgs
  // ดึง SDGs ทั้งหมด (แบบ flat) พร้อม parent info
  // --------------------------------------------------
  .get("/", async ({ set }) => {
    try {
      const allSdgs = await db.query.sdgs.findMany({
        orderBy: (sdgs, { asc }) => [asc(sdgs.id)],
      });
      return { success: true, data: allSdgs };
    } catch (error: any) {
      set.status = 500;
      return { success: false, message: error.message ?? "เกิดข้อผิดพลาด" };
    }
  })

  // --------------------------------------------------
  // GET /api/sdgs/top-level
  // ดึงเฉพาะ SDGs ระดับบน (17 เป้าหมายหลัก)
  // --------------------------------------------------
  .get("/top-level", async ({ set }) => {
    try {
      const topLevel = await db.query.sdgs.findMany({
        where: isNull(sdgs.parentId),
        orderBy: (sdgs, { asc }) => [asc(sdgs.id)],
        with: { children: true },
      });
      return { success: true, data: topLevel };
    } catch (error: any) {
      set.status = 500;
      return { success: false, message: error.message ?? "เกิดข้อผิดพลาด" };
    }
  })

  // --------------------------------------------------
  // GET /api/sdgs/:id
  // ดึง SDG เดี่ยว พร้อม children
  // --------------------------------------------------
  .get("/:id", async ({ params, set }) => {
    try {
      const sdg = await db.query.sdgs.findFirst({
        where: eq(sdgs.id, Number(params.id)),
        with: { children: true },
      });
      if (!sdg) {
        set.status = 404;
        return { success: false, message: "ไม่พบ SDG" };
      }
      return { success: true, data: sdg };
    } catch (error: any) {
      set.status = 500;
      return { success: false, message: error.message ?? "เกิดข้อผิดพลาด" };
    }
  });
