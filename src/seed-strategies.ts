import { db } from "./db";
import { strategies, strategicTactics } from "./schema";
import { sql } from "drizzle-orm";
import data from "../json/strategies.json";

interface StrategicTacticJson {
  id: number;
  strategy_id: number;
  name: string;
  description: string;
  order_sequence: number;
  created_by: number | null;
  updated_by: number | null;
  deleted_by: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface StrategyJson {
  id: number;
  name: string;
  campus: string;
  order_list: number;
  is_active: boolean;
  created_by: number | null;
  updated_by: number | null;
  deleted_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  strategic_tactics: StrategicTacticJson[];
}

async function seed() {
  const items: StrategyJson[] = data.data;

  console.log(`Found ${items.length} strategies to seed...`);

  // ล้างข้อมูลเก่าก่อน — TRUNCATE CASCADE จัดการ FK ให้อัตโนมัติ
  await db.execute(sql`TRUNCATE TABLE strategic_tactics RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE strategies RESTART IDENTITY CASCADE`);

  // Insert strategies (sorted by id)
  const sortedStrategies = [...items].sort((a, b) => a.id - b.id);

  for (const item of sortedStrategies) {
    await db.insert(strategies).values({
      id: item.id,
      name: item.name,
      campus: item.campus,
      orderList: item.order_list,
      isActive: item.is_active,
      createdBy: item.created_by,
      updatedBy: item.updated_by,
      deletedBy: item.deleted_by,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      deletedAt: item.deleted_at ? new Date(item.deleted_at) : null,
    });
  }
  console.log(`Inserted ${sortedStrategies.length} strategies.`);

  // Collect and insert all tactics
  const allTactics: StrategicTacticJson[] = items.flatMap((s) => s.strategic_tactics);
  const sortedTactics = [...allTactics].sort((a, b) => a.id - b.id);

  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < sortedTactics.length; i += batchSize) {
    const batch = sortedTactics.slice(i, i + batchSize);
    await db.insert(strategicTactics).values(
      batch.map((t) => ({
        id: t.id,
        strategyId: t.strategy_id,
        name: t.name,
        description: t.description || null,
        orderSequence: t.order_sequence,
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
    console.log(`Inserted ${inserted}/${sortedTactics.length} strategic_tactics...`);
  }

  console.log(`Seed complete! ${sortedStrategies.length} strategies, ${inserted} tactics.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
