import { db } from "./src/db";

async function fixSequences() {
  // Fix projects sequence
  await db.execute(`SELECT setval(pg_get_serial_sequence('projects', 'id'), (SELECT MAX(id) FROM projects))`);
  // Fix project_details sequence
  await db.execute(`SELECT setval(pg_get_serial_sequence('project_details', 'id'), (SELECT MAX(id) FROM project_details))`);
  // Fix project_targets sequence
  await db.execute(`SELECT setval(pg_get_serial_sequence('project_targets', 'id'), (SELECT MAX(id) FROM project_targets))`);
  // Fix project_detail_sdgs sequence
  await db.execute(`SELECT setval(pg_get_serial_sequence('project_detail_sdgs', 'id'), (SELECT MAX(id) FROM project_detail_sdgs))`);
  console.log("✅ Sequences reset to max(id) for all project tables");
}
fixSequences().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
