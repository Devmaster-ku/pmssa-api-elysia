import { db } from "./db";
import { users } from "./schema";
import data from "../json/users.json";

interface UserJson {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  password: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  avatar: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  ku_uid: string | null;
  ku_faculty_id: string | null;
  ku_position: string | null;
  created_at: string;
  updated_at: string;
  management_position: string | null;
  is_management: boolean;
}

async function seed() {
  // กรอง email ซ้ำ (case-insensitive) เก็บตัวแรก
  const seen = new Set<string>();
  const items: UserJson[] = data.data.filter((item: UserJson) => {
    const key = item.email.toLowerCase();
    if (seen.has(key)) {
      console.log(`Skipping duplicate email: ${item.email} (id: ${item.id})`);
      return false;
    }
    seen.add(key);
    return true;
  });

  // กรอง ku_uid ซ้ำ — เก็บตัวแรก ตัวที่เหลือ set เป็น null
  const seenKuUid = new Set<string>();
  for (const item of items) {
    if (item.ku_uid) {
      if (seenKuUid.has(item.ku_uid)) {
        console.log(`Duplicate ku_uid: ${item.ku_uid} (id: ${item.id}) -> set to null`);
        item.ku_uid = null;
      } else {
        seenKuUid.add(item.ku_uid);
      }
    }
  }

  console.log(`Found ${items.length} users to migrate...`);

  let inserted = 0;
  let skipped = 0;

  // Upsert ทีละ batch (50 records) — เพิ่มเฉพาะที่ยังไม่มีใน DB
  const batchSize = 50;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const result = await db.insert(users).values(
      batch.map((item) => ({
        id: item.id,
        username: item.email.toLowerCase(),
        email: item.email.toLowerCase(),
        password: item.password,
        nameTh: item.name,
        phone: item.phone,
        avatar: item.avatar,
        kuUid: item.ku_uid,
        kuFacultyId: item.ku_faculty_id,
        kuPosition: item.ku_position,
        isActive: item.is_active,
        emailVerifiedAt: item.email_verified_at ? new Date(item.email_verified_at) : null,
        lastLoginAt: item.last_login_at ? new Date(item.last_login_at) : null,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
      }))
    ).onConflictDoNothing(); // ข้ามถ้า email หรือ id ซ้ำ

    const batchInserted = Number((result as any).rowCount ?? batch.length);
    inserted += batchInserted;
    skipped += batch.length - batchInserted;
    console.log(`Processed ${Math.min(i + batchSize, items.length)}/${items.length} records...`);
  }

  console.log(`Migration complete! ${inserted} inserted, ${skipped} skipped (already existed).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
