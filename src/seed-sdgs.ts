import { db } from "./db/index";
import { sdgs } from "./schema/index";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const dataPath = path.join(".", "json", "sdgs.json");

async function seedSDGs() {
  try {
    console.log("🌱 Starting SDGs seed...");

    // Read JSON file
    const rawData = fs.readFileSync(dataPath, "utf-8");
    const { data } = JSON.parse(rawData);

    console.log(`📂 Found ${data.length} SDG records in JSON file`);

    // ล้างข้อมูลเก่าก่อน
    await db.execute(sql`TRUNCATE TABLE sdgs RESTART IDENTITY CASCADE`);

    // Sort data by parent_id (nulls first) to respect FK constraints
    const sortedData = [...data].sort((a, b) => {
      // Items with no parent come first
      if (a.parent_id === null && b.parent_id !== null) return -1;
      if (a.parent_id !== null && b.parent_id === null) return 1;
      if (a.parent_id === null && b.parent_id === null) return a.id - b.id;
      // Then sort by parent_id
      return (a.parent_id || 0) - (b.parent_id || 0);
    });

    // Insert data into database
    let inserted = 0;
    let errors = 0;
    const errorIds = [];

    for (const record of sortedData) {
      try {
        await db.insert(sdgs).values({
          id: record.id,
          code: record.code,
          name: record.name,
          description: record.description,
          parentId: record.parent_id,
          displayName: record.display_name,
        });
        inserted++;

        // Log progress every 20 records
        if (inserted % 20 === 0) {
          console.log(`✓ Inserted ${inserted} records...`);
        }
      } catch (error) {
        errors++;
        errorIds.push(record.id);
        console.error(`✗ Error inserting record ${record.id}:`, (error as any).message?.split("\n")[0]);
      }
    }

    console.log(`\n✅ Seed completed!`);
    console.log(`   📊 Inserted: ${inserted}`);
    console.log(`   ❌ Errors: ${errors}`);
    if (errorIds.length > 0) {
      console.log(`   ⚠️  Failed IDs: ${errorIds.join(", ")}`);
    }
    console.log(`   📈 Total: ${inserted + errors}`);

    // Verify counts
    const count = await db
      .select({ count: sql`COUNT(*)` })
      .from(sdgs);
    const dbCount = (count[0] as any).count;
    console.log(`   🗄️  Database now has: ${dbCount} SDG records\n`);

    process.exit(errors === 0 ? 0 : 1);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seedSDGs();
