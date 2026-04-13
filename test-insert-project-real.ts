import { db } from "./src/db";
import { projects, projectDetails, projectTargets, projectDetailSdgs } from "./src/schema";

async function test() {
  try {
    const result = await db.transaction(async (tx) => {
      // 1) สร้าง project หลัก
      const [newProject] = await tx
        .insert(projects)
        .values({
          parentId: 1, // mock
          projectName: "Test Project",
          initialBudget: "1000",
          orgId: 1, // mock
          budgetTypeId: null,
          budgetGroupId: null,
          year: "2568",
          documentReference: null,
          notes: null,
          projectType: "sub",
          status: "draft",
          createdBy: 1,
        })
        .returning();

      console.log("Project created:", newProject.id);

      // 2) สร้าง project_details
      const [newProjectDetail] = await tx
        .insert(projectDetails)
        .values({
          projectId: newProject.id,
          projectManagerId: 1,
          principlesAndReasons: "test",
          objectives: "test",
          targetGroup: "test",
        })
        .returning();
      console.log("Details created:", newProjectDetail.id);

      // 3) สร้าง project_targets
      const targets = [ { name: "ข้อ 1", value: "", unit: "" } ];
      if (targets && targets.length > 0) {
        const targetValues = targets.map((t, idx) => ({
          projectDetailId: newProjectDetail.id,
          targetDescription: t.name,
          targetValue: t.value || "0",
          measurementUnit: t.unit || "",
          orderNumber: idx + 1,
        }));
        await tx.insert(projectTargets).values(targetValues);
        console.log("Targets created");
      }

      return newProject;
    });
    console.log("Success");
  } catch (e) {
    console.error("FAILED:", e);
  }
}
test();
