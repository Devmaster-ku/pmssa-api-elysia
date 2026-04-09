import { db } from "./db";
import { budgetSupports } from "./schema";
import { sql } from "drizzle-orm";
import data from "../json/budget-supports.json";

interface BudgetSupportJson {
  id: number;
  name: string;
  department_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function seed() {
  const items: BudgetSupportJson[] = data.data;

  console.log(`Found ${items.length} budget_supports to seed...`);

  // ล้างข้อมูลเก่าก่อน — PostgreSQL ใช้ TRUNCATE ... CASCADE
  await db.execute(sql`TRUNCATE TABLE budget_supports RESTART IDENTITY CASCADE`);

  const sorted = [...items].sort((a, b) => a.id - b.id);

  for (const item of sorted) {
    await db.insert(budgetSupports).values({
      id: item.id,
      name: item.name,
      departmentId: item.department_id,
      isActive: item.is_active,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    });
  }

  console.log(`✓ Inserted ${sorted.length} budget_supports.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
