import { Elysia, t } from "elysia";
import { db } from "../db";
import { projects, organizations, users, projectDetails, projectTargets, projectDetailSdgs } from "../schema";
import { eq, and, or, ilike, isNull, inArray, count, desc, sql, asc } from "drizzle-orm";
import { authMiddleware, getAccessibleOrgIds } from "../middleware/auth";

export const projectRoutes = new Elysia({ prefix: "/api/projects" })
  .use(authMiddleware)

  // -----------------------------------------------
  // GET /api/projects — ดึงรายการโครงการ (ตาม scope)
  // -----------------------------------------------
  .get(
    "/",
    async ({ auth, query, set }) => {
      if (!auth.role || !auth.orgId) {
        set.status = 403;
        return { success: false, message: "กรุณาเลือกสังกัดก่อน" };
      }

      const { orgIds } = await getAccessibleOrgIds(auth.role, auth.orgId);
      if (orgIds.length === 0) {
        return { success: true, data: [], total: 0, page: 1, limit: 10, stats: {} };
      }

      const page   = Math.max(1, Number(query.page)  || 1);
      const limit  = Math.min(100, Math.max(1, Number(query.limit) || 10));
      const offset = (page - 1) * limit;

      // ── Build WHERE conditions ──────────────────────
      const conditions: any[] = [isNull(projects.deletedAt)];

      // Scope: ถ้า query.orgId ระบุมา → กรองเฉพาะ org นั้น (ถ้าอยู่ใน scope)
      if (query.orgId) {
        const targetOrgId = Number(query.orgId);
        if (orgIds.includes(targetOrgId)) {
          conditions.push(eq(projects.orgId, targetOrgId));
        } else {
          return { success: true, data: [], total: 0, page, limit, stats: {} };
        }
      } else {
        conditions.push(inArray(projects.orgId, orgIds));
      }

      if (query.year) {
        conditions.push(eq(projects.year, query.year));
      }

      if (query.status) {
        conditions.push(eq(projects.status, query.status as any));
      }

      if (query.search) {
        const term = `%${query.search}%`;
        conditions.push(
          or(
            ilike(projects.projectName, term),
            ilike(projects.projectCode, term),
          )
        );
      }

      const whereClause = and(...conditions);

      // ── Query: total + stats + rows ─────────────────
      const [totalRows, statsRows, rows] = await Promise.all([
        db.select({ total: count() }).from(projects).where(whereClause),

        // Stats per status (no pagination)
        db
          .select({ status: projects.status, cnt: count() })
          .from(projects)
          .where(and(
            isNull(projects.deletedAt),
            query.orgId && orgIds.includes(Number(query.orgId))
              ? eq(projects.orgId, Number(query.orgId))
              : inArray(projects.orgId, orgIds),
          ))
          .groupBy(projects.status),

        db.query.projects.findMany({
          where: whereClause,
          with: {
            organization: {
              columns: { id: true, nameTh: true, nameEn: true, orgLevel: true },
            },
            lead: {
              columns: { id: true, nameTh: true, username: true },
            },
            details: {
              columns: { id: true, projectManagerId: true },
              with: {
                projectManager: {
                  columns: { id: true, nameTh: true, username: true },
                },
              },
              limit: 1,
            },
          },
          orderBy: [
            sql`COALESCE(${projects.parentId}, ${projects.id}) DESC`,
            sql`${projects.parentId} IS NOT NULL ASC`,
            asc(projects.id)
          ],
          limit,
          offset,
        }),
      ]);

      const total = Number(totalRows[0]?.total ?? 0);

      // Build stats map
      const stats: Record<string, number> = {};
      for (const row of statsRows) {
        if (row.status) stats[row.status] = Number(row.cnt);
      }

      const data = rows.map((p) => ({
        id:              p.id,
        parentId:        p.parentId,
        projectCode:     p.projectCode,
        projectName:     p.projectName,
        projectType:     p.projectType,
        year:            p.year,
        status:          p.status,
        initialBudget:   p.initialBudget,
        allocatedBudget: p.allocatedBudget,
        actualValue:     p.actualValue,
        organization:    p.organization,
        lead:            p.lead,
        manager:         p.details?.[0]?.projectManager ?? null,
        createdAt:       p.createdAt,
        startedAt:       p.startedAt,
      }));

      return { success: true, data, total, page, limit, stats };
    },
    {
      query: t.Object({
        page:   t.Optional(t.String()),
        limit:  t.Optional(t.String()),
        search: t.Optional(t.String()),
        orgId:  t.Optional(t.String()),
        year:   t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
    }
  )

  // -----------------------------------------------
  // GET /api/projects/years — ดึงปีงบประมาณที่มีในระบบ
  // -----------------------------------------------
  .get(
    "/years",
    async ({ auth, set }) => {
      if (!auth.role || !auth.orgId) {
        set.status = 403;
        return { success: false, message: "กรุณาเลือกสังกัดก่อน" };
      }

      const { orgIds } = await getAccessibleOrgIds(auth.role, auth.orgId);
      if (orgIds.length === 0) {
        return { success: true, data: [] };
      }

      const rows = await db
        .selectDistinct({ year: projects.year })
        .from(projects)
        .where(
          and(
            isNull(projects.deletedAt),
            inArray(projects.orgId, orgIds),
          )
        )
        .orderBy(desc(projects.year));

      return { success: true, data: rows.map((r) => r.year).filter(Boolean) };
    }
  )

  // -----------------------------------------------
  // GET /api/projects/:id — ดึงข้อมูลโครงการรายเดี่ยว
  // -----------------------------------------------
  .get(
    "/:id",
    async ({ auth, params, set }) => {
      if (!auth.role || !auth.orgId) {
        set.status = 403;
        return { success: false, message: "กรุณาเลือกสังกัดก่อน" };
      }

      const projectId = Number(params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        set.status = 400;
        return { success: false, message: "รหัสโครงการไม่ถูกต้อง" };
      }

      const { orgIds } = await getAccessibleOrgIds(auth.role, auth.orgId);

      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
        with: {
          organization: { columns: { id: true, nameTh: true, nameEn: true } },
          lead: { columns: { id: true, nameTh: true, username: true } },
          details: {
            with: {
              sdgs: true,
              targets: true,
            }
          },
        },
      });

      if (!project) {
        set.status = 404;
        return { success: false, message: "ไม่พบโครงการ" };
      }

      if (!orgIds.includes(project.orgId)) {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์เข้าถึงโครงการนี้" };
      }

      const [subRow] = await db
        .select({ cnt: count() })
        .from(projects)
        .where(and(eq(projects.parentId, projectId), isNull(projects.deletedAt)));

      return {
        success: true,
        data: {
          ...project,
          subProjectCount: Number(subRow?.cnt ?? 0),
        },
      };
    },
    { params: t.Object({ id: t.String() }) }
  )

  // -----------------------------------------------
  // PATCH /api/projects/:id — แก้ไขข้อมูลโครงการ (Step 1 Basic Info)
  // -----------------------------------------------
  .patch(
    "/:id",
    async ({ auth, params, body, set }) => {
      if (!auth.role || !auth.orgId) {
        set.status = 403;
        return { success: false, message: "กรุณาเลือกสังกัดก่อน" };
      }
      
      const projectId = Number(params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        set.status = 400;
        return { success: false, message: "รหัสโครงการไม่ถูกต้อง" };
      }

      const { projectName, initialBudget, departmentId, year, documentReference, notes, responsibleUserId, leadUserId } = body;
      console.log("PATCH BODY STEP 1:", body);

      try {
        await db.transaction(async (tx: any) => {
          // 1. Validate permissions
          const exProject = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);
          if (exProject.length === 0) throw new Error("ไม่พบโครงการ");

          // 2. Validate responsibleUserId and leadUserId
          let safeResponsibleId: number | null = null;
          if (responsibleUserId) {
            const ex = await tx.select({ id: users.id }).from(users).where(eq(users.id, Number(responsibleUserId))).limit(1);
            safeResponsibleId = ex.length > 0 ? Number(responsibleUserId) : null;
          }
          let safeLeadId: number | null = null;
          if (leadUserId) {
            const ex = await tx.select({ id: users.id }).from(users).where(eq(users.id, Number(leadUserId))).limit(1);
            safeLeadId = ex.length > 0 ? Number(leadUserId) : null;
          }

          // 3. Update parent budget (if sub-project budget changes)
          if (exProject[0].parentId && exProject[0].projectType === 'sub' && initialBudget !== undefined) {
             const oldBudget = parseFloat(String(exProject[0].initialBudget || 0));
             const newBudget = parseFloat(String(initialBudget || 0));
             const diff = newBudget - oldBudget;
             if (diff !== 0) {
                const [parent] = await tx.select({ allocatedBudget: projects.allocatedBudget }).from(projects).where(eq(projects.id, exProject[0].parentId)).limit(1);
                if (parent) {
                   const oldParentRemaining = parseFloat(String(parent.allocatedBudget ?? 0));
                   const newParentRemaining = Math.max(0, oldParentRemaining - diff);
                   await tx.update(projects).set({ allocatedBudget: String(newParentRemaining) }).where(eq(projects.id, exProject[0].parentId));
                }
             }
          }

          // 3b. Compute level and generate projectCode if missing
          const isSubProject = !!(exProject[0].parentId && exProject[0].projectType === 'sub');
          const computedLevel = isSubProject ? 1 : 0;

          let newProjectCode: string | undefined = undefined;
          if (!exProject[0].projectCode) {
            if (isSubProject) {
              // Get parent projectCode and count siblings
              const [parentRow] = await tx.select({ projectCode: projects.projectCode })
                .from(projects).where(eq(projects.id, exProject[0].parentId!)).limit(1);
              const [siblingCount] = await tx.select({ cnt: count() })
                .from(projects)
                .where(and(eq(projects.parentId, exProject[0].parentId!), isNull(projects.deletedAt)));
              const seq = Number(siblingCount?.cnt ?? 1);
              newProjectCode = `${parentRow?.projectCode || 'P'}-${String(seq).padStart(2, '0')}`;
            } else {
              // main project: use id as suffix
              newProjectCode = `P-${String(projectId).padStart(5, '0')}`;
            }
          }

          // 4. Update projects table
          await tx.update(projects).set({
            projectName,
            initialBudget: initialBudget !== undefined ? String(initialBudget) : undefined,
            year: year || undefined,
            documentReference: documentReference !== undefined ? documentReference : undefined,
            notes: notes !== undefined ? notes : undefined,
            leadUserId: leadUserId !== undefined ? safeLeadId : undefined,
            level: computedLevel,
            ...(newProjectCode ? { projectCode: newProjectCode } : {}),
            updatedAt: new Date(),
          }).where(eq(projects.id, projectId));

          // 5. Update project_details table
          const [detail] = await tx.select({ id: projectDetails.id }).from(projectDetails).where(eq(projectDetails.projectId, projectId)).limit(1);
          if (detail) {
            await tx.update(projectDetails).set({
              projectManagerId: responsibleUserId !== undefined ? safeResponsibleId : undefined,
              departmentId: departmentId ? Number(departmentId) : null,
            }).where(eq(projectDetails.projectId, projectId));
          } else {
            await tx.insert(projectDetails).values({
              projectId,
              projectManagerId: safeResponsibleId,
              departmentId: departmentId ? Number(departmentId) : null,
            });
          }
        });
        return { success: true };
      } catch (error: any) {
        console.error("PATCH /api/projects/:id error:", error);
        set.status = 500;
        return { success: false, message: "บันทึกแก้ไขไม่สำเร็จ", error: String(error) };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        projectName: t.Optional(t.String()),
        initialBudget: t.Optional(t.Union([t.Number(), t.String()])),
        departmentId: t.Optional(t.Union([t.Number(), t.Null()])),
        year: t.Optional(t.String()),
        documentReference: t.Optional(t.Union([t.String(), t.Null()])),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
        responsibleUserId: t.Optional(t.Union([t.Number(), t.Null()])),
        leadUserId: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    }
  )

  // -----------------------------------------------
  // POST /api/projects — Step 1: สร้างโครงการ + project_details เปล่า
  // -----------------------------------------------
  .post(
    "/",
    async ({ auth, body, set }) => {
      if (!auth.role || !auth.orgId) {
        set.status = 403;
        return { success: false, message: "กรุณาเลือกสังกัดก่อน" };
      }
      const { parentId, projectName, initialBudget, orgId, departmentId, year, documentReference, notes, projectType, responsibleUserId, leadUserId } = body;

      try {
        const result = await db.transaction(async (tx: any) => {
          // Validate responsibleUserId and leadUserId
          let safeResponsibleId: number | null = null;
          if (responsibleUserId) {
            const ex = await tx.select({ id: users.id }).from(users).where(eq(users.id, Number(responsibleUserId))).limit(1);
            safeResponsibleId = ex.length > 0 ? Number(responsibleUserId) : null;
          }
          let safeLeadId: number | null = null;
          if (leadUserId) {
            const ex = await tx.select({ id: users.id }).from(users).where(eq(users.id, Number(leadUserId))).limit(1);
            safeLeadId = ex.length > 0 ? Number(leadUserId) : null;
          }

          // 1) Create project row
          const [newProject] = await tx.insert(projects).values({
            parentId: parentId || null,
            projectName,
            initialBudget: String(initialBudget || 0),
            allocatedBudget: String(initialBudget || 0),
            orgId: Number(orgId),
            year: year || "2568",
            documentReference: documentReference || null,
            notes: notes || null,
            projectType: projectType || "sub",
            status: "draft",
            leadUserId: safeLeadId,
            createdBy: auth.user.id,
          }).returning();

          // 2) Create project_details skeleton (needed for FK chain later)
          await tx.insert(projectDetails).values({
            projectId: newProject.id,
            projectManagerId: safeResponsibleId,
            departmentId: departmentId ? Number(departmentId) : null,
          });

          // 3) Deduct parent allocatedBudget
          if (parentId && initialBudget) {
            const subBudget = parseFloat(String(initialBudget));
            if (subBudget > 0) {
              const [parent] = await tx.select({ allocatedBudget: projects.allocatedBudget })
                .from(projects).where(eq(projects.id, Number(parentId))).limit(1);
              const newRemaining = Math.max(0, parseFloat(String(parent?.allocatedBudget ?? 0)) - subBudget);
              await tx.update(projects).set({ allocatedBudget: String(newRemaining) }).where(eq(projects.id, Number(parentId)));
            }
          }
          return newProject;
        });
        return { success: true, data: result };
      } catch (error: any) {
        console.error("POST /api/projects error:", error);
        set.status = 500;
        return { success: false, message: "บันทึกโครงการไม่สำเร็จ", error: String(error) };
      }
    },
    {
      body: t.Object({
        parentId: t.Optional(t.Union([t.Number(), t.Null()])),
        projectName: t.String(),
        initialBudget: t.Optional(t.Union([t.Number(), t.String()])),
        orgId: t.Number(),
        departmentId: t.Optional(t.Union([t.Number(), t.Null()])),
        year: t.Optional(t.String()),
        documentReference: t.Optional(t.Union([t.String(), t.Null()])),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
        projectType: t.Optional(t.String()),
        responsibleUserId: t.Optional(t.Union([t.Number(), t.Null()])),
        leadUserId: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    }
  )

  // -----------------------------------------------
  // PATCH /api/projects/:id/details — Step 2: บันทึกรายละเอียดโครงการ + SDGs
  // -----------------------------------------------
  .patch(
    "/:id/details",
    async ({ auth, params, body, set }) => {
      if (!auth.role) { set.status = 403; return { success: false, message: "กรุณาเข้าสู่ระบบ" }; }
      const projectId = Number(params.id);
      const { orgId, budgetTypeId, budgetGroupId, year, leadUserId, rationale, objectives, targetGroup, sdgs, strategyAlignments } = body;

      try {
        await db.transaction(async (tx: any) => {
          // Validate leadUserId
          let safeLeadId: number | null = null;
          if (leadUserId) {
            const ex = await tx.select({ id: users.id }).from(users).where(eq(users.id, Number(leadUserId))).limit(1);
            safeLeadId = ex.length > 0 ? Number(leadUserId) : null;
          }

          // Update project row
          await tx.update(projects).set({
            orgId: orgId ? Number(orgId) : undefined,
            budgetTypeId: budgetTypeId ? Number(budgetTypeId) : null,
            budgetGroupId: budgetGroupId ? Number(budgetGroupId) : null,
            year: year || undefined,
            leadUserId: leadUserId !== undefined ? safeLeadId : undefined,
          }).where(eq(projects.id, projectId));

          // Update project_details
          const [detail] = await tx.select({ id: projectDetails.id }).from(projectDetails)
            .where(eq(projectDetails.projectId, projectId)).limit(1);

          if (detail) {
            await tx.update(projectDetails).set({
              principlesAndReasons: rationale || null,
              objectives: objectives || null,
              targetGroup: targetGroup || null,
              strategyAlignments: strategyAlignments || null,
            }).where(eq(projectDetails.projectId, projectId));
          } else {
            await tx.insert(projectDetails).values({
              projectId,
              principlesAndReasons: rationale || null,
              objectives: objectives || null,
              targetGroup: targetGroup || null,
              strategyAlignments: strategyAlignments || null,
            });
          }

          // Handle SDGs: delete old + insert new
          const [detailRow] = await tx.select({ id: projectDetails.id }).from(projectDetails)
            .where(eq(projectDetails.projectId, projectId)).limit(1);
          if (detailRow) {
            await tx.delete(projectDetailSdgs).where(eq(projectDetailSdgs.projectDetailId, detailRow.id));
            if (sdgs && sdgs.length > 0) {
              await tx.insert(projectDetailSdgs).values(
                sdgs.map((sdgId: number) => ({ projectDetailId: detailRow.id, sdgId }))
              );
            }
          }
        });
        return { success: true };
      } catch (error: any) {
        console.error("PATCH /api/projects/:id/details error:", error);
        set.status = 500;
        return { success: false, message: "บันทึกรายละเอียดไม่สำเร็จ", error: String(error) };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        orgId: t.Optional(t.Union([t.Number(), t.Null()])),
        budgetTypeId: t.Optional(t.Union([t.Number(), t.Null()])),
        budgetGroupId: t.Optional(t.Union([t.Number(), t.Null()])),
        year: t.Optional(t.String()),
        leadUserId: t.Optional(t.Union([t.Number(), t.Null()])),
        rationale: t.Optional(t.String()),
        objectives: t.Optional(t.String()),
        targetGroup: t.Optional(t.String()),
        sdgs: t.Optional(t.Array(t.Number())),
        strategyAlignments: t.Optional(t.Any()),
      }),
    }
  )

  // -----------------------------------------------
  // PATCH /api/projects/:id/targets — Step 3: บันทึกเป้าหมาย/ตัวชี้วัด
  // -----------------------------------------------
  .patch(
    "/:id/targets",
    async ({ auth, params, body, set }) => {
      if (!auth.role) { set.status = 403; return { success: false, message: "กรุณาเข้าสู่ระบบ" }; }
      const projectId = Number(params.id);
      const { targets } = body;

      try {
        await db.transaction(async (tx: any) => {
          const [detail] = await tx.select({ id: projectDetails.id }).from(projectDetails)
            .where(eq(projectDetails.projectId, projectId)).limit(1);
          if (!detail) throw new Error("ไม่พบ project_details");

          // Delete & re-insert targets
          await tx.delete(projectTargets).where(eq(projectTargets.projectDetailId, detail.id));

          if (targets && targets.length > 0) {
            const targetValues = targets.map((t: any, idx: number) => {
              const rawValue = String(t.value || "").trim();
              const parsedNum = parseFloat(rawValue.replace(/[^\d.-]/g, ''));
              let numericValue = "0";
              let desc = t.name;
              if (!isNaN(parsedNum) && rawValue !== "") {
                numericValue = String(parsedNum);
                if (/[^\d.,-\s%]/.test(rawValue)) desc = `${t.name} (เป้าหมาย: ${rawValue})`;
              } else if (rawValue !== "") {
                desc = `${t.name} (เป้าหมาย: ${rawValue})`;
              }
              return {
                projectDetailId: detail.id,
                targetDescription: desc,
                targetValue: numericValue,
                measurementUnit: t.unit || "",
                orderNumber: idx + 1,
              };
            });
            await tx.insert(projectTargets).values(targetValues);
          }

          // Mark project as draft saved
          await tx.update(projects).set({ status: "draft" }).where(eq(projects.id, projectId));
        });
        return { success: true };
      } catch (error: any) {
        console.error("PATCH /api/projects/:id/targets error:", error);
        set.status = 500;
        return { success: false, message: "บันทึกเป้าหมายไม่สำเร็จ", error: String(error) };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        targets: t.Array(t.Object({
          name: t.String(),
          value: t.Optional(t.String()),
          unit: t.Optional(t.String()),
        })),
      }),
    }
  );

