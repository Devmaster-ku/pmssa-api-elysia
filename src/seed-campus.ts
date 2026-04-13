import { db } from "./db";
import { campus, organizations } from "./schema";
import { sql } from "drizzle-orm";
import data from "../json/departmnets.json";

interface DepartmentJson {
  campus: string;
  [key: string]: unknown;
}

async function seed() {
  const items: DepartmentJson[] = data.data;

  // Extract unique campus names
  const uniqueCampuses = new Set<string>();
  for (const item of items) {
    if (item.campus) {
      uniqueCampuses.add(item.campus);
    }
  }

  console.log(`Found ${uniqueCampuses.size} unique campuses to seed...`);

  // Clear existing campus data
  await db.execute(sql`TRUNCATE TABLE campus RESTART IDENTITY CASCADE`);

  // Insert campuses
  const campusArray = Array.from(uniqueCampuses).sort();
  const insertedCampuses = await db
    .insert(campus)
    .values(
      campusArray.map((name) => ({
        nameTh: name,
        isActive: true,
      })),
    )
    .returning();

  console.log(`Inserted ${insertedCampuses.length} campuses:`);
  insertedCampuses.forEach((c) => console.log(`  - ${c.nameTh} (ID: ${c.id})`));

  // Create university-level organization
  console.log("\nCreating university-level organization...");
  try {
    // Check if university already exists
    const existingUniv = await db.query.organizations.findFirst({
      where: (orgs, { eq }) => eq(orgs.orgLevel, "university"),
    });

    if (!existingUniv) {
      const [univ] = await db
        .insert(organizations)
        .values({
          code: "KU",
          nameTh: "มหาวิทยาลัยเกษตรศาสตร์",
          nameEn: "Kasetsart University",
          orgLevel: "university",
          isActive: true,
        })
        .returning();

      console.log(
        `Created university: ${univ.nameTh} (ID: ${univ.id}, Level: ${univ.orgLevel})`,
      );

      // Update all campuses to reference the university (via parentId if needed)
      // Note: campuses typically don't have parentId, but we can set up the hierarchy
      // For now, just show that the university exists
    } else {
      console.log(
        `University already exists: ${existingUniv.nameTh} (ID: ${existingUniv.id})`,
      );
    }
  } catch (error) {
    console.error("Error creating university:", error);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
