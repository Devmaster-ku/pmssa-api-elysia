import { Elysia, t } from "elysia";
import { db } from "../db";
import { organizations } from "../schema";
import { eq, and, isNull } from "drizzle-orm";
import { authMiddleware, getAccessibleOrgIds } from "../middleware/auth";

export const organizationRoutes = new Elysia({ prefix: "/api/organizations" })
  .use(authMiddleware)

  // -----------------------------------------------
  // GET /api/organizations — ดึงรายการหน่วยงาน (ตาม scope)
  // -----------------------------------------------
  .get("/", async ({ auth, set }) => {
    if (!auth.role || !auth.orgId) {
      set.status = 403;
      return { success: false, message: "กรุณาเลือกสังกัดก่อน" };
    }

    const { orgIds, readOnly } = await getAccessibleOrgIds(
      auth.role,
      auth.orgId
    );

    if (orgIds.length === 0) {
      return { success: true, data: [], readOnly };
    }

    const allOrgs = await db.query.organizations.findMany({
      where: eq(organizations.isActive, true),
    });

    // กรองเฉพาะ org ที่เข้าถึงได้
    const accessibleSet = new Set(orgIds);
    const data = allOrgs
      .filter((org) => accessibleSet.has(org.id))
      .map((org) => ({
        id: org.id,
        code: org.code,
        nameTh: org.nameTh,
        nameEn: org.nameEn,
        orgLevel: org.orgLevel,
        parentId: org.parentId,
        campusId: org.campusId,
      }));

    return { success: true, data, readOnly, total: data.length };
  })

  // -----------------------------------------------
  // GET /api/organizations/:id — ดูรายละเอียดหน่วยงาน
  // -----------------------------------------------
  .get("/:id", async ({ params, auth, set }) => {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, Number(params.id)),
    });

    if (!org) {
      set.status = 404;
      return { success: false, message: "ไม่พบหน่วยงาน" };
    }

    // ตรวจสอบสิทธิ์เข้าถึง
    if (auth.role && auth.orgId) {
      const { orgIds } = await getAccessibleOrgIds(auth.role, auth.orgId);
      if (!orgIds.includes(org.id)) {
        set.status = 403;
        return { success: false, message: "ไม่มีสิทธิ์เข้าถึงหน่วยงานนี้" };
      }
    }

    // ดึง children
    const children = await db.query.organizations.findMany({
      where: and(
        eq(organizations.parentId, org.id),
        eq(organizations.isActive, true)
      ),
    });

    return {
      success: true,
      organization: {
        id: org.id,
        code: org.code,
        nameTh: org.nameTh,
        nameEn: org.nameEn,
        orgLevel: org.orgLevel,
        parentId: org.parentId,
        campusId: org.campusId,
        isActive: org.isActive,
      },
      children: children.map((c) => ({
        id: c.id,
        code: c.code,
        nameTh: c.nameTh,
        nameEn: c.nameEn,
        orgLevel: c.orgLevel,
      })),
    };
  })

  // -----------------------------------------------
  // GET /api/organizations/:id/tree — โครงสร้างลำดับชั้น
  // -----------------------------------------------
  .get("/:id/tree", async ({ params, set }) => {
    const root = await db.query.organizations.findFirst({
      where: eq(organizations.id, Number(params.id)),
    });

    if (!root) {
      set.status = 404;
      return { success: false, message: "ไม่พบหน่วยงาน" };
    }

    // ดึงทั้งหมดแล้วสร้าง tree ใน memory
    const allOrgs = await db.query.organizations.findMany({
      where: eq(organizations.isActive, true),
    });

    type OrgNode = {
      id: number;
      code: string;
      nameTh: string;
      nameEn: string | null;
      orgLevel: string;
      children: OrgNode[];
    };

    function buildTree(parentId: number): OrgNode[] {
      return allOrgs
        .filter((o) => o.parentId === parentId)
        .map((o) => ({
          id: o.id,
          code: o.code,
          nameTh: o.nameTh,
          nameEn: o.nameEn,
          orgLevel: o.orgLevel,
          children: buildTree(o.id),
        }));
    }

    const tree: OrgNode = {
      id: root.id,
      code: root.code,
      nameTh: root.nameTh,
      nameEn: root.nameEn,
      orgLevel: root.orgLevel,
      children: buildTree(root.id),
    };

    return { success: true, tree };
  });
