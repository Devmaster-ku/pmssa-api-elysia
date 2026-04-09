import { db } from "../src/db";
import { campus } from "../src/schema";

const campusData = [
  { nameTh: "บางเขน", nameEn: "Bang Khen" },
  { nameTh: "วิทยาเขตกำแพงแสน", nameEn: "Kamphaeng Saen Campus" },
  { nameTh: "วิทยาเขตเฉลิมพระเกียรติ จังหวัดสกลนคร", nameEn: "Chalermphrakiat Sakon Nakhon Province Campus" },
  { nameTh: "วิทยาเขตศรีราชา", nameEn: "Sriracha Campus" },
  { nameTh: "สำนักงานเขตบริหารการเรียนรู้พื้นที่สุพรรณบุรี", nameEn: "Suphanburi Educational Administration Zone" },
  { nameTh: "สถาบันสมทบ", nameEn: "Affiliated Institute" },
];

async function main() {
  // Create table if not exists (raw SQL)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS \`campus\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`name_th\` varchar(255) NOT NULL,
      \`name_en\` varchar(255),
      \`is_active\` boolean NOT NULL DEFAULT true,
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`campus_id\` PRIMARY KEY(\`id\`)
    )
  `);

  // Check if already seeded
  const existing = await db.select().from(campus);
  if (existing.length > 0) {
    console.log(`Campus table already has ${existing.length} rows — skipping seed.`);
    process.exit(0);
  }

  await db.insert(campus).values(campusData);
  console.log(`Seeded ${campusData.length} campus records.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
