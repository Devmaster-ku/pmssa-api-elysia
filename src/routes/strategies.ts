import { Elysia } from "elysia";
import { db } from "../db";
import { users, organizations, strategies, strategicTactics, strategicDepartments, strategicDepartmentTactics, strategicDeanStrategies, strategicDeanTactics } from "../schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { jwtPlugin } from "../middleware/auth";
import { withCache, invalidate } from "../lib/cache";

// -----------------------------------------------
// ช่วยหาชื่อ campus จาก orgId ของ user
// -----------------------------------------------
async function resolveCampusName(orgId: number): Promise<string | null> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });
  if (!org) return null;

  if (org.orgLevel === "university") return "บางเขน";
  if (org.orgLevel === "campus") return org.nameTh;

  if (org.campusId) {
    const campus = await db.query.organizations.findFirst({
      where: eq(organizations.id, org.campusId),
    });
    return campus?.nameTh ?? null;
  }

  return "บางเขน";
}

export const strategyRoutes = new Elysia({ prefix: "/api/strategies" })
  .use(jwtPlugin)
  // invalidate strategies cache หลัง write operations ทุกตัว
  .onAfterHandle(({ request }) => {
    if (request.method !== "GET") {
      invalidate("strategies:*").catch(() => {});
    }
  })

  // -----------------------------------------------
  // GET /api/strategies/summary
  // -----------------------------------------------
  .get("/summary", async ({ headers, jwtAccess, set }) => {
    // Verify token manually (same pattern as /api/auth/me)
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");

    if (!token) {
      set.status = 401;
      return { success: false, message: "Unauthorized" };
    }

    let payload: any;
    try {
      payload = await jwtAccess.verify(token);
    } catch {
      set.status = 401;
      return { success: false, message: "Invalid or expired token" };
    }

    if (!payload || payload.type !== "access") {
      set.status = 401;
      return { success: false, message: "Invalid token" };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(payload.sub)),
    });
    if (!user || !user.isActive) {
      set.status = 401;
      return { success: false, message: "ไม่พบผู้ใช้หรือบัญชีถูกระงับ" };
    }

    // resolve orgId + role จาก token
    const orgId = payload.orgId ? Number(payload.orgId) : null;
    const role = payload.role ?? null;

    const cacheKey = `strategies:summary:${orgId ?? "none"}:${role ?? "none"}`;
    return withCache(cacheKey, 300, async () => {
      const campusName = orgId ? await resolveCampusName(orgId) : null;

      // ════════════════════════════════
      // 1. ระดับมหาวิทยาลัย (campus = "บางเขน")
      // ════════════════════════════════
      const univStrategies = await db.query.strategies.findMany({
        where: and(
          eq(strategies.campus, "บางเขน"),
          eq(strategies.isActive, true),
          isNull(strategies.deletedAt)
        ),
      });
      const univStrategyIds = univStrategies.map((s) => s.id);

      let univTacticCount = 0;
      if (univStrategyIds.length > 0) {
        const allTactics = await db.query.strategicTactics.findMany({
          where: and(
            eq(strategicTactics.isActive, true),
            isNull(strategicTactics.deletedAt)
          ),
        });
        univTacticCount = allTactics.filter((t) =>
          univStrategyIds.includes(t.strategyId)
        ).length;
      }

      // ════════════════════════════════
      // 2. ระดับวิทยาเขต
      // ════════════════════════════════
      const isUnivLevel =
        !campusName ||
        campusName === "บางเขน" ||
        role === "super_admin" ||
        role === "univ_executive" ||
        role === "univ_officer" ||
        !orgId;

      let campusStrategies: typeof univStrategies = [];
      let campusTacticCount = 0;

      if (!isUnivLevel && campusName) {
        campusStrategies = await db.query.strategies.findMany({
          where: and(
            eq(strategies.campus, campusName),
            eq(strategies.isActive, true),
            isNull(strategies.deletedAt)
          ),
        });
        const campusStrategyIds = campusStrategies.map((s) => s.id);
        if (campusStrategyIds.length > 0) {
          const allTactics = await db.query.strategicTactics.findMany({
            where: and(
              eq(strategicTactics.isActive, true),
              isNull(strategicTactics.deletedAt)
            ),
          });
          campusTacticCount = allTactics.filter((t) =>
            campusStrategyIds.includes(t.strategyId)
          ).length;
        }
      }

      // ════════════════════════════════
      // 3. ระดับส่วนงาน
      // ════════════════════════════════
      const deptStrategies = orgId
        ? await db.query.strategicDepartments.findMany({
            where: and(
              eq(strategicDepartments.departmentId, orgId),
              eq(strategicDepartments.isActive, true),
              isNull(strategicDepartments.deletedAt)
            ),
          })
        : [];
      const deptStrategyIds = deptStrategies.map((s) => s.id);

      let deptTacticCount = 0;
      if (deptStrategyIds.length > 0) {
        const allDeptTactics = await db.query.strategicDepartmentTactics.findMany({
          where: and(
            eq(strategicDepartmentTactics.isActive, true),
            isNull(strategicDepartmentTactics.deletedAt)
          ),
        });
        deptTacticCount = allDeptTactics.filter((t) =>
          deptStrategyIds.includes(t.strategicDepartmentId)
        ).length;
      }

      // ════════════════════════════════
      // 4. ระดับคณบดีส่วนงาน
      // ════════════════════════════════
      const deanStrategies = orgId
        ? await db.query.strategicDeanStrategies.findMany({
            where: and(
              eq(strategicDeanStrategies.departmentId, orgId),
              eq(strategicDeanStrategies.isActive, true),
              isNull(strategicDeanStrategies.deletedAt)
            ),
          })
        : [];
      const deanStrategyIds = deanStrategies.map((s) => s.id);

      let deanTacticCount = 0;
      if (deanStrategyIds.length > 0) {
        const allDeanTactics = await db.query.strategicDeanTactics.findMany({
          where: and(
            eq(strategicDeanTactics.isActive, true),
            isNull(strategicDeanTactics.deletedAt)
          ),
        });
        deanTacticCount = allDeanTactics.filter((t) =>
          deanStrategyIds.includes(t.strategicDeanStrategyId)
        ).length;
      }

      return {
        success: true,
        campusName,
        university: {
          strategyCount: univStrategies.length,
          tacticCount: univTacticCount,
        },
        campus: {
          campusName: isUnivLevel ? null : campusName,
          strategyCount: campusStrategies.length,
          tacticCount: campusTacticCount,
        },
        division: {
          orgId,
          strategyCount: deptStrategies.length,
          tacticCount: deptTacticCount,
        },
        dean: {
          strategyCount: deanStrategies.length,
          tacticCount: deanTacticCount,
        },
      };
    });
  })

  // -----------------------------------------------
  // GET /api/strategies/university
  // ดึงยุทธศาสตร์ระดับมหาวิทยาลัย (campus = บางเขน) พร้อมกลยุทธ์ย่อย
  // -----------------------------------------------
  .get("/university", async ({ headers, jwtAccess, set }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");

    if (!token) {
      set.status = 401;
      return { success: false, message: "Unauthorized" };
    }

    let payload: any;
    try {
      payload = await jwtAccess.verify(token);
    } catch {
      set.status = 401;
      return { success: false, message: "Invalid or expired token" };
    }

    if (!payload || payload.type !== "access") {
      set.status = 401;
      return { success: false, message: "Invalid token" };
    }

    // ดึง strategies ที่ campus = "บางเขน" พร้อม tactics ย่อย
    return withCache("strategies:university", 600, async () => {
      const rows = await db.query.strategies.findMany({
        where: and(
          eq(strategies.campus, "บางเขน"),
          eq(strategies.isActive, true),
          isNull(strategies.deletedAt)
        ),
        orderBy: [asc(strategies.orderList)],
        with: {
          tactics: {
            where: and(
              eq(strategicTactics.isActive, true),
              isNull(strategicTactics.deletedAt)
            ),
            orderBy: [asc(strategicTactics.orderSequence)],
          },
        },
      });
      return { success: true, data: rows };
    });
  })

  // -----------------------------------------------
  // PUT /api/strategies/:id
  // แก้ไขยุทธศาสตร์
  // -----------------------------------------------
  .put("/:id", async ({ headers, jwtAccess, set, params, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");

    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }

    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    const { name, orderList, fiscalPlan } = body as { name?: string; orderList?: number | null; fiscalPlan?: string | null };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อยุทธศาสตร์" }; }

    const existing = await db.query.strategies.findFirst({ where: eq(strategies.id, id) });
    if (!existing || existing.deletedAt) { set.status = 404; return { success: false, message: "ไม่พบยุทธศาสตร์" }; }

    await db.update(strategies)
      .set({
        name: name.trim(),
        ...(orderList !== undefined ? { orderList: orderList ?? null } : {}),
        ...(fiscalPlan !== undefined ? { fiscalPlan: fiscalPlan ?? null } : {}),
        updatedBy: Number(payload.sub),
      })
      .where(eq(strategies.id, id));

    return { success: true, message: "บันทึกเรียบร้อย" };
  })

  // -----------------------------------------------
  // POST /api/strategies/:strategyId/tactics
  // เพิ่มกลยุทธ์ใหม่ภายใต้ยุทธศาสตร์
  // -----------------------------------------------
  .post("/:strategyId/tactics", async ({ headers, jwtAccess, set, params, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const strategyId = Number((params as any).strategyId);
    const { name, orderSequence } = body as { name?: string; orderSequence?: number };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อกลยุทธ์" }; }

    const existing = await db.query.strategies.findFirst({ where: eq(strategies.id, strategyId) });
    if (!existing || existing.deletedAt) { set.status = 404; return { success: false, message: "ไม่พบยุทธศาสตร์" }; }

    await db.insert(strategicTactics).values({
      strategyId,
      name: name.trim(),
      orderSequence: orderSequence ?? null,
      isActive: true,
      createdBy: Number(payload.sub),
    });

    return { success: true, message: "เพิ่มกลยุทธ์เรียบร้อย" };
  })

  // -----------------------------------------------
  // PUT /api/strategies/tactics/:id
  // แก้ไขกลยุทธ์
  // -----------------------------------------------
  .put("/tactics/:id", async ({ headers, jwtAccess, set, params, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    const { name, orderSequence } = body as { name?: string; orderSequence?: number };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อกลยุทธ์" }; }

    const existing = await db.query.strategicTactics.findFirst({ where: eq(strategicTactics.id, id) });
    if (!existing || existing.deletedAt) { set.status = 404; return { success: false, message: "ไม่พบกลยุทธ์" }; }

    await db.update(strategicTactics)
      .set({
        name: name.trim(),
        ...(orderSequence !== undefined ? { orderSequence } : {}),
        updatedBy: Number(payload.sub),
      })
      .where(eq(strategicTactics.id, id));

    return { success: true, message: "บันทึกเรียบร้อย" };
  })

  // -----------------------------------------------
  // GET /api/strategies/departments
  // ดึงยุทธศาสตร์ระดับส่วนงาน (strategic_departments)
  // -----------------------------------------------
  .get("/departments", async ({ headers, jwtAccess, set }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const orgId = payload.orgId ? Number(payload.orgId) : null;

    return withCache(`strategies:departments:${orgId ?? "none"}`, 300, async () => {
      const rows = await db.query.strategicDepartments.findMany({
        where: and(
          ...(orgId ? [eq(strategicDepartments.departmentId, orgId)] : []),
          eq(strategicDepartments.isActive, true),
          isNull(strategicDepartments.deletedAt)
        ),
        orderBy: [asc(strategicDepartments.id)],
        with: {
          tactics: {
            where: and(
              eq(strategicDepartmentTactics.isActive, true),
              isNull(strategicDepartmentTactics.deletedAt)
            ),
            orderBy: [asc(strategicDepartmentTactics.order)],
          },
        },
      });
      return { success: true, data: rows };
    });
  })

  // -----------------------------------------------
  // PUT /api/strategies/departments/:id
  // แก้ไขยุทธศาสตร์ระดับส่วนงาน (รวม fiscalPlan)
  // -----------------------------------------------
  .put("/departments/:id", async ({ headers, jwtAccess, set, params, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    const { name, fiscalPlan, year } = body as { name?: string; fiscalPlan?: string | null; year?: number | null };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อยุทธศาสตร์" }; }

    const existing = await db.query.strategicDepartments.findFirst({
      where: eq(strategicDepartments.id, id),
    });
    if (!existing || existing.deletedAt) {
      set.status = 404; return { success: false, message: "ไม่พบยุทธศาสตร์ระดับส่วนงาน" };
    }

    await db.update(strategicDepartments)
      .set({
        name: name.trim(),
        ...(fiscalPlan !== undefined ? { fiscalPlan: fiscalPlan ?? null } : {}),
        ...(year !== undefined ? { year: year ?? null } : {}),
        updatedBy: Number(payload.sub),
      })
      .where(eq(strategicDepartments.id, id));

    return { success: true, message: "บันทึกเรียบร้อย" };
  })

  // -----------------------------------------------
  // DELETE /api/strategies/tactics/:id
  // ลบกลยุทธ์ระดับมหาวิทยาลัย (soft delete)
  // -----------------------------------------------
  .delete("/tactics/:id", async ({ headers, jwtAccess, set, params }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    await db.update(strategicTactics)
      .set({
        isActive: false,
        deletedAt: new Date(),
        deletedBy: Number(payload.sub),
      })
      .where(eq(strategicTactics.id, id));

    return { success: true, message: "ลบกลยุทธ์เรียบร้อย" };
  })

  // -----------------------------------------------
  // POST /api/strategies/departments/:deptStrategyId/tactics
  // เพิ่มกลยุทธ์ใหม่ภายใต้ยุทธศาสตร์ระดับส่วนงาน
  // -----------------------------------------------
  .post("/departments/:deptStrategyId/tactics", async ({ headers, jwtAccess, set, params, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const deptStrategyId = Number((params as any).deptStrategyId);
    const { name, order } = body as { name?: string; order?: number };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อกลยุทธ์" }; }

    const existing = await db.query.strategicDepartments.findFirst({
      where: eq(strategicDepartments.id, deptStrategyId),
    });
    if (!existing || existing.deletedAt) { set.status = 404; return { success: false, message: "ไม่พบยุทธศาสตร์ส่วนงาน" }; }

    await db.insert(strategicDepartmentTactics).values({
      strategicDepartmentId: deptStrategyId,
      name: name.trim(),
      order: order ?? null,
      isActive: true,
      createdBy: Number(payload.sub),
    });

    return { success: true, message: "เพิ่มกลยุทธ์เรียบร้อย" };
  })

  // -----------------------------------------------
  // PUT /api/strategies/department-tactics/:id
  // แก้ไขกลยุทธ์ระดับส่วนงาน
  // -----------------------------------------------
  .put("/department-tactics/:id", async ({ headers, jwtAccess, set, params, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    const { name, order } = body as { name?: string; order?: number };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อกลยุทธ์" }; }

    const existing = await db.query.strategicDepartmentTactics.findFirst({
      where: eq(strategicDepartmentTactics.id, id),
    });
    if (!existing || existing.deletedAt) { set.status = 404; return { success: false, message: "ไม่พบกลยุทธ์" }; }

    await db.update(strategicDepartmentTactics)
      .set({
        name: name.trim(),
        ...(order !== undefined ? { order } : {}),
        updatedBy: Number(payload.sub),
      })
      .where(eq(strategicDepartmentTactics.id, id));

    return { success: true, message: "บันทึกเรียบร้อย" };
  })

  // -----------------------------------------------
  // DELETE /api/strategies/department-tactics/:id
  // ลบกลยุทธ์ระดับส่วนงาน (soft delete)
  // -----------------------------------------------
  .delete("/department-tactics/:id", async ({ headers, jwtAccess, set, params }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    await db.update(strategicDepartmentTactics)
      .set({
        isActive: false,
        deletedAt: new Date(),
        deletedBy: Number(payload.sub),
      })
      .where(eq(strategicDepartmentTactics.id, id));

    return { success: true, message: "ลบกลยุทธ์เรียบร้อย" };
  })

  // -----------------------------------------------
  // GET /api/strategies/dean
  // ดึงยุทธศาสตร์ระดับคณบดีส่วนงาน
  // -----------------------------------------------
  .get("/dean", async ({ headers, jwtAccess, set }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const orgId = payload.orgId ? Number(payload.orgId) : null;

    return withCache(`strategies:dean:${orgId ?? "none"}`, 300, async () => {
      const rows = await db.query.strategicDeanStrategies.findMany({
        where: and(
          ...(orgId ? [eq(strategicDeanStrategies.departmentId, orgId)] : []),
          eq(strategicDeanStrategies.isActive, true),
          isNull(strategicDeanStrategies.deletedAt)
        ),
        orderBy: [asc(strategicDeanStrategies.id)],
        with: {
          tactics: {
            where: and(
              eq(strategicDeanTactics.isActive, true),
              isNull(strategicDeanTactics.deletedAt)
            ),
            orderBy: [asc(strategicDeanTactics.order)],
          },
        },
      });
      return { success: true, data: rows };
    });
  })

  // -----------------------------------------------
  // PUT /api/strategies/dean/:id
  // แก้ไขยุทธศาสตร์ระดับคณบดีส่วนงาน
  // -----------------------------------------------
  .put("/dean/:id", async ({ headers, jwtAccess, set, params, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    const { name, fiscalPlan, year } = body as { name?: string; fiscalPlan?: string | null; year?: number | null };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อยุทธศาสตร์" }; }

    const existing = await db.query.strategicDeanStrategies.findFirst({
      where: eq(strategicDeanStrategies.id, id),
    });
    if (!existing || existing.deletedAt) {
      set.status = 404; return { success: false, message: "ไม่พบยุทธศาสตร์ระดับคณบดี" };
    }

    await db.update(strategicDeanStrategies)
      .set({
        name: name.trim(),
        ...(fiscalPlan !== undefined ? { fiscalPlan: fiscalPlan ?? null } : {}),
        ...(year !== undefined ? { year: year ?? null } : {}),
        updatedBy: Number(payload.sub),
      })
      .where(eq(strategicDeanStrategies.id, id));

    return { success: true, message: "บันทึกเรียบร้อย" };
  })

  // -----------------------------------------------
  // POST /api/strategies/dean/:deanStrategyId/tactics
  // เพิ่มกลยุทธ์ใหม่ภายใต้ยุทธศาสตร์ระดับคณบดี
  // -----------------------------------------------
  .post("/dean/:deanStrategyId/tactics", async ({ headers, jwtAccess, set, params, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const deanStrategyId = Number((params as any).deanStrategyId);
    const { name, order } = body as { name?: string; order?: number };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อกลยุทธ์" }; }

    const existing = await db.query.strategicDeanStrategies.findFirst({
      where: eq(strategicDeanStrategies.id, deanStrategyId),
    });
    if (!existing || existing.deletedAt) { set.status = 404; return { success: false, message: "ไม่พบยุทธศาสตร์คณบดี" }; }

    await db.insert(strategicDeanTactics).values({
      strategicDeanStrategyId: deanStrategyId,
      name: name.trim(),
      order: order ?? null,
      isActive: true,
      createdBy: Number(payload.sub),
    });

    return { success: true, message: "เพิ่มกลยุทธ์เรียบร้อย" };
  })

  // -----------------------------------------------
  // PUT /api/strategies/dean-tactics/:id
  // แก้ไขกลยุทธ์ระดับคณบดี
  // -----------------------------------------------
  .put("/dean-tactics/:id", async ({ headers, jwtAccess, set, params, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    const { name, order } = body as { name?: string; order?: number };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อกลยุทธ์" }; }

    const existing = await db.query.strategicDeanTactics.findFirst({
      where: eq(strategicDeanTactics.id, id),
    });
    if (!existing || existing.deletedAt) { set.status = 404; return { success: false, message: "ไม่พบกลยุทธ์" }; }

    await db.update(strategicDeanTactics)
      .set({
        name: name.trim(),
        ...(order !== undefined ? { order } : {}),
        updatedBy: Number(payload.sub),
      })
      .where(eq(strategicDeanTactics.id, id));

    return { success: true, message: "บันทึกเรียบร้อย" };
  })

  // -----------------------------------------------
  // DELETE /api/strategies/dean-tactics/:id
  // ลบกลยุทธ์ระดับคณบดี (soft delete)
  // -----------------------------------------------
  .delete("/dean-tactics/:id", async ({ headers, jwtAccess, set, params }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    await db.update(strategicDeanTactics)
      .set({
        isActive: false,
        deletedAt: new Date(),
        deletedBy: Number(payload.sub),
      })
      .where(eq(strategicDeanTactics.id, id));

    return { success: true, message: "ลบกลยุทธ์เรียบร้อย" };
  })

  // -----------------------------------------------
  // POST /api/strategies
  // สร้างยุทธศาสตร์ระดับมหาวิทยาลัย หรือ วิทยาเขต
  // -----------------------------------------------
  .post("/", async ({ headers, jwtAccess, set, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const { name, orderList, fiscalPlan, campus } = body as {
      name?: string; orderList?: number | null; fiscalPlan?: string | null; campus?: string;
    };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อยุทธศาสตร์" }; }

    const campusValue = campus?.trim() || "บางเขน";

    const [inserted] = await db.insert(strategies).values({
      name: name.trim(),
      campus: campusValue,
      orderList: orderList ?? null,
      fiscalPlan: fiscalPlan?.trim() || null,
      isActive: true,
      createdBy: Number(payload.sub),
    }).returning({ id: strategies.id });

    return { success: true, message: "เพิ่มยุทธศาสตร์เรียบร้อย", id: inserted.id };
  })

  // -----------------------------------------------
  // POST /api/strategies/departments
  // สร้างยุทธศาสตร์ระดับส่วนงาน
  // -----------------------------------------------
  .post("/departments", async ({ headers, jwtAccess, set, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const orgId = payload.orgId ? Number(payload.orgId) : null;
    if (!orgId) { set.status = 400; return { success: false, message: "ไม่พบข้อมูลหน่วยงาน" }; }

    const { name, fiscalPlan, year } = body as { name?: string; fiscalPlan?: string | null; year?: number | null };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อยุทธศาสตร์" }; }

    const [inserted] = await db.insert(strategicDepartments).values({
      name: name.trim(),
      departmentId: orgId,
      fiscalPlan: fiscalPlan?.trim() || null,
      year: year ?? null,
      isActive: true,
      createdBy: Number(payload.sub),
    }).returning({ id: strategicDepartments.id });

    return { success: true, message: "เพิ่มยุทธศาสตร์ระดับส่วนงานเรียบร้อย", id: inserted.id };
  })

  // -----------------------------------------------
  // POST /api/strategies/dean
  // สร้างยุทธศาสตร์ระดับคณบดีส่วนงาน
  // -----------------------------------------------
  .post("/dean", async ({ headers, jwtAccess, set, body }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const orgId = payload.orgId ? Number(payload.orgId) : null;
    if (!orgId) { set.status = 400; return { success: false, message: "ไม่พบข้อมูลหน่วยงาน" }; }

    const { name, fiscalPlan, year } = body as { name?: string; fiscalPlan?: string | null; year?: number | null };
    if (!name?.trim()) { set.status = 400; return { success: false, message: "กรุณาระบุชื่อยุทธศาสตร์" }; }

    const [inserted] = await db.insert(strategicDeanStrategies).values({
      name: name.trim(),
      departmentId: orgId,
      fiscalPlan: fiscalPlan?.trim() || null,
      year: year ?? null,
      isActive: true,
      createdBy: Number(payload.sub),
    }).returning({ id: strategicDeanStrategies.id });

    return { success: true, message: "เพิ่มยุทธศาสตร์ระดับคณบดีเรียบร้อย", id: inserted.id };
  })

  // -----------------------------------------------
  // DELETE /api/strategies/:id
  // ลบยุทธศาสตร์ระดับมหาวิทยาลัย/วิทยาเขต (soft delete)
  // -----------------------------------------------
  .delete("/:id", async ({ headers, jwtAccess, set, params }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    const existing = await db.query.strategies.findFirst({ where: eq(strategies.id, id) });
    if (!existing || existing.deletedAt) { set.status = 404; return { success: false, message: "ไม่พบยุทธศาสตร์" }; }

    await db.update(strategies)
      .set({ isActive: false, deletedAt: new Date(), deletedBy: Number(payload.sub) })
      .where(eq(strategies.id, id));

    return { success: true, message: "ลบยุทธศาสตร์เรียบร้อย" };
  })

  // -----------------------------------------------
  // DELETE /api/strategies/departments/:id
  // ลบยุทธศาสตร์ระดับส่วนงาน (soft delete)
  // -----------------------------------------------
  .delete("/departments/:id", async ({ headers, jwtAccess, set, params }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    const existing = await db.query.strategicDepartments.findFirst({ where: eq(strategicDepartments.id, id) });
    if (!existing || existing.deletedAt) { set.status = 404; return { success: false, message: "ไม่พบยุทธศาสตร์ระดับส่วนงาน" }; }

    await db.update(strategicDepartments)
      .set({ isActive: false, deletedAt: new Date(), deletedBy: Number(payload.sub) })
      .where(eq(strategicDepartments.id, id));

    return { success: true, message: "ลบยุทธศาสตร์ระดับส่วนงานเรียบร้อย" };
  })

  // -----------------------------------------------
  // DELETE /api/strategies/dean/:id
  // ลบยุทธศาสตร์ระดับคณบดี (soft delete)
  // -----------------------------------------------
  .delete("/dean/:id", async ({ headers, jwtAccess, set, params }) => {
    const authHeader = (headers as any).authorization || (headers as any).Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");
    if (!token) { set.status = 401; return { success: false, message: "Unauthorized" }; }
    let payload: any;
    try { payload = await jwtAccess.verify(token); } catch {
      set.status = 401; return { success: false, message: "Invalid or expired token" };
    }
    if (!payload || payload.type !== "access") {
      set.status = 401; return { success: false, message: "Invalid token" };
    }

    const id = Number((params as any).id);
    if (!id || isNaN(id)) { set.status = 400; return { success: false, message: "Invalid id" }; }

    const existing = await db.query.strategicDeanStrategies.findFirst({ where: eq(strategicDeanStrategies.id, id) });
    if (!existing || existing.deletedAt) { set.status = 404; return { success: false, message: "ไม่พบยุทธศาสตร์ระดับคณบดี" }; }

    await db.update(strategicDeanStrategies)
      .set({ isActive: false, deletedAt: new Date(), deletedBy: Number(payload.sub) })
      .where(eq(strategicDeanStrategies.id, id));

    return { success: true, message: "ลบยุทธศาสตร์ระดับคณบดีเรียบร้อย" };
  });
