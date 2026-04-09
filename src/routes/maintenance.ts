import { Elysia, t } from "elysia";
import { db } from "../db";
import { announcements, users } from "../schema";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import mysql from "mysql2/promise";

// =============================================
// Maintenance Routes
// =============================================
export const maintenanceRoutes = new Elysia({ prefix: "/api/maintenance" })
  .use(authMiddleware)

  // --------------------------------------------------
  // GET /api/maintenance/db-status
  // ตรวจสอบสถานะการเชื่อมต่อ Database
  // --------------------------------------------------
  .get("/db-status", async ({ set }) => {
    try {
      const pool = mysql.createPool({
        host: process.env.DATABASE_HOST,
        port: Number(process.env.DATABASE_PORT),
        database: process.env.DATABASE_NAME,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        connectTimeout: 5000,
      });

      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      await pool.end();

      return {
        success: true,
        connected: true,
        host: process.env.DATABASE_HOST,
        port: Number(process.env.DATABASE_PORT),
        database: process.env.DATABASE_NAME,
        checkedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      set.status = 200; // ส่ง 200 แต่ connected = false
      return {
        success: true,
        connected: false,
        error: err.message ?? "Connection failed",
        checkedAt: new Date().toISOString(),
      };
    }
  })

  // --------------------------------------------------
  // GET /api/maintenance/db-tables
  // แสดงจำนวนและรายชื่อตารางใน Database
  // --------------------------------------------------
  .get("/db-tables", async ({ auth, set }) => {
    if (auth.role !== "super_admin") {
      set.status = 403;
      return { success: false, message: "เฉพาะ super_admin เท่านั้น" };
    }

    try {
      const pool = mysql.createPool({
        host: process.env.DATABASE_HOST,
        port: Number(process.env.DATABASE_PORT),
        database: process.env.DATABASE_NAME,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
      });

      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT TABLE_NAME as tableName,
                TABLE_ROWS as rowCount,
                ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 2) as sizeKB,
                CREATE_TIME as createdAt
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME`,
        [process.env.DATABASE_NAME]
      );

      await pool.end();

      return {
        success: true,
        count: rows.length,
        tables: rows,
      };
    } catch (err: any) {
      set.status = 500;
      return { success: false, message: err.message };
    }
  })

  // --------------------------------------------------
  // GET /api/maintenance/announcements
  // ดูรายการประกาศทั้งหมด (เฉพาะ active)
  // --------------------------------------------------
  .get("/announcements", async () => {
    const data = await db.query.announcements.findMany({
      where: eq(announcements.isActive, true),
      orderBy: [desc(announcements.isPinned), desc(announcements.createdAt)],
    });
    return { success: true, data };
  })

  // --------------------------------------------------
  // GET /api/maintenance/announcements/all
  // ดูรายการประกาศทั้งหมด (รวม inactive) เฉพาะ admin
  // --------------------------------------------------
  .get("/announcements/all", async ({ auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์เข้าถึง" };
    }
    const data = await db.query.announcements.findMany({
      orderBy: [desc(announcements.isPinned), desc(announcements.createdAt)],
    });
    return { success: true, data };
  })

  // --------------------------------------------------
  // POST /api/maintenance/announcements
  // สร้างประกาศใหม่
  // --------------------------------------------------
  .post(
    "/announcements",
    async ({ body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์สร้างประกาศ" };
      }

      const [inserted] = await db.insert(announcements).values({
        title: body.title,
        content: body.content,
        type: body.type ?? "info",
        isPinned: body.isPinned ?? false,
        isActive: true,
        createdBy: auth.user?.id ?? null,
        updatedBy: auth.user?.id ?? null,
      }).returning({ id: announcements.id });

      return { success: true, message: "สร้างประกาศสำเร็จ", id: inserted.id };
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        content: t.String({ minLength: 1 }),
        type: t.Optional(t.Union([
          t.Literal("info"),
          t.Literal("warning"),
          t.Literal("success"),
          t.Literal("danger"),
        ])),
        isPinned: t.Optional(t.Boolean()),
      }),
    }
  )

  // --------------------------------------------------
  // PATCH /api/maintenance/announcements/:id
  // แก้ไขประกาศ
  // --------------------------------------------------
  .patch(
    "/announcements/:id",
    async ({ params, body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์แก้ไขประกาศ" };
      }

      await db
        .update(announcements)
        .set({ ...body, updatedBy: auth.user?.id ?? null })
        .where(eq(announcements.id, Number(params.id)));

      return { success: true, message: "แก้ไขประกาศสำเร็จ" };
    },
    {
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        content: t.Optional(t.String()),
        type: t.Optional(t.Union([
          t.Literal("info"),
          t.Literal("warning"),
          t.Literal("success"),
          t.Literal("danger"),
        ])),
        isPinned: t.Optional(t.Boolean()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )

  // --------------------------------------------------
  // DELETE /api/maintenance/announcements/:id
  // ลบประกาศ (soft delete)
  // --------------------------------------------------
  .delete("/announcements/:id", async ({ params, auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์ลบประกาศ" };
    }

    await db
      .update(announcements)
      .set({ isActive: false, updatedBy: auth.user?.id ?? null })
      .where(eq(announcements.id, Number(params.id)));

    return { success: true, message: "ลบประกาศสำเร็จ" };
  });
