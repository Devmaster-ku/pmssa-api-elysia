import { Elysia, t } from "elysia";
import { db } from "../db";
import { withCache, invalidate } from "../lib/cache";
import {
  organizations,
  campus,
  users,
  userAffiliations,
  budgetSubsidies,
  budgetSubsidyTypes,
  budgetGroups,
  budgetExpenseDetails,
  rolePermissions,
} from "../schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

// =============================================
// สิทธิ์ทั้งหมดในระบบ (static — กำหนดโดยนักพัฒนา)
// =============================================
const SYSTEM_PERMISSIONS = [
  // โครงการ
  {
    module: "project",
    moduleTh: "โครงการ",
    code: "project.view",
    nameTh: "ดูโครงการ",
    sortOrder: 10,
  },
  {
    module: "project",
    moduleTh: "โครงการ",
    code: "project.create",
    nameTh: "สร้างโครงการ",
    sortOrder: 20,
  },
  {
    module: "project",
    moduleTh: "โครงการ",
    code: "project.edit",
    nameTh: "แก้ไขโครงการ",
    sortOrder: 30,
  },
  {
    module: "project",
    moduleTh: "โครงการ",
    code: "project.delete",
    nameTh: "ลบโครงการ",
    sortOrder: 40,
  },
  {
    module: "project",
    moduleTh: "โครงการ",
    code: "project.submit",
    nameTh: "ส่งอนุมัติโครงการ",
    sortOrder: 50,
  },
  {
    module: "project",
    moduleTh: "โครงการ",
    code: "project.approve",
    nameTh: "อนุมัติ/ปฏิเสธโครงการ",
    sortOrder: 60,
  },
  // งบประมาณ
  {
    module: "budget",
    moduleTh: "งบประมาณ",
    code: "budget.view",
    nameTh: "ดูงบประมาณ",
    sortOrder: 70,
  },
  {
    module: "budget",
    moduleTh: "งบประมาณ",
    code: "budget.manage",
    nameTh: "จัดการงบประมาณ",
    sortOrder: 80,
  },
  {
    module: "budget",
    moduleTh: "งบประมาณ",
    code: "budget.approve",
    nameTh: "อนุมัติงบประมาณ",
    sortOrder: 90,
  },
  // รายงาน
  {
    module: "report",
    moduleTh: "รายงาน",
    code: "report.view",
    nameTh: "ดูรายงาน",
    sortOrder: 100,
  },
  {
    module: "report",
    moduleTh: "รายงาน",
    code: "report.export",
    nameTh: "ส่งออกรายงาน",
    sortOrder: 110,
  },
  // ยุทธศาสตร์
  {
    module: "strategy",
    moduleTh: "ยุทธศาสตร์",
    code: "strategy.view",
    nameTh: "ดูยุทธศาสตร์",
    sortOrder: 120,
  },
  {
    module: "strategy",
    moduleTh: "ยุทธศาสตร์",
    code: "strategy.manage",
    nameTh: "จัดการยุทธศาสตร์",
    sortOrder: 130,
  },
  // ผู้ใช้งาน
  {
    module: "user",
    moduleTh: "ผู้ใช้งาน",
    code: "user.view",
    nameTh: "ดูผู้ใช้งาน",
    sortOrder: 140,
  },
  {
    module: "user",
    moduleTh: "ผู้ใช้งาน",
    code: "user.manage",
    nameTh: "จัดการผู้ใช้งาน",
    sortOrder: 150,
  },
  // ตั้งค่าระบบ
  {
    module: "settings",
    moduleTh: "ตั้งค่าระบบ",
    code: "settings.view",
    nameTh: "ดูการตั้งค่า",
    sortOrder: 160,
  },
  {
    module: "settings",
    moduleTh: "ตั้งค่าระบบ",
    code: "settings.manage",
    nameTh: "จัดการการตั้งค่า",
    sortOrder: 170,
  },
  {
    module: "settings",
    moduleTh: "ตั้งค่าระบบ",
    code: "settings.org",
    nameTh: "ตั้งค่าหน่วยงาน",
    sortOrder: 175,
  },
  {
    module: "settings",
    moduleTh: "ตั้งค่าระบบ",
    code: "settings.budget",
    nameTh: "ตั้งค่าหมวดการใช้เงิน",
    sortOrder: 180,
  },
] as const;

const ALL_ROLES = [
  "super_admin",
  "org_admin",
  "univ_executive",
  "univ_officer",
  "campus_executive",
  "campus_officer",
  "faculty_executive",
  "unit_head",
  "project_lead",
  "staff",
] as const;

// =============================================
// ตรวจสอบสิทธิ์จาก DB
// super_admin ผ่านเสมอ, role อื่น query จาก role_permissions
// =============================================
async function hasPermission(
  role: string | null,
  permissionCode: string,
): Promise<boolean> {
  if (!role) return false;
  if (role === "super_admin") return true;

  const record = await db.query.rolePermissions.findFirst({
    where: and(
      eq(rolePermissions.role, role as any),
      eq(rolePermissions.permissionCode, permissionCode),
      eq(rolePermissions.granted, true),
    ),
  });

  return !!record;
}

// =============================================
// Settings Routes — /api/settings
// เฉพาะ super_admin และ org_admin เท่านั้น
// =============================================
export const settingsRoutes = new Elysia({ prefix: "/api/settings" })
  .use(authMiddleware)

  // -----------------------------------------------
  // GET /api/settings/users/all — ดึง users ทั้งหมด (super_admin)
  // -----------------------------------------------
  .get("/users/all", async ({ auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์เข้าถึง" };
    }

    const allUsers = await db.query.users.findMany({
      where: eq(users.isActive, true),
    });

    const data = allUsers.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      nameTh: u.nameTh,
      nameEn: u.nameEn,
      isActive: u.isActive,
    }));

    return { success: true, data, total: data.length };
  })

  // -----------------------------------------------
  // GET /api/settings/organizations/all — ดึงทุกหน่วยงาน ไม่กรอง scope
  // -----------------------------------------------
  .get("/organizations/all", async ({ auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์เข้าถึง" };
    }

    const allOrgs = await db.query.organizations.findMany({
      orderBy: (orgs, { asc }) => [asc(orgs.orgLevel), asc(orgs.id)],
    });

    const data = allOrgs.map((org) => ({
      id: org.id,
      code: org.code,
      nameTh: org.nameTh,
      nameEn: org.nameEn,
      orgLevel: org.orgLevel,
      parentId: org.parentId,
      campusId: org.campusId,
      isActive: org.isActive,
    }));

    return { success: true, data, total: data.length };
  })

  // -----------------------------------------------
  // POST /api/settings/organizations — สร้างหน่วยงานใหม่
  // -----------------------------------------------
  .post(
    "/organizations",
    async ({ body, auth, set }) => {
      if (!(await hasPermission(auth.role, "settings.org"))) {
        set.status = 403;
        return {
          success: false,
          message: "ไม่มีสิทธิ์ดำเนินการ (ต้องมีสิทธิ์ตั้งค่าหน่วยงาน)",
        };
      }

      const [inserted] = await db
        .insert(organizations)
        .values({
          code: body.code,
          nameTh: body.nameTh,
          nameEn: body.nameEn ?? null,
          orgLevel: body.orgLevel as any,
          parentId: body.parentId ?? null,
          campusId: body.campusId ?? null,
          isActive: true,
          createdBy: auth.user?.id ?? null,
        })
        .returning({ id: organizations.id });

      return {
        success: true,
        message: "เพิ่มหน่วยงานสำเร็จ",
        id: inserted.id,
      };
    },
    {
      body: t.Object({
        code: t.String(),
        nameTh: t.String(),
        nameEn: t.Optional(t.String()),
        orgLevel: t.String(),
        parentId: t.Optional(t.Number()),
        campusId: t.Optional(t.Number()),
      }),
    },
  )

  // -----------------------------------------------
  // PUT /api/settings/organizations/:id — แก้ไขหน่วยงาน
  // -----------------------------------------------
  .put(
    "/organizations/:id",
    async ({ params, body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, Number(params.id)),
      });

      if (!org) {
        set.status = 404;
        return { success: false, message: "ไม่พบหน่วยงาน" };
      }

      await db
        .update(organizations)
        .set({
          code: body.code,
          nameTh: body.nameTh,
          nameEn: body.nameEn ?? null,
          orgLevel: body.orgLevel as any,
          parentId: body.parentId ?? null,
          campusId: body.campusId ?? null,
          isActive: body.isActive ?? org.isActive,
          updatedBy: auth.user?.id ?? null,
        })
        .where(eq(organizations.id, Number(params.id)));

      return { success: true, message: "แก้ไขหน่วยงานสำเร็จ" };
    },
    {
      body: t.Object({
        code: t.String(),
        nameTh: t.String(),
        nameEn: t.Optional(t.String()),
        orgLevel: t.String(),
        parentId: t.Optional(t.Number()),
        campusId: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )

  // -----------------------------------------------
  // GET /api/settings/campus — ดึงรายการวิทยาเขตทั้งหมด
  // -----------------------------------------------
  .get("/campus", async () => {
    console.log("[DEBUG] /api/settings/campus endpoint called");
    try {
      const campusList = await db.query.campus.findMany({
        where: eq(campus.isActive, true),
        orderBy: (c, { asc }) => [asc(c.id)],
      });
      console.log("[DEBUG] Campus query result:", campusList.length, "items");
      const response = {
        success: true,
        data: campusList.map((c) => ({
          id: c.id,
          nameTh: c.nameTh,
          nameEn: c.nameEn,
        })),
      };
      console.log("[DEBUG] Campus response:", response);
      return response;
    } catch (error) {
      console.error("[ERROR] Campus query failed:", error);
      return {
        success: false,
        error: String(error),
      };
    }
  })

  // -----------------------------------------------
  // DELETE /api/settings/organizations/:id — ลบหน่วยงาน (soft delete)
  // -----------------------------------------------
  .delete("/organizations/:id", async ({ params, auth, set }) => {
    if (auth.role !== "super_admin") {
      set.status = 403;
      return { success: false, message: "เฉพาะ super_admin เท่านั้น" };
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, Number(params.id)),
    });

    if (!org) {
      set.status = 404;
      return { success: false, message: "ไม่พบหน่วยงาน" };
    }

    await db
      .update(organizations)
      .set({ isActive: false, updatedBy: auth.user?.id ?? null })
      .where(eq(organizations.id, Number(params.id)));

    return { success: true, message: "ลบหน่วยงานสำเร็จ" };
  })

  // =============================================
  // Budget Subsidies — งบอุดหนุน
  // =============================================
  .get("/budget-subsidies", async ({ auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์เข้าถึง" };
    }

    const data = await db.query.budgetSubsidies.findMany({
      orderBy: (t, { asc }) => [asc(t.code)],
    });
    return { success: true, data };
  })

  .post(
    "/budget-subsidies",
    async ({ body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      const [inserted] = await db
        .insert(budgetSubsidies)
        .values({
          code: body.code,
          nameTh: body.nameTh,
          nameEn: body.nameEn ?? null,
          isActive: true,
          createdBy: auth.user?.id ?? null,
        })
        .returning({ id: budgetSubsidies.id });

      await invalidate("settings:budget-subsidies");
      await invalidate("settings:budget-subsidy-types");
      return {
        success: true,
        message: "เพิ่มงบอุดหนุนสำเร็จ",
        id: inserted.id,
      };
    },
    {
      body: t.Object({
        code: t.String(),
        nameTh: t.String(),
        nameEn: t.Optional(t.String()),
      }),
    },
  )

  .put(
    "/budget-subsidies/:id",
    async ({ params, body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      const item = await db.query.budgetSubsidies.findFirst({
        where: eq(budgetSubsidies.id, Number(params.id)),
      });
      if (!item) {
        set.status = 404;
        return { success: false, message: "ไม่พบข้อมูล" };
      }

      await db
        .update(budgetSubsidies)
        .set({
          code: body.code,
          nameTh: body.nameTh,
          nameEn: body.nameEn ?? null,
          isActive: body.isActive ?? item.isActive,
          updatedBy: auth.user?.id ?? null,
        })
        .where(eq(budgetSubsidies.id, Number(params.id)));

      await invalidate("settings:budget-subsidies");
      await invalidate("settings:budget-subsidy-types");
      return { success: true, message: "แก้ไขงบอุดหนุนสำเร็จ" };
    },
    {
      body: t.Object({
        code: t.String(),
        nameTh: t.String(),
        nameEn: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )

  .delete("/budget-subsidies/:id", async ({ params, auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
    }

    const item = await db.query.budgetSubsidies.findFirst({
      where: eq(budgetSubsidies.id, Number(params.id)),
    });
    if (!item) {
      set.status = 404;
      return { success: false, message: "ไม่พบข้อมูล" };
    }

    try {
      await db
        .delete(budgetSubsidies)
        .where(eq(budgetSubsidies.id, Number(params.id)));
    } catch {
      set.status = 409;
      return {
        success: false,
        message: "ไม่สามารถลบได้ เนื่องจากมีประเภทงบอุดหนุนที่อ้างอิงอยู่",
      };
    }
    await invalidate("settings:budget-subsidies");
    await invalidate("settings:budget-subsidy-types");
    return { success: true, message: "ลบงบอุดหนุนสำเร็จ" };
  })

  // =============================================
  // Budget Subsidy Types — ประเภทงบอุดหนุน
  // =============================================
  .get("/budget-subsidy-types", async ({ auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์เข้าถึง" };
    }

    const data = await db.query.budgetSubsidyTypes.findMany({
      with: { subsidy: true },
      orderBy: (t, { asc }) => [asc(t.id)],
    });
    return { success: true, data };
  })

  .post(
    "/budget-subsidy-types",
    async ({ body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      try {
        const [inserted] = await db
          .insert(budgetSubsidyTypes)
          .values({
            subsidyId: body.subsidyId,
            code: body.code,
            nameTh: body.nameTh,
            nameEn: body.nameEn ?? null,
            isActive: true,
            createdBy: auth.user?.id ?? null,
          })
          .returning({ id: budgetSubsidyTypes.id });

        await invalidate("settings:budget-subsidies");
        await invalidate("settings:budget-subsidy-types");
        return {
          success: true,
          message: "เพิ่มประเภทงบอุดหนุนสำเร็จ",
          id: inserted.id,
        };
      } catch (err: any) {
        console.error(
          "[POST budget-subsidy-types] error:",
          err?.code,
          err?.message,
        );
        set.status = 409;
        const code = err?.code ?? err?.cause?.code;
        if (code === "23503")
          return { success: false, message: "ไม่พบงบอุดหนุนที่เลือก" };
        if (code === "23505")
          return {
            success: false,
            message: "รหัสนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น",
          };
        return {
          success: false,
          message: "ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง",
        };
      }
    },
    {
      body: t.Object({
        subsidyId: t.Number(),
        code: t.String(),
        nameTh: t.String(),
        nameEn: t.Optional(t.String()),
      }),
    },
  )

  .put(
    "/budget-subsidy-types/:id",
    async ({ params, body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      const item = await db.query.budgetSubsidyTypes.findFirst({
        where: eq(budgetSubsidyTypes.id, Number(params.id)),
      });
      if (!item) {
        set.status = 404;
        return { success: false, message: "ไม่พบข้อมูล" };
      }

      try {
        await db
          .update(budgetSubsidyTypes)
          .set({
            subsidyId: body.subsidyId,
            code: body.code,
            nameTh: body.nameTh,
            nameEn: body.nameEn ?? null,
            isActive: body.isActive ?? item.isActive,
            updatedBy: auth.user?.id ?? null,
          })
          .where(eq(budgetSubsidyTypes.id, Number(params.id)));

        await invalidate("settings:budget-subsidies");
        await invalidate("settings:budget-subsidy-types");
        return { success: true, message: "แก้ไขประเภทงบอุดหนุนสำเร็จ" };
      } catch (err: any) {
        console.error(
          "[PUT budget-subsidy-types] error:",
          err?.code,
          err?.message,
        );
        set.status = 409;
        const code = err?.code ?? err?.cause?.code;
        if (code === "23503")
          return { success: false, message: "ไม่พบงบอุดหนุนที่เลือก" };
        if (code === "23505")
          return {
            success: false,
            message: "รหัสนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น",
          };
        return {
          success: false,
          message: "ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง",
        };
      }
    },
    {
      body: t.Object({
        subsidyId: t.Number(),
        code: t.String(),
        nameTh: t.String(),
        nameEn: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )

  .delete("/budget-subsidy-types/:id", async ({ params, auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
    }

    const item = await db.query.budgetSubsidyTypes.findFirst({
      where: eq(budgetSubsidyTypes.id, Number(params.id)),
    });
    if (!item) {
      set.status = 404;
      return { success: false, message: "ไม่พบข้อมูล" };
    }

    // await db.update(budgetSubsidyTypes).set({ isActive: false }).where(eq(budgetSubsidyTypes.id, Number(params.id)));
    // delete แบบถาวร เพราะไม่มีข้อมูลอื่นที่อ้างอิงถึง (ไม่มี foreign key)
    await db
      .delete(budgetSubsidyTypes)
      .where(eq(budgetSubsidyTypes.id, Number(params.id)));
    await invalidate("settings:budget-subsidies");
    await invalidate("settings:budget-subsidy-types");
    return { success: true, message: "ลบประเภทงบอุดหนุนสำเร็จ" };
  })

  // =============================================
  // Budget Groups — กลุ่มงบอุดหนุน
  // =============================================
  .get("/budget-groups", async ({ auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์เข้าถึง" };
    }

    const data = await db.query.budgetGroups.findMany({
      with: { budgetType: true },
      orderBy: (t, { asc }) => [asc(t.budgetTypeId), asc(t.name)],
    });
    return { success: true, data };
  })

  .post(
    "/budget-groups",
    async ({ body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      // ดึงชื่อ budgetSubsidyType เพื่อสร้าง group_type_display
      const subsidyType = await db.query.budgetSubsidyTypes.findFirst({
        where: eq(budgetSubsidyTypes.id, body.budgetTypeId),
      });
      if (!subsidyType) {
        set.status = 400;
        return { success: false, message: "ไม่พบประเภทงบอุดหนุนที่เลือก" };
      }

      const now = new Date(Math.floor(Date.now() / 1000) * 1000);
      const insertValues = {
        budgetTypeId: body.budgetTypeId,
        name: body.name,
        groupType: "general_operation",
        groupTypeDisplay: `งบอุดหนุน-${subsidyType.nameTh}`,
        departmentId: auth.orgId ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      const doInsert = () =>
        db
          .insert(budgetGroups)
          .values(insertValues)
          .returning({ id: budgetGroups.id });

      try {
        const [inserted] = await doInsert();
        await invalidate("settings:budget-groups");
        await invalidate("settings:budget-expense-details");
        return {
          success: true,
          message: "เพิ่มกลุ่มงบอุดหนุนสำเร็จ",
          id: inserted.id,
        };
      } catch (err: any) {
        const code = err?.code ?? err?.cause?.code;
        if (
          code === "23505" &&
          (err?.cause?.constraint ?? err?.constraint) === "budget_groups_pkey"
        ) {
          // Sequence out of sync — reset to MAX(id) then retry once
          try {
            await db.execute(
              sql`SELECT setval('budget_groups_id_seq', (SELECT MAX(id) FROM budget_groups))`,
            );
            const [inserted] = await doInsert();
            await invalidate("settings:budget-groups");
            await invalidate("settings:budget-expense-details");
            return {
              success: true,
              message: "เพิ่มกลุ่มงบอุดหนุนสำเร็จ",
              id: inserted.id,
            };
          } catch {
            // sequence fix failed — fall through
          }
        }
        if (code === "23503")
          return { success: false, message: "ไม่พบประเภทงบอุดหนุนที่เลือก" };
        return {
          success: false,
          message: "ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง",
        };
      }
    },
    {
      body: t.Object({
        budgetTypeId: t.Number(),
        name: t.String(),
        groupType: t.Optional(t.String()),
        groupTypeDisplay: t.Optional(t.String()),
      }),
    },
  )

  .put(
    "/budget-groups/:id",
    async ({ params, body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      try {
        const item = await db.query.budgetGroups.findFirst({
          where: eq(budgetGroups.id, Number(params.id)),
        });
        if (!item) {
          set.status = 404;
          return { success: false, message: "ไม่พบข้อมูล" };
        }

        // ถ้า budgetTypeId เปลี่ยน ให้ดึงชื่อใหม่มา generate group_type_display
        let groupTypeDisplay = item.groupTypeDisplay;
        if (body.budgetTypeId !== item.budgetTypeId) {
          const subsidyType = await db.query.budgetSubsidyTypes.findFirst({
            where: eq(budgetSubsidyTypes.id, body.budgetTypeId),
          });
          if (subsidyType) groupTypeDisplay = `งบอุดหนุน-${subsidyType.nameTh}`;
        }

        const updatedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
        await db
          .update(budgetGroups)
          .set({
            budgetTypeId: body.budgetTypeId,
            name: body.name,
            groupType: item.groupType ?? "general_operation",
            groupTypeDisplay,
            isActive: body.isActive ?? item.isActive,
            updatedAt,
          })
          .where(eq(budgetGroups.id, Number(params.id)));

        await invalidate("settings:budget-groups");
        await invalidate("settings:budget-expense-details");
        return { success: true, message: "แก้ไขกลุ่มงบอุดหนุนสำเร็จ" };
      } catch (err) {
        const code = err?.code ?? err?.cause?.code;
        if (code === "23503")
          return { success: false, message: "ไม่พบประเภทงบอุดหนุนที่เลือก" };
        return {
          success: false,
          message: "ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง",
        };
      }
    },
    {
      body: t.Object({
        budgetTypeId: t.Number(),
        name: t.String(),
        groupType: t.Optional(t.String()),
        groupTypeDisplay: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )

  .delete("/budget-groups/:id", async ({ params, auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
    }

    try {
      const groupId = Number(params.id);
      console.log(
        "[DELETE /budget-groups] called, id:",
        params.id,
        "→",
        groupId,
      );

      const item = await db.query.budgetGroups.findFirst({
        where: eq(budgetGroups.id, groupId),
      });
      console.log(
        "[DELETE /budget-groups] found item:",
        item ? `id=${item.id} name=${item.name}` : "NOT FOUND",
      );
      if (!item) {
        set.status = 404;
        return { success: false, message: "ไม่พบข้อมูล" };
      }

      // 1) หา main items ที่ผูกกับ group นี้
      const mainItems = await db.query.budgetExpenseDetails.findMany({
        where: eq(budgetExpenseDetails.budgetGroupId, groupId),
        columns: { id: true },
      });
      console.log(
        "[DELETE /budget-groups] budgetExpenseDetails (main) to delete:",
        mainItems.map((r) => r.id),
      );

      // 2) ลบ sub-items (parentId self-ref) ก่อน
      if (mainItems.length > 0) {
        const mainIds = mainItems.map((r) => r.id);
        const deletedSubs = await db
          .delete(budgetExpenseDetails)
          .where(inArray(budgetExpenseDetails.parentId, mainIds))
          .returning({ id: budgetExpenseDetails.id });
        console.log(
          "[DELETE /budget-groups] deleted sub-items:",
          deletedSubs.map((r) => r.id),
        );
      }

      // 3) ลบ main items
      const deletedMains = await db
        .delete(budgetExpenseDetails)
        .where(eq(budgetExpenseDetails.budgetGroupId, groupId))
        .returning({ id: budgetExpenseDetails.id });
      console.log(
        "[DELETE /budget-groups] deleted main items:",
        deletedMains.map((r) => r.id),
      );

      // 4) ลบ budgetGroup
      const deletedGroups = await db
        .delete(budgetGroups)
        .where(eq(budgetGroups.id, groupId))
        .returning({ id: budgetGroups.id });
      console.log(
        "[DELETE /budget-groups] deleted budgetGroups:",
        deletedGroups.map((r) => r.id),
      );

      if (deletedGroups.length === 0) {
        console.warn(
          "[DELETE /budget-groups] WARNING: no rows deleted from budget_groups!",
        );
        set.status = 500;
        return {
          success: false,
          message: "ไม่สามารถลบได้ ข้อมูลไม่ถูกลบจากฐานข้อมูล",
        };
      }

      await invalidate("settings:budget-groups");
      await invalidate("settings:budget-expense-details");
      return { success: true, message: "ลบกลุ่มงบอุดหนุนสำเร็จ" };
    } catch (err) {
      console.error("[DELETE /budget-groups/:id] error:", err);
      set.status = 500;
      return { success: false, message: "ไม่สามารถลบได้ กรุณาลองใหม่อีกครั้ง" };
    }
  })

  // =============================================
  // Budget Expense Details — รายละเอียดค่าใช้จ่ายตามหมวดเงิน
  // =============================================
  .get("/budget-expense-details", async ({ auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์เข้าถึง" };
    }

    const data = await db.query.budgetExpenseDetails.findMany({
      with: { budgetGroup: true },
      orderBy: (t, { asc }) => [asc(t.budgetGroupId), asc(t.name)],
    });
    return { success: true, data };
  })

  .post(
    "/budget-expense-details",
    async ({ body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      try {
        const [inserted] = await db
          .insert(budgetExpenseDetails)
          .values({
            budgetGroupId: body.budgetGroupId ?? null,
            name: body.name,
            detailType: body.detailType ?? "main",
            detailTypeDisplay: body.detailTypeDisplay ?? null,
            parentId: body.parentId ?? null,
            isActive: true,
          })
          .returning({ id: budgetExpenseDetails.id });

        await invalidate("settings:budget-expense-details");
        return {
          success: true,
          message: "เพิ่มรายละเอียดค่าใช้จ่ายสำเร็จ",
          id: inserted.id,
        };
      } catch (err) {
        const code = err?.code ?? err?.cause?.code;
        if (code === "23503")
          return { success: false, message: "ไม่พบกลุ่มงบอุดหนุนที่เลือก" };
        return {
          success: false,
          message: "ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง",
        };
      }
    },
    {
      body: t.Object({
        budgetGroupId: t.Optional(t.Number()),
        name: t.String(),
        detailType: t.Optional(t.String()),
        detailTypeDisplay: t.Optional(t.String()),
        parentId: t.Optional(t.Number()),
      }),
    },
  )

  .put(
    "/budget-expense-details/:id",
    async ({ params, body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      try {
        const item = await db.query.budgetExpenseDetails.findFirst({
          where: eq(budgetExpenseDetails.id, Number(params.id)),
        });
        if (!item) {
          set.status = 404;
          return { success: false, message: "ไม่พบข้อมูล" };
        }

        await db
          .update(budgetExpenseDetails)
          .set({
            budgetGroupId: body.budgetGroupId ?? item.budgetGroupId,
            name: body.name,
            detailType: body.detailType ?? item.detailType,
            detailTypeDisplay: body.detailTypeDisplay ?? item.detailTypeDisplay,
            parentId:
              body.parentId !== undefined
                ? (body.parentId ?? null)
                : item.parentId,
            isActive: body.isActive ?? item.isActive,
          })
          .where(eq(budgetExpenseDetails.id, Number(params.id)));

        await invalidate("settings:budget-expense-details");
        return { success: true, message: "แก้ไขรายละเอียดค่าใช้จ่ายสำเร็จ" };
      } catch (err) {
        const code = err?.code ?? err?.cause?.code;
        if (code === "23503")
          return { success: false, message: "ไม่พบกลุ่มงบอุดหนุนที่เลือก" };
        return {
          success: false,
          message: "ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง",
        };
      }
    },
    {
      body: t.Object({
        budgetGroupId: t.Optional(t.Number()),
        name: t.String(),
        detailType: t.Optional(t.String()),
        detailTypeDisplay: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        parentId: t.Optional(t.Number()),
      }),
    },
  )

  .delete("/budget-expense-details/:id", async ({ params, auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
    }

    try {
      const item = await db.query.budgetExpenseDetails.findFirst({
        where: eq(budgetExpenseDetails.id, Number(params.id)),
      });
      if (!item) {
        set.status = 404;
        return { success: false, message: "ไม่พบข้อมูล" };
      }

      // await db
      //   .update(budgetExpenseDetails)
      //   .set({ isActive: false })
      //   .where(eq(budgetExpenseDetails.id, Number(params.id)));
      // delete แบบถาวร เพราะไม่มีข้อมูลอื่นที่อ้างอิงถึง (ไม่มี foreign key)
      await db
        .delete(budgetExpenseDetails)
        .where(eq(budgetExpenseDetails.id, Number(params.id)));
      await invalidate("settings:budget-expense-details");
      return { success: true, message: "ลบรายละเอียดค่าใช้จ่ายสำเร็จ" };
    } catch (err) {
      return { success: false, message: "ไม่สามารถลบได้ กรุณาลองใหม่อีกครั้ง" };
    }
  })

  // =============================================
  // Permission Matrix — การจัดการสิทธิ์ในระบบตาม role
  // =============================================

  // GET /api/settings/permissions/my — ดึง permissions ของ role ตัวเอง (ทุก role เข้าถึงได้)
  .get("/permissions/my", async ({ auth }) => {
    const role = auth.role;
    if (!role) return { success: true, permissions: [] };

    const rows = await db.query.rolePermissions.findMany({
      where: and(
        eq(rolePermissions.role, role as any),
        eq(rolePermissions.granted, true)
      ),
    });

    return { success: true, permissions: rows.map((r) => r.permissionCode) };
  })

  // GET /api/settings/permissions/matrix — ดึง permission matrix ทั้งหมด
  .get("/permissions/matrix", async ({ auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์เข้าถึง" };
    }

    return withCache("settings:permissions:matrix", 300, async () => {
      // ดึงสิทธิ์ที่ถูก grant ใน DB
      const granted = await db.query.rolePermissions.findMany();

      // สร้าง map: permissionCode → { role: granted }
      const grantedMap: Record<string, Record<string, boolean>> = {};
      for (const row of granted) {
        if (!grantedMap[row.permissionCode])
          grantedMap[row.permissionCode] = {};
        grantedMap[row.permissionCode][row.role] = row.granted;
      }

      // จัดกลุ่ม permissions ตาม module
      const moduleMap: Record<
        string,
        { moduleTh: string; permissions: any[] }
      > = {};
      for (const perm of SYSTEM_PERMISSIONS) {
        if (!moduleMap[perm.module]) {
          moduleMap[perm.module] = { moduleTh: perm.moduleTh, permissions: [] };
        }
        const roleGrants: Record<string, boolean> = {};
        for (const role of ALL_ROLES) {
          roleGrants[role] = grantedMap[perm.code]?.[role] ?? false;
        }
        moduleMap[perm.module].permissions.push({
          code: perm.code,
          nameTh: perm.nameTh,
          sortOrder: perm.sortOrder,
          roles: roleGrants,
        });
      }

      return {
        success: true,
        roles: ALL_ROLES,
        modules: Object.entries(moduleMap).map(([module, data]) => ({
          module,
          moduleTh: data.moduleTh,
          permissions: data.permissions,
        })),
      };
    });
  })

  // PUT /api/settings/permissions/matrix — บันทึก permission matrix
  .put(
    "/permissions/matrix",
    async ({ body, auth, set }) => {
      if (auth.role !== "super_admin") {
        set.status = 403;
        return { success: false, message: "เฉพาะ super_admin เท่านั้น" };
      }

      const validCodes = new Set(SYSTEM_PERMISSIONS.map((p) => p.code));

      // validate input
      for (const item of body.matrix) {
        if (!validCodes.has(item.permissionCode)) {
          set.status = 400;
          return {
            success: false,
            message: `permission code ไม่ถูกต้อง: ${item.permissionCode}`,
          };
        }
        if (!ALL_ROLES.includes(item.role as any)) {
          set.status = 400;
          return { success: false, message: `role ไม่ถูกต้อง: ${item.role}` };
        }
      }

      // Bulk upsert ทั้ง matrix ใน query เดียว
      const records = body.matrix.map((item) => ({
        role: item.role as any,
        permissionCode: item.permissionCode,
        granted: item.granted,
        updatedBy: auth.user?.id ?? null,
      }));

      await db
        .insert(rolePermissions)
        .values(records)
        .onConflictDoUpdate({
          target: [rolePermissions.role, rolePermissions.permissionCode],
          set: {
            granted: sql`EXCLUDED.granted`,
            updatedBy: sql`EXCLUDED.updated_by`,
            updatedAt: sql`NOW()`,
          },
        });

      await invalidate("settings:permissions:matrix");
      return { success: true, message: "บันทึกสิทธิ์สำเร็จ" };
    },
    {
      body: t.Object({
        matrix: t.Array(
          t.Object({
            role: t.String(),
            permissionCode: t.String(),
            granted: t.Boolean(),
          }),
        ),
      }),
    },
  );
