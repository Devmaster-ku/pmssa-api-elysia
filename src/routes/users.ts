import { Elysia, t } from "elysia";
import { db } from "../db";
import { users, userAffiliations, organizations } from "../schema";
import { eq, and, inArray, like, or, ne } from "drizzle-orm";
import {
  authMiddleware,
  getAccessibleOrgIds,
  isViewOnlyRole,
  ORG_ADMIN_ASSIGNABLE_ROLES,
} from "../middleware/auth";

export const userRoutes = new Elysia({ prefix: "/api/users" })
  .use(authMiddleware)

  // -----------------------------------------------
  // GET /api/users — ดึงรายการผู้ใช้ (ตาม scope ของ active affiliation)
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
        return { success: true, data: [], total: 0 };
      }

      // ดึง user ที่มี affiliation ใน org ที่เข้าถึงได้
      const affiliations = await db.query.userAffiliations.findMany({
        where: and(
          inArray(userAffiliations.orgId, orgIds),
          eq(userAffiliations.isActive, true)
        ),
        with: {
          user: true,
          organization: true,
          subDep: true,
        },
      });

      // Group by user (ไม่ซ้ำ)
      const userMap = new Map<
        number,
        {
          user: typeof affiliations[0]["user"];
          affiliations: typeof affiliations;
        }
      >();

      for (const aff of affiliations) {
        if (!userMap.has(aff.user.id)) {
          userMap.set(aff.user.id, { user: aff.user, affiliations: [] });
        }
        userMap.get(aff.user.id)!.affiliations.push(aff);
      }

      const data = Array.from(userMap.values()).map(({ user, affiliations }) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        nameTh: user.nameTh,
        nameEn: user.nameEn,
        phone: user.phone,
        avatar: user.avatar,
        isActive: user.isActive,
        affiliations: affiliations.map((a) => ({
          id: a.id,
          role: a.role,
          positionTitle: a.positionTitle,
          isPrimary: a.isPrimary,
          organization: {
            id: a.organization.id,
            nameTh: a.organization.nameTh,
            nameEn: a.organization.nameEn,
            orgLevel: a.organization.orgLevel,
          },
          subDep: a.subDep ? {
            id: a.subDep.id,
            nameTh: a.subDep.nameTh,
            nameEn: a.subDep.nameEn,
            orgLevel: a.subDep.orgLevel,
          } : null,
        })),
      }));

      return { success: true, data, total: data.length };
    },
    {
      query: t.Optional(
        t.Object({
          search: t.Optional(t.String()),
        })
      ),
    }
  )

  // -----------------------------------------------
  // GET /api/users/:id — ดูข้อมูลผู้ใช้
  // -----------------------------------------------
  .get(
    "/:id",
    async ({ params, auth, set }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(params.id)),
      });

      if (!user) {
        set.status = 404;
        return { success: false, message: "ไม่พบผู้ใช้" };
      }

      const affiliations = await db.query.userAffiliations.findMany({
        where: and(
          eq(userAffiliations.userId, user.id),
          eq(userAffiliations.isActive, true)
        ),
        with: { organization: true, subDep: true },
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nameTh: user.nameTh,
          nameEn: user.nameEn,
          phone: user.phone,
          avatar: user.avatar,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
        affiliations: affiliations.map((a) => ({
          id: a.id,
          role: a.role,
          positionTitle: a.positionTitle,
          isPrimary: a.isPrimary,
          startDate: a.startDate,
          endDate: a.endDate,
          organization: {
            id: a.organization.id,
            nameTh: a.organization.nameTh,
            nameEn: a.organization.nameEn,
            orgLevel: a.organization.orgLevel,
          },
          subDep: a.subDep ? {
            id: a.subDep.id,
            nameTh: a.subDep.nameTh,
            nameEn: a.subDep.nameEn,
            orgLevel: a.subDep.orgLevel,
          } : null,
        })),
      };
    }
  )

  // -----------------------------------------------
  // POST /api/users — สร้างผู้ใช้ใหม่
  // -----------------------------------------------
  .post(
    "/",
    async ({ body, auth, set }) => {
      if (auth?.role !== "super_admin" && auth?.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์สร้างผู้ใช้" };
      }

      // ตรวจสอบ username / email ซ้ำ
      const existing = await db.query.users.findFirst({
        where: or(
          eq(users.username, body.username),
          eq(users.email, body.email)
        ),
      });
      if (existing) {
        set.status = 409;
        return {
          success: false,
          message:
            existing.username === body.username
              ? "Username นี้ถูกใช้งานแล้ว"
              : "Email นี้ถูกใช้งานแล้ว",
        };
      }

      // Hash password (ถ้ามี)
      const hashedPwd = body.password
        ? await Bun.password.hash(body.password)
        : null;

      const [result] = await db.insert(users).values({
        username: body.username,
        email: body.email,
        nameTh: body.nameTh,
        nameEn: body.nameEn ?? null,
        phone: body.phone ?? null,
        password: hashedPwd,
        isActive: true,
      });

      const newUserId = Number((result as any).insertId);

      // เพิ่ม affiliation เริ่มต้น (ถ้าระบุ orgId)
      if (body.orgId) {
        // ตรวจสอบว่า org มีอยู่จริงและอยู่ใน scope
        const targetOrg = await db.query.organizations.findFirst({
          where: eq(organizations.id, body.orgId),
        });
        if (targetOrg) {
          if (auth?.role === "org_admin" && auth?.orgId) {
            const { orgIds } = await getAccessibleOrgIds(auth.role, auth.orgId);
            if (!orgIds.includes(body.orgId)) {
              // ลบ user ที่เพิ่งสร้าง แล้ว reject
              await db.delete(users).where(eq(users.id, newUserId));
              set.status = 403;
              return { success: false, message: "ไม่สามารถเพิ่มผู้ใช้ในหน่วยงานนี้ได้" };
            }
          }
          await db.insert(userAffiliations).values({
            userId: newUserId,
            orgId: body.orgId,
            subDepId: body.subDepId ?? null,
            role: (body.role ?? "staff") as any,
            positionTitle: body.positionTitle ?? null,
            isPrimary: true,
            isActive: true,
          }).catch(() => { /* ignore duplicate */ });
        }
      }

      return {
        success: true,
        message: "สร้างผู้ใช้สำเร็จ",
        userId: newUserId,
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 3 }),
        email: t.String({ format: "email" }),
        nameTh: t.String({ minLength: 1 }),
        nameEn: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        password: t.Optional(t.String({ minLength: 6 })),
        orgId: t.Optional(t.Number()),
        subDepId: t.Optional(t.Number()),
        role: t.Optional(t.String()),
        positionTitle: t.Optional(t.String()),
      }),
    }
  )

  // -----------------------------------------------
  // PATCH /api/users/:id — แก้ไขข้อมูลผู้ใช้
  // -----------------------------------------------
  .patch(
    "/:id",
    async ({ params, body, auth, set }) => {
      if (auth?.role !== "super_admin" && auth?.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้" };
      }

      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, Number(params.id)),
      });
      if (!targetUser) {
        set.status = 404;
        return { success: false, message: "ไม่พบผู้ใช้" };
      }

      // ตรวจสอบ email ซ้ำ (ถ้าเปลี่ยน)
      if (body.email && body.email !== targetUser.email) {
        const dup = await db.query.users.findFirst({
          where: and(eq(users.email, body.email), ne(users.id, Number(params.id))),
        });
        if (dup) {
          set.status = 409;
          return { success: false, message: "Email นี้ถูกใช้งานแล้ว" };
        }
      }

      await db.update(users).set({
        nameTh: body.nameTh ?? targetUser.nameTh,
        nameEn: body.nameEn ?? targetUser.nameEn,
        email: body.email ?? targetUser.email,
        phone: body.phone ?? targetUser.phone,
      }).where(eq(users.id, Number(params.id)));

      return { success: true, message: "แก้ไขข้อมูลสำเร็จ" };
    },
    {
      body: t.Object({
        nameTh: t.Optional(t.String({ minLength: 1 })),
        nameEn: t.Optional(t.String()),
        email: t.Optional(t.String({ format: "email" })),
        phone: t.Optional(t.String()),
      }),
    }
  )

  // -----------------------------------------------
  // PATCH /api/users/:id/toggle-active — เปิด/ปิดการใช้งาน
  // -----------------------------------------------
  .patch("/:id/toggle-active", async ({ params, auth, set }) => {
    if (auth?.role !== "super_admin" && auth?.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, Number(params.id)),
    });
    if (!targetUser) {
      set.status = 404;
      return { success: false, message: "ไม่พบผู้ใช้" };
    }

    // ป้องกันการปิดบัญชีตัวเอง
    if (auth?.user && targetUser.id === auth.user.id) {
      set.status = 400;
      return { success: false, message: "ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้" };
    }

    const newStatus = !targetUser.isActive;
    await db.update(users)
      .set({ isActive: newStatus })
      .where(eq(users.id, Number(params.id)));

    return {
      success: true,
      message: newStatus ? "เปิดการใช้งานสำเร็จ" : "ปิดการใช้งานสำเร็จ",
      isActive: newStatus,
    };
  });


// =============================================
// Admin routes — จัดการสังกัด (org_admin+ เท่านั้น)
// =============================================
export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(authMiddleware)

  // -----------------------------------------------
  // POST /api/admin/affiliations — เพิ่มสังกัดให้ผู้ใช้
  // -----------------------------------------------
  .post(
    "/affiliations",
    async ({ body, auth, set }) => {
      // ตรวจสอบสิทธิ์: ต้องเป็น super_admin หรือ org_admin
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      // ตรวจสอบว่า role ที่จะกำหนดอยู่ในขอบเขตที่อนุญาต
      if (
        auth.role === "org_admin" &&
        !(ORG_ADMIN_ASSIGNABLE_ROLES as readonly string[]).includes(body.role)
      ) {
        set.status = 403;
        return {
          success: false,
          message: "ไม่สามารถกำหนดบทบาทนี้ได้ (เกินสิทธิ์ org_admin)",
        };
      }

      // ตรวจสอบว่า org อยู่ใน scope ที่เข้าถึงได้
      if (auth.role === "org_admin" && auth.orgId) {
        const { orgIds } = await getAccessibleOrgIds(auth.role, auth.orgId);
        if (!orgIds.includes(body.orgId)) {
          set.status = 403;
          return {
            success: false,
            message: "ไม่สามารถกำหนดสังกัดในหน่วยงานนี้ได้",
          };
        }
      }

      // ตรวจสอบว่า user และ org มีอยู่จริง
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, body.userId),
      });
      if (!targetUser) {
        set.status = 404;
        return { success: false, message: "ไม่พบผู้ใช้" };
      }

      const targetOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, body.orgId),
      });
      if (!targetOrg) {
        set.status = 404;
        return { success: false, message: "ไม่พบหน่วยงาน" };
      }

      // สร้าง affiliation ใหม่
      const [inserted] = await db.insert(userAffiliations).values({
        userId: body.userId,
        orgId: body.orgId,
        subDepId: body.subDepId ?? null,
        role: body.role as any,
        positionTitle: body.positionTitle ?? null,
        isPrimary: body.isPrimary ?? false,
        isActive: true,
      }).returning({ id: userAffiliations.id });

      return {
        success: true,
        message: "เพิ่มสังกัดสำเร็จ",
        affiliationId: inserted.id,
      };
    },
    {
      body: t.Object({
        userId: t.Number(),
        orgId: t.Number(),
        subDepId: t.Optional(t.Nullable(t.Number())),
        role: t.String(),
        positionTitle: t.Optional(t.String()),
        isPrimary: t.Optional(t.Boolean()),
      }),
    }
  )

  // -----------------------------------------------
  // PUT /api/admin/affiliations/:id — แก้ไขสังกัด
  // -----------------------------------------------
  .put(
    "/affiliations/:id",
    async ({ params, body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      const affiliation = await db.query.userAffiliations.findFirst({
        where: eq(userAffiliations.id, Number(params.id)),
      });

      if (!affiliation) {
        set.status = 404;
        return { success: false, message: "ไม่พบสังกัดที่ระบุ" };
      }

      // ตรวจสอบ scope
      if (auth.role === "org_admin" && auth.orgId) {
        const { orgIds } = await getAccessibleOrgIds(auth.role, auth.orgId);
        if (!orgIds.includes(affiliation.orgId)) {
          set.status = 403;
          return { success: false, message: "ไม่มีสิทธิ์แก้ไขสังกัดนี้" };
        }
      }

      await db
        .update(userAffiliations)
        .set({
          role: body.role as any,
          positionTitle: body.positionTitle,
          isPrimary: body.isPrimary,
          isActive: body.isActive,
        })
        .where(eq(userAffiliations.id, Number(params.id)));

      return { success: true, message: "แก้ไขสังกัดสำเร็จ" };
    },
    {
      body: t.Object({
        role: t.Optional(t.String()),
        positionTitle: t.Optional(t.String()),
        isPrimary: t.Optional(t.Boolean()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )

  // -----------------------------------------------
  // PATCH /api/admin/affiliations/:id — แก้ไขสังกัด (รองรับ orgId)
  // -----------------------------------------------
  .patch(
    "/affiliations/:id",
    async ({ params, body, auth, set }) => {
      if (auth.role !== "super_admin" && auth.role !== "org_admin") {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
      }

      const affiliation = await db.query.userAffiliations.findFirst({
        where: eq(userAffiliations.id, Number(params.id)),
      });

      if (!affiliation) {
        set.status = 404;
        return { success: false, message: "ไม่พบสังกัดที่ระบุ" };
      }

      // ตรวจสอบ scope
      if (auth.role === "org_admin" && auth.orgId) {
        const { orgIds } = await getAccessibleOrgIds(auth.role, auth.orgId);
        if (!orgIds.includes(affiliation.orgId)) {
          set.status = 403;
          return { success: false, message: "ไม่มีสิทธิ์แก้ไขสังกัดนี้" };
        }
        // ตรวจสอบว่า orgId ใหม่อยู่ใน scope ที่เข้าถึงได้
        if (body.orgId !== undefined && !orgIds.includes(body.orgId)) {
          set.status = 403;
          return { success: false, message: "ไม่มีสิทธิ์กำหนดสังกัดไปยังหน่วยงานนี้" };
        }
      }

      const updateData: any = {};
      if (body.role !== undefined) updateData.role = body.role;
      if (body.positionTitle !== undefined) updateData.positionTitle = body.positionTitle;
      if (body.isPrimary !== undefined) updateData.isPrimary = body.isPrimary;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.orgId !== undefined) updateData.orgId = body.orgId;
      if (body.subDepId !== undefined) updateData.subDepId = body.subDepId; // null = ล้างหน่วยงานย่อย

      await db
        .update(userAffiliations)
        .set(updateData)
        .where(eq(userAffiliations.id, Number(params.id)));

      return { success: true, message: "แก้ไขสังกัดสำเร็จ" };
    },
    {
      body: t.Object({
        role: t.Optional(t.String()),
        positionTitle: t.Optional(t.String()),
        isPrimary: t.Optional(t.Boolean()),
        isActive: t.Optional(t.Boolean()),
        orgId: t.Optional(t.Number()),
        subDepId: t.Optional(t.Nullable(t.Number())),
      }),
    }
  )

  // -----------------------------------------------
  // DELETE /api/admin/affiliations/:id — ลบสังกัด (soft delete)
  // -----------------------------------------------
  .delete("/affiliations/:id", async ({ params, auth, set }) => {
    if (auth.role !== "super_admin" && auth.role !== "org_admin") {
      set.status = 403;
      return { success: false, message: "ไม่มีสิทธิ์ดำเนินการ" };
    }

    const affiliation = await db.query.userAffiliations.findFirst({
      where: eq(userAffiliations.id, Number(params.id)),
    });

    if (!affiliation) {
      set.status = 404;
      return { success: false, message: "ไม่พบสังกัดที่ระบุ" };
    }

    // Soft delete — set isActive = false
    await db
      .update(userAffiliations)
      .set({ isActive: false })
      .where(eq(userAffiliations.id, Number(params.id)));

    return { success: true, message: "ลบสังกัดสำเร็จ" };
  });
