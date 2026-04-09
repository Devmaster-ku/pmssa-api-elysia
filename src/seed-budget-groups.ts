import { db } from "./db";
import { budgetGroups } from "./schema";
import { sql } from "drizzle-orm";
import data from "../json/budget-groups.json";

interface BudgetGroupJson {
  id: number;
  name: string;
  group_type: string;
  group_type_display: string;
  budget_type_id: number;
  department_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function seed() {
  const items: BudgetGroupJson[] = data.data;

  console.log(`Found ${items.length} budget_groups to seed...`);

  // ล้างข้อมูลเก่าก่อน — PostgreSQL ใช้ TRUNCATE ... CASCADE
  await db.execute(sql`TRUNCATE TABLE budget_groups RESTART IDENTITY CASCADE`);

  const sorted = [...items].sort((a, b) => a.id - b.id);

  for (const item of sorted) {
    await db.insert(budgetGroups).values({
      id: item.id,
      name: item.name,
      groupType: item.group_type,
      groupTypeDisplay: item.group_type_display,
      budgetTypeId: item.budget_type_id,
      departmentId: item.department_id,
      isActive: item.is_active,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    });
  }

  console.log(`✓ Inserted ${sorted.length} budget_groups.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
