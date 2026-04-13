import { db } from "./db";
import { rolePermissions } from "./schema";
import { sql } from "drizzle-orm";

// =============================================
// Permission Matrix สำหรับ 10 roles ในระบบ
// true = มีสิทธิ์, false = ไม่มีสิทธิ์
// =============================================

type Role =
  | "super_admin"
  | "org_admin"
  | "univ_executive"
  | "univ_officer"
  | "campus_executive"
  | "campus_officer"
  | "faculty_executive"
  | "unit_head"
  | "project_lead"
  | "staff";

type PermissionMatrix = Record<string, Record<Role, boolean>>;

const PERMISSION_MATRIX: PermissionMatrix = {
  // --- โครงการ ---
  "project.view": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    true,
    univ_officer:      true,
    campus_executive:  true,
    campus_officer:    true,
    faculty_executive: true,
    unit_head:         true,
    project_lead:      true,
    staff:             true,
  },
  "project.create": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    false,
    univ_officer:      true,
    campus_executive:  false,
    campus_officer:    true,
    faculty_executive: false,
    unit_head:         true,
    project_lead:      true,
    staff:             true,
  },
  "project.edit": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    false,
    univ_officer:      true,
    campus_executive:  false,
    campus_officer:    true,
    faculty_executive: false,
    unit_head:         true,
    project_lead:      true,
    staff:             false,
  },
  "project.delete": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    false,
    univ_officer:      false,
    campus_executive:  false,
    campus_officer:    false,
    faculty_executive: false,
    unit_head:         false,
    project_lead:      false,
    staff:             false,
  },
  "project.submit": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    false,
    univ_officer:      true,
    campus_executive:  false,
    campus_officer:    true,
    faculty_executive: false,
    unit_head:         true,
    project_lead:      true,
    staff:             true,
  },
  "project.approve": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    true,
    univ_officer:      false,
    campus_executive:  true,
    campus_officer:    false,
    faculty_executive: true,
    unit_head:         true,
    project_lead:      false,
    staff:             false,
  },
  // --- งบประมาณ ---
  "budget.view": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    true,
    univ_officer:      true,
    campus_executive:  true,
    campus_officer:    true,
    faculty_executive: true,
    unit_head:         true,
    project_lead:      true,
    staff:             true,
  },
  "budget.manage": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    false,
    univ_officer:      true,
    campus_executive:  false,
    campus_officer:    true,
    faculty_executive: false,
    unit_head:         true,
    project_lead:      true,
    staff:             false,
  },
  "budget.approve": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    true,
    univ_officer:      false,
    campus_executive:  true,
    campus_officer:    false,
    faculty_executive: true,
    unit_head:         true,
    project_lead:      false,
    staff:             false,
  },
  // --- รายงาน ---
  "report.view": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    true,
    univ_officer:      true,
    campus_executive:  true,
    campus_officer:    true,
    faculty_executive: true,
    unit_head:         true,
    project_lead:      true,
    staff:             true,
  },
  "report.export": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    true,
    univ_officer:      true,
    campus_executive:  true,
    campus_officer:    true,
    faculty_executive: true,
    unit_head:         true,
    project_lead:      true,
    staff:             false,
  },
  // --- ยุทธศาสตร์ ---
  "strategy.view": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    true,
    univ_officer:      true,
    campus_executive:  true,
    campus_officer:    true,
    faculty_executive: true,
    unit_head:         true,
    project_lead:      true,
    staff:             true,
  },
  "strategy.manage": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    false,
    univ_officer:      true,
    campus_executive:  false,
    campus_officer:    true,
    faculty_executive: false,
    unit_head:         false,
    project_lead:      false,
    staff:             false,
  },
  // --- ผู้ใช้งาน ---
  "user.view": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    true,
    univ_officer:      true,
    campus_executive:  true,
    campus_officer:    true,
    faculty_executive: true,
    unit_head:         true,
    project_lead:      false,
    staff:             false,
  },
  "user.manage": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    false,
    univ_officer:      true,
    campus_executive:  false,
    campus_officer:    true,
    faculty_executive: false,
    unit_head:         false,
    project_lead:      false,
    staff:             false,
  },
  // --- ตั้งค่าระบบ ---
  "settings.view": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    true,
    univ_officer:      true,
    campus_executive:  true,
    campus_officer:    true,
    faculty_executive: true,
    unit_head:         true,
    project_lead:      false,
    staff:             false,
  },
  "settings.manage": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    false,
    univ_officer:      true,
    campus_executive:  false,
    campus_officer:    false,
    faculty_executive: false,
    unit_head:         false,
    project_lead:      false,
    staff:             false,
  },
  "settings.org": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    false,
    univ_officer:      false,
    campus_executive:  false,
    campus_officer:    false,
    faculty_executive: false,
    unit_head:         false,
    project_lead:      false,
    staff:             false,
  },
  "settings.budget": {
    super_admin:       true,
    org_admin:         true,
    univ_executive:    false,
    univ_officer:      true,
    campus_executive:  false,
    campus_officer:    false,
    faculty_executive: false,
    unit_head:         false,
    project_lead:      false,
    staff:             false,
  },
};

const ALL_ROLES: Role[] = [
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
];

async function seed() {
  console.log("Seeding role_permissions...");

  // สร้าง records ทั้งหมดจาก matrix
  const records = Object.entries(PERMISSION_MATRIX).flatMap(
    ([permissionCode, roleMap]) =>
      ALL_ROLES.map((role) => ({
        role,
        permissionCode,
        granted: roleMap[role],
      }))
  );

  // Upsert: อัปเดตถ้ามีอยู่แล้ว, insert ถ้าไม่มี
  await db
    .insert(rolePermissions)
    .values(records)
    .onConflictDoUpdate({
      target: [rolePermissions.role, rolePermissions.permissionCode],
      set: {
        granted: sql`EXCLUDED.granted`,
        updatedAt: sql`NOW()`,
      },
    });

  console.log(`Done: ${records.length} records upserted`);
  console.log(`  - ${Object.keys(PERMISSION_MATRIX).length} permissions × ${ALL_ROLES.length} roles`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
