import { db } from "./db";
import { budgetTypes } from "./schema";
import { sql } from "drizzle-orm";
import data from "../json/budget-types.json";

interface BudgetTypeJson {
  id: number;
  name: string;
  budget_category: string;
  budget_category_display: string;
  budget_support_id: number;
  department_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function seed() {
  const items: BudgetTypeJson[] = data.data;

  console.log(`Found ${items.length} budget_types to seed...`);

  // ล้างข้อมูลเก่าก่อน — PostgreSQL ใช้ TRUNCATE ... CASCADE
  await db.execute(sql`TRUNCATE TABLE budget_types RESTART IDENTITY CASCADE`);

  const sorted = [...items].sort((a, b) => a.id - b.id);

  for (const item of sorted) {
    await db.insert(budgetTypes).values({
      id: item.id,
      name: item.name,
      budgetCategory: item.budget_category,
      budgetCategoryDisplay: item.budget_category_display,
      budgetSupportId: item.budget_support_id,
      departmentId: item.department_id,
      isActive: item.is_active,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    });
  }

  console.log(`✓ Inserted ${sorted.length} budget_types.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
