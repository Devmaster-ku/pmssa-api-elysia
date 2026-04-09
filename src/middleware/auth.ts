import { Elysia, status } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { bearer } from "@elysiajs/bearer";
import { db } from "../db";
import { users, userAffiliations, organizations } from "../schema";
import { eq, and, inArray } from "drizzle-orm";

// =============================================
// JWT Plugins (shared across routes)
// =============================================
export const jwtPlugin = new Elysia({ name: "jwt-plugin" })
  .use(
    jwt({
      name: "jwtAccess",
      secret: process.env.JWT_SECRET ?? "changeme-please-set-JWT_SECRET",
    })
  )
  .use(
    jwt({
      name: "jwtRefresh",
      secret:
        (process.env.JWT_SECRET ?? "changeme-please-set-JWT_SECRET") +
        "-refresh",
    })
  )
  .use(bearer());

// =============================================
// Auth Context — ดึง user + active affiliation จาก JWT
// =============================================
export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .use(jwtPlugin)
  .derive({ as: 'global' }, async ({ bearer: token, jwtAccess, request }) => {
    // allow unauthenticated access to login/refresh routes so we can mount
    // the middleware globally without protecting those endpoints.
    const rawPath = request.url || "";
    // request.url is a full URL (e.g. http://localhost:3000/api/auth/login)
    // extract just the pathname for reliable prefix matching
    let pathname = rawPath;
    try { pathname = new URL(rawPath).pathname; } catch { /* ignore */ }

    if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/refresh")) {
      return {}; // do not require a token for these routes
    }

    // Also skip /me and /change-password — they do their own token verification inline
    if (pathname === "/api/auth/me" || pathname === "/api/auth/change-password") {
      return {};
    }

    if (!token) {
      return status(401, { success: false, message: "กรุณาเข้าสู่ระบบก่อน" });
    }

    let payload: any;
    try {
      payload = await jwtAccess.verify(token);
    } catch {
      return status(401, { success: false, message: "Token ไม่ถูกต้องหรือหมดอายุ" });
    }

    if (!payload || payload.type !== "access") {
      return status(401, { success: false, message: "Token ไม่ถูกต้องหรือหมดอายุ" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(payload.sub)),
    });

    if (!user || !user.isActive) {
      return status(401, { success: false, message: "ไม่พบผู้ใช้หรือบัญชีถูกระงับ" });
    }

    // ดึง active affiliation (ถ้ามี)
    let activeAffiliation = null;
    if (payload.affiliationId) {
      activeAffiliation = await db.query.userAffiliations.findFirst({
        where: and(
          eq(userAffiliations.id, Number(payload.affiliationId)),
          eq(userAffiliations.userId, user.id),
          eq(userAffiliations.isActive, true)
        ),
        with: {
          organization: true,
        },
      });
    }

    return {
      auth: {
        user,
        affiliation: activeAffiliation,
        role: (activeAffiliation?.role ?? null) as string | null,
        orgId: (activeAffiliation?.orgId ?? null) as number | null,
      },
    };
  });

// =============================================
// Scope Resolution — คำนวณหน่วยงานที่เข้าถึงได้
// =============================================
export async function getAccessibleOrgIds(
  role: string,
  orgId: number | null
): Promise<{ orgIds: number[]; readOnly: boolean }> {
  switch (role) {
    case "super_admin": {
      const allOrgs = await db
        .select({ id: organizations.id })
        .from(organizations);
      return { orgIds: allOrgs.map((o) => o.id), readOnly: false };
    }

    case "univ_executive":
    case "univ_officer": {
      const allOrgs = await db
        .select({ id: organizations.id })
        .from(organizations);
      return { orgIds: allOrgs.map((o) => o.id), readOnly: true };
    }

    case "campus_executive":
    case "campus_officer": {
      if (!orgId) return { orgIds: [], readOnly: true };
      // ดึง campus_id ของหน่วยงานที่สังกัด
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      });
      if (!org) return { orgIds: [], readOnly: true };
      const campusId = org.campusId ?? org.id; // ถ้าตัวเองเป็น campus ใช้ id ตัวเอง
      const campusOrgs = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.campusId, campusId));
      // รวม campus เองด้วย
      const ids = [campusId, ...campusOrgs.map((o) => o.id)];
      return { orgIds: [...new Set(ids)], readOnly: true };
    }

    case "faculty_executive": {
      if (!orgId) return { orgIds: [], readOnly: true };
      // หน่วยงานหลัก + หน่วยงานย่อยภายใต้
      const children = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.parentId, orgId));
      return {
        orgIds: [orgId, ...children.map((o) => o.id)],
        readOnly: true,
      };
    }

    case "unit_head": {
      if (!orgId) return { orgIds: [], readOnly: true };
      return { orgIds: [orgId], readOnly: true };
    }

    case "org_admin": {
      if (!orgId) return { orgIds: [], readOnly: false };
      // หน่วยงานที่สังกัด + หน่วยงานย่อยภายใต้
      const children = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.parentId, orgId));
      return {
        orgIds: [orgId, ...children.map((o) => o.id)],
        readOnly: false,
      };
    }

    case "project_lead":
    case "staff": {
      if (!orgId) return { orgIds: [], readOnly: false };
      return { orgIds: [orgId], readOnly: false };
    }

    default:
      return { orgIds: [], readOnly: true };
  }
}

// =============================================
// View-only roles — ไม่มีสิทธิ์แก้ไข
// =============================================
const VIEW_ONLY_ROLES = new Set([
  "univ_executive",
  "univ_officer",
  "campus_executive",
  "campus_officer",
  "faculty_executive",
  "unit_head",
]);

export function isViewOnlyRole(role: string): boolean {
  return VIEW_ONLY_ROLES.has(role);
}

// =============================================
// Roles ที่ org_admin สามารถกำหนดได้
// =============================================
export const ORG_ADMIN_ASSIGNABLE_ROLES = [
  "faculty_executive",
  "unit_head",
  "org_admin",
  "project_lead",
  "staff",
] as const;
