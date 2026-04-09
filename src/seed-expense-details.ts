import { db } from "./db";
import { expenseDetails } from "./schema";
import { sql } from "drizzle-orm";
import data from "../json/expense-details.json";

interface ExpenseDetailJson {
  id: number;
  name: string;
  detail_type: "main" | "sub";
  detail_type_display: string;
  parent_id: number | null;
  budget_group_id: number | null;
  department_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function seed() {
  const items: ExpenseDetailJson[] = data.data;

  console.log(`Found ${items.length} expense_details to seed...`);

  // ล้างข้อมูลเก่าก่อน — PostgreSQL ใช้ TRUNCATE ... CASCADE
  await db.execute(sql`TRUNCATE TABLE expense_details RESTART IDENTITY CASCADE`);

  // Insert "main" (parent_id = null) first, then "sub" — sorted by id within each group
  const mains = items.filter((i) => i.detail_type === "main").sort((a, b) => a.id - b.id);
  const subs = items.filter((i) => i.detail_type === "sub").sort((a, b) => a.id - b.id);

  const ordered = [...mains, ...subs];

  const batchSize = 50;
  let inserted = 0;

  for (let i = 0; i < ordered.length; i += batchSize) {
    const batch = ordered.slice(i, i + batchSize);
    await db.insert(expenseDetails).values(
      batch.map((item) => ({
        id: item.id,
        name: item.name,
        detailType: item.detail_type,
        detailTypeDisplay: item.detail_type_display,
        parentId: item.parent_id ?? null,
        budgetGroupId: item.budget_group_id ?? null,
        departmentId: item.department_id,
        isActive: item.is_active,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
      }))
    );
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${ordered.length} expense_details...`);
  }

  console.log(`✓ Inserted ${inserted} expense_details (${mains.length} main, ${subs.length} sub).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
