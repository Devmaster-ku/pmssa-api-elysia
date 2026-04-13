import { db } from "./db";
import { projects } from "./schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const dataPath = path.join(".", "json", "projects.json");

type ProjectStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "active"
  | "completed"
  | "cancelled";

type ProjectType = "main" | "sub";

interface ProjectJson {
  id: number;
  parent_id: number | null;
  project_code: string | null;
  project_name: string;
  project_type: string;
  level: number;
  path: string | null;
  budget_type_id: number | null;
  budget_group_id: number | null;
  initial_budget: number | null;
  allocated_budget: number | null;
  actual_value: number | null;
  document_reference: string | null;
  document_number: string | null;
  document_date: string | null;
  notes: string | null;
  content: string | null;
  recipient: string | null;
  department_id: number; // maps to org_id
  created_by: number | null;
  status: string;
  year: string;
  submitted_at: string | null;
  submitted_by: number | null;
  approved_at: string | null;
  approved_by: number | null;
  approval_note: string | null;
  rejected_at: string | null;
  rejected_by: number | null;
  rejection_reason: string | null;
  started_at: string | null;
  started_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// สถานะที่ระบบรองรับ — fallback เป็น 'draft' ถ้าไม่ตรง
const VALID_STATUSES: ProjectStatus[] = [
  "draft", "pending_approval", "approved",
  "rejected", "active", "completed", "cancelled",
];

function mapStatus(raw: string): ProjectStatus {
  return VALID_STATUSES.includes(raw as ProjectStatus)
    ? (raw as ProjectStatus)
    : "draft";
}

function mapType(raw: string): ProjectType {
  return raw === "sub" ? "sub" : "main";
}

function toDate(val: string | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function seedProjects() {
  try {
    console.log("🌱 Starting projects seed...");

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const { data }: { data: ProjectJson[] } = JSON.parse(rawData);

    console.log(`📂 Found ${data.length} project records in JSON file`);

    // ล้างข้อมูลเก่า — CASCADE จะลบ project_details, project_targets, project_detail_sdgs ด้วย
    await db.execute(sql`TRUNCATE TABLE project_detail_sdgs RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE project_targets RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE project_details RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE projects RESTART IDENTITY CASCADE`);

    // จัดเรียง: parent_id = null ก่อน เพื่อรักษา FK constraints
    const sorted = [...data].sort((a, b) => {
      if (a.parent_id === null && b.parent_id !== null) return -1;
      if (a.parent_id !== null && b.parent_id === null) return 1;
      return a.id - b.id;
    });

    const batchSize = 50;
    let inserted = 0;
    let errors = 0;
    const errorIds: number[] = [];

    for (let i = 0; i < sorted.length; i += batchSize) {
      const batch = sorted.slice(i, i + batchSize);

      try {
        await db.insert(projects).values(
          batch.map((p) => ({
            id: p.id,
            parentId: p.parent_id,
            projectCode: p.project_code,
            projectName: p.project_name,
            projectType: mapType(p.project_type),
            level: p.level ?? 0,
            path: p.path,
            orgId: p.department_id,
            year: p.year ?? "2568",
            budgetTypeId: p.budget_type_id,
            budgetGroupId: p.budget_group_id,
            initialBudget: p.initial_budget !== null ? String(p.initial_budget) : null,
            allocatedBudget: p.allocated_budget !== null ? String(p.allocated_budget) : null,
            actualValue: p.actual_value !== null ? String(p.actual_value) : "0",
            documentReference: p.document_reference,
            documentNumber: p.document_number,
            documentDate: p.document_date ?? null,
            content: p.content,
            notes: p.notes,
            recipient: p.recipient,
            status: mapStatus(p.status),
            createdBy: p.created_by,
            submittedAt: toDate(p.submitted_at),
            submittedBy: p.submitted_by,
            approvedAt: toDate(p.approved_at),
            approvedBy: p.approved_by,
            approvalNote: p.approval_note,
            rejectedAt: toDate(p.rejected_at),
            rejectedBy: p.rejected_by,
            rejectionReason: p.rejection_reason,
            startedAt: toDate(p.started_at),
            startedBy: p.started_by,
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at),
            deletedAt: toDate(p.deleted_at),
          }))
        );
        inserted += batch.length;
        console.log(`✓ Inserted ${inserted}/${sorted.length} projects...`);
      } catch (err) {
        // batch ล้มเหลว — แทรกทีละรายการเพื่อระบุตัวที่มีปัญหา
        for (const p of batch) {
          try {
            await db.insert(projects).values({
              id: p.id,
              parentId: p.parent_id,
              projectCode: p.project_code,
              projectName: p.project_name,
              projectType: mapType(p.project_type),
              level: p.level ?? 0,
              path: p.path,
              orgId: p.department_id,
              year: p.year ?? "2568",
              budgetTypeId: p.budget_type_id,
              budgetGroupId: p.budget_group_id,
              initialBudget: p.initial_budget !== null ? String(p.initial_budget) : null,
              allocatedBudget: p.allocated_budget !== null ? String(p.allocated_budget) : null,
              actualValue: p.actual_value !== null ? String(p.actual_value) : "0",
              documentReference: p.document_reference,
              documentNumber: p.document_number,
              documentDate: p.document_date ?? null,
              content: p.content,
              notes: p.notes,
              recipient: p.recipient,
              status: mapStatus(p.status),
              createdBy: p.created_by,
              submittedAt: toDate(p.submitted_at),
              submittedBy: p.submitted_by,
              approvedAt: toDate(p.approved_at),
              approvedBy: p.approved_by,
              approvalNote: p.approval_note,
              rejectedAt: toDate(p.rejected_at),
              rejectedBy: p.rejected_by,
              rejectionReason: p.rejection_reason,
              startedAt: toDate(p.started_at),
              startedBy: p.started_by,
              createdAt: new Date(p.created_at),
              updatedAt: new Date(p.updated_at),
              deletedAt: toDate(p.deleted_at),
            });
            inserted++;
          } catch (e) {
            errors++;
            errorIds.push(p.id);
            console.error(`✗ Error inserting project id=${p.id}:`, (e as any).message?.split("\n")[0]);
          }
        }
      }
    }

    console.log(`\n✅ Projects seed completed!`);
    console.log(`   📊 Inserted: ${inserted}`);
    console.log(`   ❌ Errors:   ${errors}`);
    if (errorIds.length > 0) {
      console.log(`   ⚠️  Failed IDs: ${errorIds.join(", ")}`);
    }

    const countResult = await db.select({ count: sql<string>`COUNT(*)::text` }).from(projects);
    const dbCount = countResult[0]?.count ?? "?";
    console.log(`   🗄️  Database now has: ${dbCount} project records`);

    if (errors > 0) {
      console.log(`   ℹ️  Failed IDs มี org_id ที่ไม่มีในตาราง organizations — ข้ามได้`);
    }
    console.log();

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
}

seedProjects();
