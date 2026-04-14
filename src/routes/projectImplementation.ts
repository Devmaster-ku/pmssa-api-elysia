import { Elysia, t } from "elysia";
import { db } from "../db";
import {
  projects,
  users,
  projectImplementations,
  projectOperators,
  projectFundingSources,
  projectWorkPlans,
  projectBudgetUsages,
  projectSignatories,
  budgetExpenseDetails,
} from "../schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { authMiddleware, getAccessibleOrgIds } from "../middleware/auth";

export const projectImplementationRoutes = new Elysia({
  prefix: "/api/projects",
})
  .use(authMiddleware)

  // -----------------------------------------------
  // GET /api/projects/budget-expense-options
  // ดึง budget_expense_details ทั้ง main และ sub (isActive=true) สำหรับ dropdown
  // -----------------------------------------------
  .get("/budget-expense-options", async ({ auth, set }) => {
    if (!auth?.role) {
      set.status = 401;
      return { success: false, message: "กรุณาเข้าสู่ระบบ" };
    }
    const data = await db.query.budgetExpenseDetails.findMany({
      where: (t, { eq }) => eq(t.isActive, true),
      columns: { id: true, name: true, detailType: true, parentId: true },
      orderBy: (t, { asc }) => [asc(t.name)],
    });
    return { success: true, data };
  })

  // -----------------------------------------------
  // GET /api/projects/:id/implementation
  // ดึงข้อมูลการดำเนินโครงการทั้งหมด
  // -----------------------------------------------
  .get(
    "/:id/implementation",
    async ({ auth, params, set }) => {
      if (!auth?.role || !auth?.orgId) {
        set.status = 403;
        return { success: false, message: "กรุณาเลือกสังกัดก่อน" };
      }

      const projectId = Number(params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        set.status = 400;
        return { success: false, message: "รหัสโครงการไม่ถูกต้อง" };
      }

      // Verify project exists and user has access
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
        with: {
          organization: {
            columns: { id: true, nameTh: true, nameEn: true },
          },
          lead: { columns: { id: true, nameTh: true, username: true } },
          budgetGroup: { columns: { name: true } },
        },
      });

      if (!project) {
        set.status = 404;
        return { success: false, message: "ไม่พบโครงการ" };
      }

      const { orgIds } = await getAccessibleOrgIds(auth.role, auth.orgId);
      if (!orgIds.includes(project.orgId)) {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์เข้าถึงโครงการนี้" };
      }

      // Fetch implementation data
      const impl = await db.query.projectImplementations.findFirst({
        where: eq(projectImplementations.projectId, projectId),
        with: {
          operators: {
            orderBy: [asc(projectOperators.orderNumber)],
          },
          fundingSources: {
            orderBy: [asc(projectFundingSources.orderNumber)],
          },
          workPlans: {
            orderBy: [asc(projectWorkPlans.orderNumber)],
          },
          budgetUsages: {
            orderBy: [asc(projectBudgetUsages.orderNumber)],
          },
          signatories: {
            orderBy: [asc(projectSignatories.signOrder)],
          },
        },
      });

      return {
        success: true,
        data: {
          project: {
            id: project.id,
            projectName: project.projectName,
            projectCode: project.projectCode,
            projectType: project.projectType,
            initialBudget: project.initialBudget,
            allocatedBudget: project.allocatedBudget,
            year: project.year,
            status: project.status,
            organization: project.organization,
            lead: project.lead,
            budgetGroupName: project.budgetGroup?.name || "ไม่ระบุกลุ่มงบ",
          },
          implementation: impl || null,
        },
      };
    },
    { params: t.Object({ id: t.String() }) }
  )

  // -----------------------------------------------
  // POST /api/projects/:id/implementation/step1
  // บันทึกขั้นตอนที่ 1: ข้อมูลการดำเนินโครงการ
  // -----------------------------------------------
  .post(
    "/:id/implementation/step1",
    async ({ auth, params, body, set }) => {
      if (!auth?.role) {
        set.status = 403;
        return { success: false, message: "กรุณาเข้าสู่ระบบ" };
      }

      const projectId = Number(params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        set.status = 400;
        return { success: false, message: "รหัสโครงการไม่ถูกต้อง" };
      }

      const {
        pastPerformance,
        riskManagement,
        startDate,
        endDate,
        projectLocation,
        province,
        operators,
        fundingSources,
        workPlans,
      } = body;

      try {
        const result = await db.transaction(async (tx: any) => {
          // Check if implementation already exists
          const [existing] = await tx
            .select({ id: projectImplementations.id })
            .from(projectImplementations)
            .where(eq(projectImplementations.projectId, projectId))
            .limit(1);

          let implId: number;

          if (existing) {
            // Update existing
            await tx
              .update(projectImplementations)
              .set({
                pastPerformance: pastPerformance ?? null,
                riskManagement: riskManagement ?? null,
                startDate: startDate ?? null,
                endDate: endDate ?? null,
                projectLocation: projectLocation ?? null,
                province: province ?? null,
                currentStep: 1,
                updatedAt: new Date(),
              })
              .where(eq(projectImplementations.id, existing.id));
            implId = existing.id;
          } else {
            // Create new
            const [newImpl] = await tx
              .insert(projectImplementations)
              .values({
                projectId,
                pastPerformance: pastPerformance ?? null,
                riskManagement: riskManagement ?? null,
                startDate: startDate ?? null,
                endDate: endDate ?? null,
                projectLocation: projectLocation ?? null,
                province: province ?? null,
                currentStep: 1,
              })
              .returning();
            implId = newImpl.id;
          }

          // ── ผู้ดำเนินโครงการ: delete + re-insert ──
          await tx
            .delete(projectOperators)
            .where(eq(projectOperators.implementationId, implId));
          if (operators && operators.length > 0) {
            await tx.insert(projectOperators).values(
              operators.map((op: any, idx: number) => ({
                implementationId: implId,
                userId: op.userId || null,
                operatorName: op.operatorName || null,
                responsibility: op.responsibility || null,
                orderNumber: idx + 1,
              }))
            );
          }

          // ── งบประมาณและแหล่งเงิน ──
          await tx
            .delete(projectFundingSources)
            .where(eq(projectFundingSources.implementationId, implId));
          if (fundingSources && fundingSources.length > 0) {
            await tx.insert(projectFundingSources).values(
              fundingSources.map((fs: any, idx: number) => ({
                implementationId: implId,
                fundingGroup: fs.fundingGroup || "main",
                fundingName: fs.fundingName || null,
                amount: String(fs.amount || 0),
                fundingType: fs.fundingType || null,
                orderNumber: idx + 1,
              }))
            );
          }

          // ── แผนการดำเนินงาน ──
          await tx
            .delete(projectWorkPlans)
            .where(eq(projectWorkPlans.implementationId, implId));
          if (workPlans && workPlans.length > 0) {
            await tx.insert(projectWorkPlans).values(
              workPlans.map((wp: any, idx: number) => ({
                implementationId: implId,
                title: wp.title || "แผนงาน",
                description: wp.description || null,
                startDate: wp.startDate || null,
                endDate: wp.endDate || null,
                responsiblePerson: wp.responsiblePerson || null,
                status: wp.status || "pending",
                orderNumber: idx + 1,
              }))
            );
          }

          return { implId };
        });

        return { success: true, data: result };
      } catch (error: any) {
        console.error("POST implementation/step1 error:", error);
        set.status = 500;
        return {
          success: false,
          message: "บันทึกข้อมูลไม่สำเร็จ",
          error: String(error),
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        pastPerformance: t.Optional(t.Union([t.String(), t.Null()])),
        riskManagement: t.Optional(t.Union([t.String(), t.Null()])),
        startDate: t.Optional(t.Union([t.String(), t.Null()])),
        endDate: t.Optional(t.Union([t.String(), t.Null()])),
        projectLocation: t.Optional(t.Union([t.String(), t.Null()])),
        province: t.Optional(t.Union([t.String(), t.Null()])),
        operators: t.Optional(
          t.Array(
            t.Object({
              userId: t.Optional(t.Union([t.Number(), t.Null()])),
              operatorName: t.Optional(t.Union([t.String(), t.Null()])),
              responsibility: t.Optional(t.Union([t.String(), t.Null()])),
            })
          )
        ),
        fundingSources: t.Optional(
          t.Array(
            t.Object({
              fundingGroup: t.Optional(t.String()),
              fundingName: t.Optional(t.Union([t.String(), t.Null()])),
              amount: t.Optional(t.Union([t.Number(), t.String()])),
              fundingType: t.Optional(t.Union([t.String(), t.Null()])),
            })
          )
        ),
        workPlans: t.Optional(
          t.Array(
            t.Object({
              title: t.String(),
              description: t.Optional(t.Union([t.String(), t.Null()])),
              startDate: t.Optional(t.Union([t.String(), t.Null()])),
              endDate: t.Optional(t.Union([t.String(), t.Null()])),
              responsiblePerson: t.Optional(
                t.Union([t.String(), t.Null()])
              ),
              status: t.Optional(t.String()),
            })
          )
        ),
      }),
    }
  )

  // -----------------------------------------------
  // POST /api/projects/:id/implementation/step2
  // บันทึกขั้นตอนที่ 2: งบประมาณและการประเมินผล
  // -----------------------------------------------
  .post(
    "/:id/implementation/step2",
    async ({ auth, params, body, set }) => {
      if (!auth?.role) {
        set.status = 403;
        return { success: false, message: "กรุณาเข้าสู่ระบบ" };
      }

      const projectId = Number(params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        set.status = 400;
        return { success: false, message: "รหัสโครงการไม่ถูกต้อง" };
      }

      const { evaluationMethod, expectedOutcome, budgetUsages, signatories } =
        body;

      try {
        await db.transaction(async (tx: any) => {
          // Get or create implementation
          let [impl] = await tx
            .select({ id: projectImplementations.id })
            .from(projectImplementations)
            .where(eq(projectImplementations.projectId, projectId))
            .limit(1);

          if (!impl) {
            const [newImpl] = await tx
              .insert(projectImplementations)
              .values({ projectId, currentStep: 2 })
              .returning();
            impl = newImpl;
          }

          // Update implementation fields
          await tx
            .update(projectImplementations)
            .set({
              evaluationMethod: evaluationMethod ?? null,
              expectedOutcome: expectedOutcome ?? null,
              currentStep: 2,
              updatedAt: new Date(),
            })
            .where(eq(projectImplementations.id, impl.id));

          // ── Budget usages: delete + re-insert ──
          await tx
            .delete(projectBudgetUsages)
            .where(eq(projectBudgetUsages.implementationId, impl.id));

          if (budgetUsages && budgetUsages.length > 0) {
            // Insert main items first, then sub items
            for (const [idx, bu] of budgetUsages.entries()) {
              const [mainRow] = await tx
                .insert(projectBudgetUsages)
                .values({
                  implementationId: impl.id,
                  parentId: null,
                  expenseType: bu.expenseType || "main",
                  expenseDetailId: bu.expenseDetailId || null,
                  expenseName: bu.expenseName || null,
                  amount: String(bu.amount || 0),
                  calculationMethod: bu.calculationMethod || null,
                  necessityReason: bu.necessityReason || null,
                  remark: bu.remark || null,
                  personnelCount: bu.personnelCount || null,
                  unitType: bu.unitType || null,
                  orderNumber: idx + 1,
                })
                .returning();

              // Insert sub items
              if (bu.subItems && bu.subItems.length > 0) {
                await tx.insert(projectBudgetUsages).values(
                  bu.subItems.map((sub: any, sIdx: number) => ({
                    implementationId: impl.id,
                    parentId: mainRow.id,
                    expenseType: "sub" as const,
                    expenseDetailId: sub.expenseDetailId || null,
                    expenseName: sub.expenseName || null,
                    amount: String(sub.amount || 0),
                    remark: sub.remark || null,
                    personnelCount: sub.personnelCount || null,
                    unitType: sub.unitType || null,
                    orderNumber: sIdx + 1,
                  }))
                );
              }
            }
          }

          // ── Signatories: delete + re-insert ──
          await tx
            .delete(projectSignatories)
            .where(eq(projectSignatories.implementationId, impl.id));
          if (signatories && signatories.length > 0) {
            await tx.insert(projectSignatories).values(
              signatories.map((s: any, idx: number) => ({
                implementationId: impl.id,
                userId: s.userId || null,
                signatoryName: s.signatoryName || null,
                positionTitle: s.positionTitle || null,
                signOrder: idx + 1,
              }))
            );
          }
        });

        return { success: true };
      } catch (error: any) {
        console.error("POST implementation/step2 error:", error);
        set.status = 500;
        return {
          success: false,
          message: "บันทึกข้อมูลไม่สำเร็จ",
          error: String(error),
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        evaluationMethod: t.Optional(t.Union([t.String(), t.Null()])),
        expectedOutcome: t.Optional(t.Union([t.String(), t.Null()])),
        budgetUsages: t.Optional(
          t.Array(
            t.Object({
              expenseType: t.Optional(t.String()),
              expenseDetailId: t.Optional(t.Union([t.Number(), t.Null()])),
              expenseName: t.Optional(t.Union([t.String(), t.Null()])),
              amount: t.Optional(t.Union([t.Number(), t.String()])),
              calculationMethod: t.Optional(
                t.Union([t.String(), t.Null()])
              ),
              necessityReason: t.Optional(t.Union([t.String(), t.Null()])),
              remark: t.Optional(t.Union([t.String(), t.Null()])),
              personnelCount: t.Optional(t.Union([t.Number(), t.Null()])),
              unitType: t.Optional(t.Union([t.String(), t.Null()])),
              subItems: t.Optional(
                t.Array(
                  t.Object({
                    expenseDetailId: t.Optional(
                      t.Union([t.Number(), t.Null()])
                    ),
                    expenseName: t.Optional(
                      t.Union([t.String(), t.Null()])
                    ),
                    amount: t.Optional(t.Union([t.Number(), t.String()])),
                    remark: t.Optional(t.Union([t.String(), t.Null()])),
                    personnelCount: t.Optional(t.Union([t.Number(), t.Null()])),
                    unitType: t.Optional(t.Union([t.String(), t.Null()])),
                  })
                )
              ),
            })
          )
        ),
        signatories: t.Optional(
          t.Array(
            t.Object({
              userId: t.Optional(t.Union([t.Number(), t.Null()])),
              signatoryName: t.Optional(t.Union([t.String(), t.Null()])),
              positionTitle: t.Optional(t.Union([t.String(), t.Null()])),
            })
          )
        ),
      }),
    }
  );
