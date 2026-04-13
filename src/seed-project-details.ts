import { db } from "./db";
import { projects, projectDetails, projectTargets, projectDetailSdgs } from "./schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const dataPath = path.join(".", "json", "project-details.json");

type TargetStatus = "pending" | "in_progress" | "achieved" | "completed" | "cancelled";

const VALID_TARGET_STATUSES: TargetStatus[] = [
  "pending", "in_progress", "achieved", "completed", "cancelled",
];

interface TargetJson {
  id: number;
  project_detail_id: number;
  target_description: string | null;
  order_number: number | null;
  target_status: string;
  target_value: string | number | null;
  actual_value: string | number | null;
  measurement_unit: string | null;
  completion_percentage: string | number | null;
  target_start_date: string | null;
  target_end_date: string | null;
  actual_completion_date: string | null;
  target_criteria: string | null;
  achievement_notes: string | null;
  challenges: string | null;
  lessons_learned: string | null;
  responsible_user_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface SdgPivot {
  project_detail_id: number;
  sdg_id: number;
  created_at: string;
  updated_at: string;
}

interface SdgJson {
  id: number;
  code: string;
  name: string;
  pivot: SdgPivot;
}

interface ProjectDetailJson {
  id: number;
  project_id: number;
  project_manager_id: number | null;
  department_id: number | null;
  principles_and_reasons: string | null;
  objectives: string | null;
  target_group: string | null;
  project_start_date: string | null;
  project_end_date: string | null;
  expected_completion_date: string | null;
  project_scope: string | null;
  success_criteria: string | null;
  risk_assessment: string | null;
  strategy_id: number | null;
  book_number: string | null;
  date_info: string | null;
  summary_info: string | null;
  supporting_document_path_new: string | null;
  supporting_document_name_new: string | null;
  evaluation_document_path_new: string | null;
  evaluation_document_name_new: string | null;
  summary_completed_at: string | null;
  summary_completed_by: number | { id: number; name: string; email: string } | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  targets: TargetJson[];
  selected_sdgs: SdgJson[];
}

function mapTargetStatus(raw: string): TargetStatus {
  return VALID_TARGET_STATUSES.includes(raw as TargetStatus)
    ? (raw as TargetStatus)
    : "pending";
}

// บางฟิลด์ใน JSON อาจเป็น object {id, name, email} หรือ integer หรือ null
function toUserId(val: number | { id: number } | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "object") return val.id;
  return val;
}

function toDate(val: string | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toNumeric(val: string | number | null): string | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : String(n);
}

async function seedProjectDetails() {
  try {
    console.log("🌱 Starting project-details seed...");

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const { data }: { data: ProjectDetailJson[] } = JSON.parse(rawData);

    console.log(`📂 Found ${data.length} project-detail records in JSON file`);

    // ล้างข้อมูลเก่า (project_targets และ project_detail_sdgs ถูก CASCADE ลบด้วย)
    await db.execute(sql`TRUNCATE TABLE project_detail_sdgs RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE project_targets RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE project_details RESTART IDENTITY CASCADE`);

    // ดึง project IDs ที่มีอยู่จริงใน DB — กรอง detail ที่ FK จะ fail ออกก่อน
    const validProjRows = await db.select({ id: projects.id }).from(projects);
    const validProjectIds = new Set(validProjRows.map((r) => r.id));
    console.log(`🗄️  Valid project IDs in DB: ${validProjectIds.size}`);

    const sorted = [...data].sort((a, b) => a.id - b.id);

    let detailInserted = 0;
    let detailSkipped = 0;
    let detailErrors = 0;
    let targetInserted = 0;
    let sdgInserted = 0;
    const errorIds: number[] = [];

    for (const record of sorted) {
      // ข้าม record ที่ project_id ไม่มีในระบบ
      if (!validProjectIds.has(record.project_id)) {
        detailSkipped++;
        continue;
      }

      try {
        // --- Insert project_details ---
        await db.insert(projectDetails).values({
          id: record.id,
          projectId: record.project_id,
          projectManagerId: record.project_manager_id,
          departmentId: record.department_id,
          principlesAndReasons: record.principles_and_reasons,
          objectives: record.objectives,
          targetGroup: record.target_group,
          projectStartDate: record.project_start_date ?? null,
          projectEndDate: record.project_end_date ?? null,
          expectedCompletionDate: record.expected_completion_date ?? null,
          projectScope: record.project_scope,
          successCriteria: record.success_criteria,
          riskAssessment: record.risk_assessment,
          strategyId: record.strategy_id,
          bookNumber: record.book_number,
          dateInfo: record.date_info,
          summaryInfo: record.summary_info,
          supportingDocumentPathNew: record.supporting_document_path_new,
          supportingDocumentNameNew: record.supporting_document_name_new,
          evaluationDocumentPathNew: record.evaluation_document_path_new,
          evaluationDocumentNameNew: record.evaluation_document_name_new,
          summaryCompletedAt: toDate(record.summary_completed_at),
          summaryCompletedBy: toUserId(record.summary_completed_by),
          createdAt: new Date(record.created_at),
          updatedAt: new Date(record.updated_at),
          deletedAt: toDate(record.deleted_at),
        });
        detailInserted++;

        // --- Insert project_targets ---
        if (record.targets && record.targets.length > 0) {
          const batchSize = 50;
          for (let i = 0; i < record.targets.length; i += batchSize) {
            const batch = record.targets.slice(i, i + batchSize);
            await db.insert(projectTargets).values(
              batch.map((t) => ({
                id: t.id,
                projectDetailId: t.project_detail_id,
                targetDescription: t.target_description,
                orderNumber: t.order_number,
                targetStatus: mapTargetStatus(t.target_status),
                targetValue: toNumeric(t.target_value),
                actualValue: toNumeric(t.actual_value),
                measurementUnit: t.measurement_unit,
                completionPercentage: toNumeric(t.completion_percentage) ?? "0",
                targetStartDate: t.target_start_date ?? null,
                targetEndDate: t.target_end_date ?? null,
                actualCompletionDate: t.actual_completion_date ?? null,
                targetCriteria: t.target_criteria,
                achievementNotes: t.achievement_notes,
                challenges: t.challenges,
                lessonsLearned: t.lessons_learned,
                responsibleUserId: t.responsible_user_id,
                createdAt: new Date(t.created_at),
                updatedAt: new Date(t.updated_at),
                deletedAt: toDate(t.deleted_at),
              }))
            );
            targetInserted += batch.length;
          }
        }

        // --- Insert project_detail_sdgs ---
        if (record.selected_sdgs && record.selected_sdgs.length > 0) {
          for (const sdg of record.selected_sdgs) {
            await db.insert(projectDetailSdgs).values({
              projectDetailId: sdg.pivot.project_detail_id,
              sdgId: sdg.pivot.sdg_id,
              createdAt: new Date(sdg.pivot.created_at),
              updatedAt: new Date(sdg.pivot.updated_at),
            }).onConflictDoNothing();
            sdgInserted++;
          }
        }

        const processed = detailInserted + detailErrors;
        if (processed % 50 === 0) {
          console.log(`✓ Processed ${processed}/${sorted.length - detailSkipped} project-details...`);
        }
      } catch (err) {
        detailErrors++;
        errorIds.push(record.id);
        const cause = (err as any).cause?.message ?? (err as any).message ?? String(err);
        console.error(
          `✗ Error detail.id=${record.id} (project_id=${record.project_id}): ${cause.split("\n")[0]}`
        );
      }
    }

    console.log(`\n✅ Project-details seed completed!`);
    console.log(`   📊 project_details inserted: ${detailInserted}`);
    console.log(`   🎯 project_targets inserted:  ${targetInserted}`);
    console.log(`   🌍 project_detail_sdgs inserted: ${sdgInserted}`);
    console.log(`   ⊘  Skipped (project_id ไม่อยู่ใน DB): ${detailSkipped}`);
    console.log(`   ❌ Errors: ${detailErrors}`);
    if (errorIds.length > 0) {
      console.log(`   ⚠️  Failed IDs: ${errorIds.join(", ")}`);
    }

    const detailCountRes = await db.select({ count: sql<string>`COUNT(*)::text` }).from(projectDetails);
    const targetCountRes = await db.select({ count: sql<string>`COUNT(*)::text` }).from(projectTargets);
    console.log(`   🗄️  DB: ${detailCountRes[0]?.count} project_details, ${targetCountRes[0]?.count} project_targets\n`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
}

seedProjectDetails();
