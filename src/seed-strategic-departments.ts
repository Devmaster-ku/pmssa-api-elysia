import { db } from "./db";
import { strategicDepartments, strategicDepartmentTactics } from "./schema";
import { sql } from "drizzle-orm";
import data from "../json/strategic-departments.json";

interface StrategicDeptTacticJson {
  id: number;
  strategic_department_id: number;
  name: string;
  description: string | null;
  order: number;
  created_by: number | null;
  updated_by: number | null;
  deleted_by: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface StrategicDepartmentJson {
  id: number;
  name: string;
  department: number | null; // org/department id
  description: string | null;
  year: number;
  is_active: boolean;
  created_by: number | null;
  updated_by: number | null;
  deleted_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  tactics: StrategicDeptTacticJson[];
}

async function seed() {
  const items: StrategicDepartmentJson[] = data.data;

  console.log(`Found ${items.length} strategic_departments to seed...`);

  // ล้างข้อมูลเก่าก่อน — TRUNCATE CASCADE จัดการ FK ให้อัตโนมัติ
  await db.execute(sql`TRUNCATE TABLE strategic_department_tactics RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE strategic_departments RESTART IDENTITY CASCADE`);

  // Insert strategic_departments (sorted by id)
  const sortedDepts = [...items].sort((a, b) => a.id - b.id);

  for (const item of sortedDepts) {
    await db.insert(strategicDepartments).values({
      id: item.id,
      name: item.name,
      departmentId: item.department ?? null,
      description: item.description || null,
      year: item.year,
      isActive: item.is_active,
      createdBy: item.created_by,
      updatedBy: item.updated_by,
      deletedBy: item.deleted_by,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      deletedAt: item.deleted_at ? new Date(item.deleted_at) : null,
    });
  }
  console.log(`Inserted ${sortedDepts.length} strategic_departments.`);

  // Collect and insert all tactics
  const allTactics: StrategicDeptTacticJson[] = items.flatMap((d) => d.tactics);
  const sortedTactics = [...allTactics].sort((a, b) => a.id - b.id);

  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < sortedTactics.length; i += batchSize) {
    const batch = sortedTactics.slice(i, i + batchSize);
    await db.insert(strategicDepartmentTactics).values(
      batch.map((t) => ({
        id: t.id,
        strategicDepartmentId: t.strategic_department_id,
        name: t.name,
        description: t.description || null,
        order: t.order,
        isActive: t.is_active,
        createdBy: t.created_by,
        updatedBy: t.updated_by,
        deletedBy: t.deleted_by,
        createdAt: new Date(t.created_at),
        updatedAt: new Date(t.updated_at),
        deletedAt: t.deleted_at ? new Date(t.deleted_at) : null,
      }))
    );
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${sortedTactics.length} strategic_department_tactics...`);
  }

  console.log(`Seed complete! ${sortedDepts.length} strategic_departments, ${inserted} tactics.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
