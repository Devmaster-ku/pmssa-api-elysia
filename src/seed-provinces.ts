import { db } from "./db";
import { provinces } from "./schema";
import { sql } from "drizzle-orm";
import data from "../json/province.json";

interface ProvinceJson {
  id: number;
  name_th: string;
  name_en: string | null;
  geography_id: number | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

async function seed() {
  const items: ProvinceJson[] = data as ProvinceJson[];

  console.log(`Found ${items.length} provinces to seed...`);

  try {
    // Clear existing provinces data
    console.log("Truncating table...");
    await db.execute(sql`TRUNCATE TABLE provinces RESTART IDENTITY CASCADE`);

    // Insert provinces
    console.log("Inserting data...");
    const insertedProvinces = await db
      .insert(provinces)
      .values(
        items.map((item) => ({
          id: item.id,
          nameTh: item.name_th,
          nameEn: item.name_en,
          geographyId: item.geography_id,
          createdAt: item.created_at ? new Date(item.created_at) : undefined,
          updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
        })),
      )
      .returning();

    console.log(`Successfully seeded ${insertedProvinces.length} provinces.`);
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
