import { db } from "./db";
import { userAffiliations, users, organizations } from "./schema";
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

type UserRole =
  | "super_admin"
  | "univ_executive"
  | "univ_officer"
  | "campus_executive"
  | "campus_officer"
  | "faculty_executive"
  | "unit_head"
  | "org_admin"
  | "project_lead"
  | "staff";

// Map JSON role values to database enum values
function mapRoleToEnum(role: string): UserRole {
  switch (role) {
    case "super-admin":
    case "super_admin":
      return "super_admin";
    case "admin":
      return "org_admin";
    case "manager":
      return "faculty_executive";
    case "project-manager":
    case "project_manager":
      return "project_lead";
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

  console.log(`Found ${items.length} department users to migrate...`);

  // Get existing user IDs and department IDs
  const existingUsers = await db.select({ id: users.id }).from(users);
  const existingOrgs = await db.select({ id: organizations.id }).from(organizations);

  const userIds = new Set(existingUsers.map(u => u.id));
  const orgIds = new Set(existingOrgs.map(d => d.id));

  // Filter out items with invalid user_id or department_id
  const validItems = items.filter(item => {
    const userExists = userIds.has(item.user_id);
    const orgExists = orgIds.has(item.department_id);

    if (!userExists) {
      console.log(`Skipping department user ${item.id}: user_id ${item.user_id} does not exist`);
    }
    if (!orgExists) {
      console.log(`Skipping department user ${item.id}: department_id ${item.department_id} does not exist in organizations`);
    }

    return userExists && orgExists;
  });

  console.log(`After filtering: ${validItems.length} valid department users to migrate...`);

  let inserted = 0;
  let skipped = 0;

  // Upsert ทีละ batch (50 records) — เพิ่มเฉพาะที่ยังไม่มีใน DB
  // unique constraint: (userId, orgId, role)
  const batchSize = 50;
  for (let i = 0; i < validItems.length; i += batchSize) {
    const batch = validItems.slice(i, i + batchSize);

    const result = await db.insert(userAffiliations).values(
      batch.map((item) => ({
        userId: item.user_id,
        orgId: item.department_id,
        subDepId: item.sub_department_id,
        role: mapRoleToEnum(item.role),
        positionTitle: item.management_position ?? item.position ?? null,
        isPrimary: item.is_management,
        isActive: item.is_active,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
      }))
    ).onConflictDoNothing(); // ข้ามถ้า (userId, orgId, role) ซ้ำ

    const batchInserted = Number((result as any).rowCount ?? batch.length);
    inserted += batchInserted;
    skipped += batch.length - batchInserted;
    console.log(`Processed ${Math.min(i + batchSize, validItems.length)}/${validItems.length} records...`);
  }

  console.log(`Migration complete! ${inserted} inserted, ${skipped} skipped (already existed).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
