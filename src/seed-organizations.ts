import { db } from "./db";
import { organizations } from "./schema";
import { sql } from "drizzle-orm";
import data from "../json/departmnets.json";

interface DepartmentJson {
  id: number;
  code: string;
  name: string;
  phone: string;
  internal_phone: string;
  office_code: string;
  type: "main" | "sub";
  parent_id: number | null;
  campus: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  parent: unknown;
}

// Map type เดิม → orgLevel ใหม่
function mapOrgLevel(type: "main" | "sub"): "university" | "campus" | "faculty" | "department" {
  return type === "main" ? "faculty" : "department";
}

async function seed() {
  const items: DepartmentJson[] = data.data;

  console.log(`Found ${items.length} organizations to migrate...`);

  // เรียงลำดับ: parent (parent_id = null) ก่อน แล้วค่อย sub
  const sorted = [...items].sort((a, b) => {
    if (a.parent_id === null && b.parent_id !== null) return -1;
    if (a.parent_id !== null && b.parent_id === null) return 1;
    return a.id - b.id;
  });

  // ล้างข้อมูลเก่าก่อน (ถ้ามี) — PostgreSQL ใช้ TRUNCATE ... CASCADE
  await db.execute(sql`TRUNCATE TABLE organizations RESTART IDENTITY CASCADE`);

  let inserted = 0;

  // Insert ทีละ batch (50 records)
  const batchSize = 50;
  for (let i = 0; i < sorted.length; i += batchSize) {
    const batch = sorted.slice(i, i + batchSize);

    await db.insert(organizations).values(
      batch.map((item) => ({
        id: item.id,
        code: item.code,
        nameTh: item.name, // name → nameTh
        orgLevel: mapOrgLevel(item.type), // type → orgLevel
        parentId: item.parent_id,
        // campusId จะต้อง setup เพิ่มเติมหลัง migrate ข้อมูลวิทยาเขต
        isActive: item.is_active,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
      }))
    );

    inserted += batch.length;
    console.log(`Inserted ${inserted}/${sorted.length} records...`);
  }

  console.log(`Migration complete! ${inserted} organizations inserted.`);
  console.log(`NOTE: campusId ยังไม่ได้กำหนด — ต้อง setup หลัง migrate ข้อมูลวิทยาเขต`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
