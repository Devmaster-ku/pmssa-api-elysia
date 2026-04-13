import { db } from "./src/db";
import { users } from "./src/schema";
import { eq } from "drizzle-orm";

async function check() {
  const u = await db.select({ id: users.id, nameTh: users.nameTh }).from(users).limit(5);
  console.log("Sample users:", u);
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
