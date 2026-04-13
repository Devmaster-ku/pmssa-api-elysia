import { sql } from "drizzle-orm";
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

  console.log(`Found ${items.length} department users in JSON file.`);

  // ลบข้อมูลเก่าทั้งหมดแล้ว reset sequence
  // audit_logs.actor_affiliation_id จะถูก set เป็น NULL อัตโนมัติ (ON DELETE SET NULL)
  console.log("Clearing existing user_affiliations data...");
  await db.execute(sql`DELETE FROM public.user_affiliations`);
  await db.execute(sql`ALTER SEQUENCE user_affiliations_id_seq RESTART WITH 1`);
  console.log("Cleared. Sequence reset to 1.");

  // Get existing user IDs and organization IDs
  const existingUsers = await db.select({ id: users.id }).from(users);
  const existingOrgs = await db.select({ id: organizations.id }).from(organizations);

  const userIds = new Set(existingUsers.map(u => u.id));
  const orgIds = new Set(existingOrgs.map(d => d.id));

  // Filter out items with invalid user_id or department_id
  const validItems = items.filter(item => {
    const userExists = userIds.has(item.user_id);
    const orgExists = orgIds.has(item.department_id);

    if (!userExists) {
      console.log(`Skipping item id=${item.id}: user_id ${item.user_id} not found`);
    }
    if (!orgExists) {
      console.log(`Skipping item id=${item.id}: department_id ${item.department_id} not found in organizations`);
    }

    return userExists && orgExists;
  });

  console.log(`Valid records to insert: ${validItems.length} / ${items.length}`);

  let inserted = 0;

  // Insert ทีละ batch (50 records)
  const batchSize = 50;
  for (let i = 0; i < validItems.length; i += batchSize) {
    const batch = validItems.slice(i, i + batchSize);

    await db.insert(userAffiliations).values(
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
    );

    inserted += batch.length;
    console.log(`Inserted ${Math.min(i + batchSize, validItems.length)}/${validItems.length}...`);
  }

  console.log(`Done! ${inserted} records inserted into user_affiliations.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
