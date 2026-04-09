import { db } from "./db";
import { userAffiliations, users, organizations } from "./schema";
import { sql } from "drizzle-orm";
import data from "../json/department-users.json";

interface DepartmentUserJson {
  id: number;
  department_id: number;
  user_id: number;
  position: string;
  role: string;
  created_by: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  management_position: string | null;
  is_management: boolean;
  sub_department_id: number | null;
  roles: string[];
  user: {
    id: number;
    name: string;
    email: string;
  };
  department: {
    id: number;
    name: string;
    code: string;
  };
}

// Map role เดิม → role ใหม่ (10 roles)
// ระบบเดิม: super_admin, admin, manager, project_manager/project-manager, staff, member
// ระบบใหม่: super_admin, univ_executive, univ_officer, campus_executive, campus_officer,
//           faculty_executive, unit_head, org_admin, project_lead, staff
function mapRole(
  role: string,
  isManagement: boolean
): "super_admin" | "univ_executive" | "univ_officer" | "campus_executive" | "campus_officer" | "faculty_executive" | "unit_head" | "org_admin" | "project_lead" | "staff" {
  switch (role) {
    case "super_admin":
    case "super-admin":
      return "super_admin";
    case "admin":
      return "org_admin"; // admin เดิม → org_admin (ผู้ดูแลระดับหน่วยงาน)
    case "manager":
      // manager เดิม → faculty_executive หรือ unit_head (แยกตามระดับ)
      // ใช้ isManagement เป็นตัวช่วยตัดสิน
      return isManagement ? "faculty_executive" : "unit_head";
    case "project_manager":
    case "project-manager":
      return "project_lead"; // project_manager → project_lead
    case "staff":
    case "member":
      return "staff";
    default:
      console.warn(`Unknown role: ${role}, defaulting to "staff"`);
      return "staff";
  }
}

async function seed() {
  const items: DepartmentUserJson[] = data.data;

  console.log(`Found ${items.length} affiliations to migrate...`);

  // Get existing user IDs and organization IDs
  const existingUsers = await db.select({ id: users.id }).from(users);
  const existingOrgs = await db.select({ id: organizations.id }).from(organizations);

  const userIds = new Set(existingUsers.map((u) => u.id));
  const orgIds = new Set(existingOrgs.map((o) => o.id));

  // Filter out items with invalid user_id or org_id (department_id → org_id)
  const validItems = items.filter((item) => {
    const userExists = userIds.has(item.user_id);
    const orgExists = orgIds.has(item.department_id);
    // sub_department_id อาจเป็น null ได้ — ถ้ามีค่าให้ตรวจว่ามีใน organizations
    if (item.sub_department_id !== null && !orgIds.has(item.sub_department_id)) {
      console.log(
        `Warning: affiliation ${item.id}: sub_department_id ${item.sub_department_id} not found in organizations — will set to null`
      );
    }

    if (!userExists) {
      console.log(
        `Skipping affiliation ${item.id}: user_id ${item.user_id} does not exist`
      );
    }
    if (!orgExists) {
      console.log(
        `Skipping affiliation ${item.id}: org_id (department_id) ${item.department_id} does not exist`
      );
    }

    return userExists && orgExists;
  });

  // กรอง unique(user_id, org_id, role) ซ้ำ
  const seenKeys = new Set<string>();
  const uniqueItems = validItems.filter((item) => {
    const role = mapRole(item.role, item.is_management);
    const key = `${item.user_id}-${item.department_id}-${role}`;
    if (seenKeys.has(key)) {
      console.log(`Skipping duplicate affiliation: ${key} (id: ${item.id})`);
      return false;
    }
    seenKeys.add(key);
    return true;
  });

  console.log(
    `After filtering: ${uniqueItems.length} valid affiliations to migrate...`
  );

  // ล้างข้อมูลเก่าก่อน (ถ้ามี) — PostgreSQL ใช้ TRUNCATE ... CASCADE
  await db.execute(sql`TRUNCATE TABLE user_affiliations RESTART IDENTITY CASCADE`);

  let inserted = 0;

  // Insert ทีละ batch (50 records)
  const batchSize = 50;
  for (let i = 0; i < uniqueItems.length; i += batchSize) {
    const batch = uniqueItems.slice(i, i + batchSize);

    await db.insert(userAffiliations).values(
      batch.map((item) => ({
        id: item.id,
        userId: item.user_id,
        orgId: item.department_id, // department_id → org_id
        subDepId: (item.sub_department_id !== null && orgIds.has(item.sub_department_id))
          ? item.sub_department_id
          : null,
        role: mapRole(item.role, item.is_management),
        positionTitle: item.position || item.management_position || null,
        isPrimary: false, // ต้อง setup เพิ่มเติมหลัง migrate
        isActive: item.is_active,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
      }))
    );

    inserted += batch.length;
    console.log(`Inserted ${inserted}/${uniqueItems.length} records...`);
  }

  console.log(`Migration complete! ${inserted} affiliations inserted.`);
  console.log(`NOTE: isPrimary ยังไม่ได้กำหนด — ต้อง setup หลัง migrate`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
