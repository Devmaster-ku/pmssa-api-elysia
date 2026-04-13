import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  boolean,
  text,
  jsonb,
  numeric,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================
// Role enum ที่ใช้ทั้งระบบ (10 บทบาท ตาม level-user.txt v2.0)
// =============================================
export const roleEnum = [
  "super_admin",       // ผู้ดูแลระบบสูงสุด — ทุกข้อมูลในระบบ (ดู+แก้ไข+จัดการระบบ)
  "univ_executive",    // ผู้บริหารระดับมหาวิทยาลัย — ทุกวิทยาเขต (ดูอย่างเดียว)
  "univ_officer",      // เจ้าหน้าที่ระดับมหาวิทยาลัย — ทุกวิทยาเขต (ดูอย่างเดียว)
  "campus_executive",  // ผู้บริหารระดับวิทยาเขต — เฉพาะวิทยาเขตที่สังกัด (ดูอย่างเดียว)
  "campus_officer",    // เจ้าหน้าที่ระดับวิทยาเขต — เฉพาะวิทยาเขตที่สังกัด (ดูอย่างเดียว)
  "faculty_executive", // ผู้บริหารระดับหน่วยงานหลัก — หน่วยงานหลัก+ย่อย (ดูอย่างเดียว)
  "unit_head",         // หัวหน้าหน่วยงานย่อย — เฉพาะหน่วยงานย่อยที่สังกัด (ดูอย่างเดียว)
  "org_admin",         // ผู้ดูแลระบบระดับหน่วยงาน — หน่วยงานที่สังกัด (ดู+แก้ไข+จัดการสิทธิ์)
  "project_lead",      // หัวหน้าโครงการ — เฉพาะโครงการของตน (ดู+แก้ไข)
  "staff",             // อาจารย์/เจ้าหน้าที่ — เฉพาะหน่วยงานย่อย+โครงการที่ได้รับสิทธิ์ (ดู+แก้ไข)
] as const;

// Roles ที่เป็น view-only (ไม่มีสิทธิ์แก้ไข)
export const viewOnlyRoles = [
  "univ_executive",
  "univ_officer",
  "campus_executive",
  "campus_officer",
  "faculty_executive",
  "unit_head",
] as const;

// Roles ที่สามารถแก้ไขข้อมูลได้
export const editableRoles = [
  "super_admin",
  "org_admin",
  "project_lead",
  "staff",
] as const;

// =============================================
// pgEnum definitions
// =============================================
export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "univ_executive",
  "univ_officer",
  "campus_executive",
  "campus_officer",
  "faculty_executive",
  "unit_head",
  "org_admin",
  "project_lead",
  "staff",
]);

export const orgLevelEnum = pgEnum("org_level", [
  "university",
  "campus",
  "faculty",
  "department",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "active",
  "completed",
  "cancelled",
]);

export const projectTypeEnum = pgEnum("project_type", ["main", "sub"]);

export const targetStatusEnum = pgEnum("target_status", [
  "pending",
  "in_progress",
  "achieved",
  "completed",
  "cancelled",
]);

export const roleInProjectEnum = pgEnum("role_in_project", [
  "lead",
  "member",
  "viewer",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "read",
  "update",
  "delete",
]);

export const detailTypeEnum = pgEnum("detail_type", ["main", "sub"]);

export const announcementTypeEnum = pgEnum("announcement_type", [
  "info",
  "warning",
  "success",
  "danger",
]);

export const fundingGroupEnum = pgEnum("funding_group", [
  "main",
  "supplement",
  "other",
]);

export const workPlanStatusEnum = pgEnum("work_plan_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const budgetExpenseTypeEnum = pgEnum("budget_expense_type", [
  "main",
  "sub",
  "custom",
]);

// =============================================
// ตาราง campus - วิทยาเขต
// =============================================
export const campus = pgTable("campus", {
  id: serial("id").primaryKey(),
  nameTh: varchar("name_th", { length: 255 }).notNull(),
  nameEn: varchar("name_en", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =============================================
// ตาราง organizations - หน่วยงาน (รองรับ 4 ระดับ)
// university → campus → faculty → department
// =============================================
export const organizations = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    parentId: integer("parent_id"), // self-reference สำหรับโครงสร้างลำดับชั้น
    campusId: integer("campus_id"), // วิทยาเขตที่สังกัด (NULL = ส่วนกลาง/บางเขน)
    code: varchar("code", { length: 50 }).notNull(),
    nameTh: varchar("name_th", { length: 255 }).notNull(), // ชื่อหน่วยงาน (ภาษาไทย)
    nameEn: varchar("name_en", { length: 255 }), // ชื่อหน่วยงาน (ภาษาอังกฤษ)
    orgLevel: orgLevelEnum("org_level").notNull().default("faculty"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_organizations_parent_id").on(table.parentId),
    index("idx_organizations_campus_id").on(table.campusId),
    index("idx_organizations_org_level").on(table.orgLevel),
  ]
);

// =============================================
// ตาราง users - ผู้ใช้งาน (รองรับ KU ALL LOGIN)
// ข้อมูลส่วนตัวเท่านั้น — role/ตำแหน่ง อยู่ใน user_affiliations
// =============================================
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),

    // ข้อมูลระบบ
    username: varchar("username", { length: 100 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }), // nullable - KU users ไม่ต้องมี password

    // ข้อมูลส่วนตัว
    nameTh: varchar("name_th", { length: 255 }).notNull(), // ชื่อ-นามสกุล (ภาษาไทย)
    nameEn: varchar("name_en", { length: 255 }), // ชื่อ-นามสกุล (ภาษาอังกฤษ)
    phone: varchar("phone", { length: 50 }),
    avatar: varchar("avatar", { length: 500 }),

    // KU ALL LOGIN fields
    kuUid: varchar("ku_uid", { length: 100 }).unique(), // UID จาก KU ALL LOGIN
    kuFacultyId: varchar("ku_faculty_id", { length: 50 }), // Faculty ID จาก KU
    kuPosition: varchar("ku_position", { length: 255 }), // ตำแหน่งจาก KU

    // สถานะ
    isActive: boolean("is_active").notNull().default(true),
    emailVerifiedAt: timestamp("email_verified_at"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_users_ku_uid").on(table.kuUid),
  ]
);

// =============================================
// ตาราง user_affiliations - ความสัมพันธ์ผู้ใช้กับหน่วยงาน
// ตารางหลักของระบบ: 1 user มีได้หลายสังกัด พร้อม role ที่แตกต่างกัน
// =============================================
export const userAffiliations = pgTable(
  "user_affiliations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subDepId: integer("sub_dep_id")
      .references(() => organizations.id, { onDelete: "set null" }),
    role: userRoleEnum("role").notNull().default("staff"),
    positionTitle: varchar("position_title", { length: 255 }), // ตำแหน่งจริง เช่น "หัวหน้าภาควิชา", "รองอธิการบดี"
    isPrimary: boolean("is_primary").notNull().default(false), // เป็นสังกัดหลักหรือไม่
    isActive: boolean("is_active").notNull().default(true),
    startDate: date("start_date"), // วันที่เริ่มสังกัด
    endDate: date("end_date"), // วันที่สิ้นสุดสังกัด (NULL = ยังสังกัดอยู่)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_user_org_role").on(table.userId, table.orgId, table.role),
    index("idx_affiliations_org_id").on(table.orgId),
    index("idx_affiliations_role").on(table.role),
    index("idx_affiliations_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง projects - โครงการ
// =============================================
export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),

    // โครงสร้างลำดับชั้น
    parentId: integer("parent_id"),           // self-ref สำหรับโครงการแม่-ลูก
    projectCode: varchar("project_code", { length: 100 }),
    projectName: varchar("project_name", { length: 500 }).notNull(),
    projectType: projectTypeEnum("project_type").notNull().default("main"), // main | sub
    level: integer("level").default(0),       // ระดับลำดับชั้น (0 = โครงการหลัก)
    path: varchar("path", { length: 500 }),   // เส้นทางลำดับชั้น เช่น "113/156"

    // สังกัดและปีงบประมาณ
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    year: varchar("year", { length: 10 }).notNull().default("2568"), // ปีงบประมาณ (พ.ศ.)

    // งบประมาณ
    budgetTypeId: integer("budget_type_id"),   // FK to budget_types
    budgetGroupId: integer("budget_group_id"), // FK to budget_groups
    initialBudget: numeric("initial_budget", { precision: 15, scale: 2 }),
    allocatedBudget: numeric("allocated_budget", { precision: 15, scale: 2 }),
    actualValue: numeric("actual_value", { precision: 15, scale: 2 }).default("0"),

    // ข้อมูลโครงการ
    recipient: varchar("recipient", { length: 500 }),
    documentReference: varchar("document_reference", { length: 500 }),
    documentNumber: varchar("document_number", { length: 255 }),
    documentDate: date("document_date"),
    content: text("content"),
    notes: text("notes"),

    // สถานะและผู้รับผิดชอบ
    status: projectStatusEnum("status").notNull().default("draft"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    leadUserId: integer("lead_user_id").references(() => users.id, { onDelete: "set null" }),

    // Workflow timestamps
    submittedAt: timestamp("submitted_at"),
    submittedBy: integer("submitted_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at"),
    approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvalNote: text("approval_note"),
    rejectedAt: timestamp("rejected_at"),
    rejectedBy: integer("rejected_by").references(() => users.id, { onDelete: "set null" }),
    rejectionReason: text("rejection_reason"),
    startedAt: timestamp("started_at"),
    startedBy: integer("started_by").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_projects_parent_id").on(table.parentId),
    index("idx_projects_org_id").on(table.orgId),
    index("idx_projects_status").on(table.status),
    index("idx_projects_year").on(table.year),
    index("idx_projects_project_type").on(table.projectType),
    index("idx_projects_lead_user_id").on(table.leadUserId),
    index("idx_projects_budget_type_id").on(table.budgetTypeId),
    index("idx_projects_budget_group_id").on(table.budgetGroupId),
  ]
);

// =============================================
// ตาราง project_members - สมาชิกโครงการ
// =============================================
export const projectMembers = pgTable(
  "project_members",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleInProject: roleInProjectEnum("role_in_project").notNull().default("member"),
    canEdit: boolean("can_edit").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_project_user").on(table.projectId, table.userId),
    index("idx_project_members_user_id").on(table.userId),
  ]
);

// =============================================
// ตาราง project_details - รายละเอียดโครงการ
// =============================================
export const projectDetails = pgTable(
  "project_details",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    projectManagerId: integer("project_manager_id").references(() => users.id, { onDelete: "set null" }),
    departmentId: integer("department_id").references(() => organizations.id, { onDelete: "set null" }),

    // เนื้อหาโครงการ
    principlesAndReasons: text("principles_and_reasons"),  // หลักการและเหตุผล
    objectives: text("objectives"),                        // วัตถุประสงค์
    targetGroup: text("target_group"),                     // กลุ่มเป้าหมาย
    projectScope: text("project_scope"),                   // ขอบเขตโครงการ
    successCriteria: text("success_criteria"),             // เกณฑ์ความสำเร็จ
    riskAssessment: text("risk_assessment"),               // การประเมินความเสี่ยง

    // กำหนดการ
    projectStartDate: date("project_start_date"),
    projectEndDate: date("project_end_date"),
    expectedCompletionDate: date("expected_completion_date"),

    // ยุทธศาสตร์ที่เชื่อมโยง
    strategyId: integer("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
    strategyAlignments: jsonb("strategy_alignments"),

    // เอกสารและข้อมูลอ้างอิง
    bookNumber: varchar("book_number", { length: 100 }),
    dateInfo: varchar("date_info", { length: 255 }),

    // สรุปผลการดำเนินงาน
    summaryInfo: text("summary_info"),
    summaryCompletedAt: timestamp("summary_completed_at"),
    summaryCompletedBy: integer("summary_completed_by").references(() => users.id, { onDelete: "set null" }),

    // ไฟล์แนบ
    supportingDocumentPathNew: varchar("supporting_document_path_new", { length: 500 }),
    supportingDocumentNameNew: varchar("supporting_document_name_new", { length: 500 }),
    evaluationDocumentPathNew: varchar("evaluation_document_path_new", { length: 500 }),
    evaluationDocumentNameNew: varchar("evaluation_document_name_new", { length: 500 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_project_details_project_id").on(table.projectId),
    index("idx_project_details_project_manager_id").on(table.projectManagerId),
    index("idx_project_details_department_id").on(table.departmentId),
    index("idx_project_details_strategy_id").on(table.strategyId),
  ]
);

// =============================================
// ตาราง project_targets - เป้าหมายโครงการ
// =============================================
export const projectTargets = pgTable(
  "project_targets",
  {
    id: serial("id").primaryKey(),
    projectDetailId: integer("project_detail_id")
      .notNull()
      .references(() => projectDetails.id, { onDelete: "cascade" }),

    targetDescription: text("target_description"),        // คำอธิบายเป้าหมาย
    orderNumber: integer("order_number"),
    targetStatus: targetStatusEnum("target_status").default("pending"),

    // ค่าเป้าหมาย
    targetValue: numeric("target_value", { precision: 15, scale: 2 }),
    actualValue: numeric("actual_value", { precision: 15, scale: 2 }),
    measurementUnit: varchar("measurement_unit", { length: 100 }),
    completionPercentage: numeric("completion_percentage", { precision: 5, scale: 2 }).default("0"),

    // กำหนดการ
    targetStartDate: date("target_start_date"),
    targetEndDate: date("target_end_date"),
    actualCompletionDate: date("actual_completion_date"),

    // บันทึกผล
    targetCriteria: text("target_criteria"),
    achievementNotes: text("achievement_notes"),
    challenges: text("challenges"),
    lessonsLearned: text("lessons_learned"),

    responsibleUserId: integer("responsible_user_id").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_project_targets_project_detail_id").on(table.projectDetailId),
    index("idx_project_targets_target_status").on(table.targetStatus),
    index("idx_project_targets_responsible_user_id").on(table.responsibleUserId),
  ]
);

// =============================================
// ตาราง project_detail_sdgs - โครงการกับ SDGs (junction table)
// =============================================
export const projectDetailSdgs = pgTable(
  "project_detail_sdgs",
  {
    id: serial("id").primaryKey(),
    projectDetailId: integer("project_detail_id")
      .notNull()
      .references(() => projectDetails.id, { onDelete: "cascade" }),
    sdgId: integer("sdg_id")
      .notNull()
      .references(() => sdgs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_project_detail_sdg").on(table.projectDetailId, table.sdgId),
    index("idx_project_detail_sdgs_project_detail_id").on(table.projectDetailId),
    index("idx_project_detail_sdgs_sdg_id").on(table.sdgId),
  ]
);

// =============================================
// ตาราง audit_logs - บันทึกการกระทำ
// =============================================
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    action: auditActionEnum("action").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorAffiliationId: integer("actor_affiliation_id").references(
      () => userAffiliations.id,
      { onDelete: "set null" }
    ),
    targetResource: varchar("target_resource", { length: 100 }).notNull(), // เช่น "project", "user", "organization"
    targetResourceId: varchar("target_resource_id", { length: 100 }), // ID ของ resource
    details: jsonb("details"), // รายละเอียดเพิ่มเติม
    ipAddress: varchar("ip_address", { length: 50 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_logs_actor").on(table.actorUserId),
    index("idx_audit_logs_resource").on(table.targetResource),
    index("idx_audit_logs_created_at").on(table.createdAt),
  ]
);

// =============================================
// ตาราง strategies - ยุทธศาสตร์ระดับมหาวิทยาลัย
// =============================================
export const strategies = pgTable(
  "strategies",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 1000 }).notNull(),
    campus: varchar("campus", { length: 100 }), // เช่น "บางเขน", "ศรีราชา"
    orderList: integer("order_list"),
    fiscalPlan: varchar("fiscal_plan", { length: 20 }), // แผนปีงบประมาณ เช่น "2568-2573"
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_strategies_campus").on(table.campus),
    index("idx_strategies_order_list").on(table.orderList),
    index("idx_strategies_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง strategic_tactics - กลยุทธ์ภายใต้ยุทธศาสตร์ระดับมหาวิทยาลัย
// =============================================
export const strategicTactics = pgTable(
  "strategic_tactics",
  {
    id: serial("id").primaryKey(),
    strategyId: integer("strategy_id")
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 1000 }).notNull(),
    description: text("description"),
    orderSequence: integer("order_sequence"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_strategic_tactics_strategy_id").on(table.strategyId),
    index("idx_strategic_tactics_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง strategic_departments - ยุทธศาสตร์ระดับหน่วยงาน/คณะ
// =============================================
export const strategicDepartments = pgTable(
  "strategic_departments",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 1000 }).notNull(),
    departmentId: integer("department_id").references(() => organizations.id, { onDelete: "set null" }),
    description: text("description"),
    year: integer("year"), // ปีงบประมาณ (พ.ศ.)
    fiscalPlan: varchar("fiscal_plan", { length: 20 }), // แผนปีงบประมาณ เช่น "2568-2573"
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_strategic_departments_department_id").on(table.departmentId),
    index("idx_strategic_departments_year").on(table.year),
    index("idx_strategic_departments_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง strategic_department_tactics - กลยุทธ์ระดับหน่วยงาน
// =============================================
export const strategicDepartmentTactics = pgTable(
  "strategic_department_tactics",
  {
    id: serial("id").primaryKey(),
    strategicDepartmentId: integer("strategic_department_id")
      .notNull()
      .references(() => strategicDepartments.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 1000 }).notNull(),
    description: text("description"),
    order: integer("order"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_strategic_dept_tactics_dept_id").on(table.strategicDepartmentId),
    index("idx_strategic_dept_tactics_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง strategic_dean_strategies - ยุทธศาสตร์ระดับคณบดีส่วนงาน
// =============================================
export const strategicDeanStrategies = pgTable(
  "strategic_dean_strategies",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 1000 }).notNull(),
    departmentId: integer("department_id").references(() => organizations.id, { onDelete: "set null" }),
    description: text("description"),
    year: integer("year"), // ปีงบประมาณ (พ.ศ.)
    fiscalPlan: varchar("fiscal_plan", { length: 20 }), // แผนปีงบประมาณ เช่น "2568-2573"
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_strategic_dean_strategies_dept_id").on(table.departmentId),
    index("idx_strategic_dean_strategies_year").on(table.year),
    index("idx_strategic_dean_strategies_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง strategic_dean_tactics - กลยุทธ์ระดับคณบดีส่วนงาน
// =============================================
export const strategicDeanTactics = pgTable(
  "strategic_dean_tactics",
  {
    id: serial("id").primaryKey(),
    strategicDeanStrategyId: integer("strategic_dean_strategy_id")
      .notNull()
      .references(() => strategicDeanStrategies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 1000 }).notNull(),
    description: text("description"),
    order: integer("order"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_strategic_dean_tactics_strategy_id").on(table.strategicDeanStrategyId),
    index("idx_strategic_dean_tactics_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง provinces - จังหวัด
// =============================================
export const provinces = pgTable(
  "provinces",
  {
    id: serial("id").primaryKey(),
    nameTh: varchar("name_th", { length: 255 }).notNull(),
    nameEn: varchar("name_en", { length: 255 }),
    geographyId: integer("geography_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_provinces_name_th").on(table.nameTh),
    index("idx_provinces_geography_id").on(table.geographyId),
  ]
);

// =============================================
// ตาราง budget_supports - หมวดงบ (ระดับบนสุด)
// เช่น: งบรายจ่ายอื่น, งบอุดหนุน
// =============================================
export const budgetSupports = pgTable(
  "budget_supports",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    departmentId: integer("department_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_budget_supports_department_id").on(table.departmentId),
    index("idx_budget_supports_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง budget_types - ประเภทงบ
// ref → budget_supports
// เช่น: ค่าใช้จ่ายเงินอุดหนุนทั่วไปเพื่อการดำเนินงาน
// =============================================
export const budgetTypes = pgTable(
  "budget_types",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 500 }).notNull(),
    budgetCategory: varchar("budget_category", { length: 100 }),   // เช่น "support", "other"
    budgetCategoryDisplay: varchar("budget_category_display", { length: 255 }),
    budgetSupportId: integer("budget_support_id")
      .notNull()
      .references(() => budgetSupports.id, { onDelete: "restrict" }),
    departmentId: integer("department_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_budget_types_budget_support_id").on(table.budgetSupportId),
    index("idx_budget_types_department_id").on(table.departmentId),
    index("idx_budget_types_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง budget_groups - กลุ่มงบ
// ref → budget_types
// เช่น: ค่าใช้จ่ายอุดหนุนหน่วยงาน
// =============================================
export const budgetGroups = pgTable(
  "budget_groups",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 500 }).notNull(),
    groupType: varchar("group_type", { length: 100 }),              // เช่น "general_operation"
    groupTypeDisplay: varchar("group_type_display", { length: 500 }),
    budgetTypeId: integer("budget_type_id")
      .notNull()
      .references(() => budgetSubsidyTypes.id, { onDelete: "restrict" }),
    departmentId: integer("department_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_budget_groups_budget_type_id").on(table.budgetTypeId),
    index("idx_budget_groups_department_id").on(table.departmentId),
    index("idx_budget_groups_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง expense_details - รายละเอียดค่าใช้จ่าย
// ref → budget_groups (nullable) + self-ref parent
// detail_type: "main" = หัวข้อหลัก, "sub" = หัวข้อย่อย
// =============================================
export const expenseDetails = pgTable(
  "expense_details",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 500 }).notNull(),
    detailType: detailTypeEnum("detail_type").notNull().default("main"),
    detailTypeDisplay: varchar("detail_type_display", { length: 100 }),
    parentId: integer("parent_id"),                                     // self-ref: parent expense_detail (null = root)
    budgetGroupId: integer("budget_group_id"),                          // FK to budget_groups (only for "main" type)
    departmentId: integer("department_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_expense_details_parent_id").on(table.parentId),
    index("idx_expense_details_budget_group_id").on(table.budgetGroupId),
    index("idx_expense_details_department_id").on(table.departmentId),
    index("idx_expense_details_detail_type").on(table.detailType),
    index("idx_expense_details_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง budget_subsidies - งบอุดหนุน (หมวดหลัก)
// =============================================
export const budgetSubsidies = pgTable(
  "budget_subsidies",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 100 }).notNull(),
    nameTh: varchar("name_th", { length: 500 }).notNull(),
    nameEn: varchar("name_en", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_budget_subsidies_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง budget_subsidy_types - ประเภทงบอุดหนุน
// ref → budget_subsidies
// =============================================
export const budgetSubsidyTypes = pgTable(
  "budget_subsidy_types",
  {
    id: serial("id").primaryKey(),
    subsidyId: integer("subsidy_id")
      .notNull()
      .references(() => budgetSubsidies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 100 }).notNull(),
    nameTh: varchar("name_th", { length: 500 }).notNull(),
    nameEn: varchar("name_en", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_budget_subsidy_types_subsidy_id").on(table.subsidyId),
    index("idx_budget_subsidy_types_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง budget_expense_details - รายละเอียดค่าใช้จ่าย (ระดับงบอุดหนุน)
// ref → budget_groups
// structure: เหมือน expense_details แต่ไม่มี department_id
// =============================================
export const budgetExpenseDetails = pgTable(
  "budget_expense_details",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 500 }).notNull(),
    detailType: detailTypeEnum("detail_type").notNull().default("main"),
    detailTypeDisplay: varchar("detail_type_display", { length: 100 }),
    parentId: integer("parent_id"),                                     // self-ref: parent budget_expense_detail (null = root)
    budgetGroupId: integer("budget_group_id")
      .references(() => budgetGroups.id, { onDelete: "restrict" }), // FK to budget_groups (only for "main" type)
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_budget_expense_details_parent_id").on(table.parentId),
    index("idx_budget_expense_details_budget_group_id").on(table.budgetGroupId),
    index("idx_budget_expense_details_detail_type").on(table.detailType),
    index("idx_budget_expense_details_is_active").on(table.isActive),
  ]
);

// =============================================
// ตาราง role_permissions - สิทธิ์ที่กำหนดให้แต่ละ role ในระบบ
// permissions code กำหนดใน SYSTEM_PERMISSIONS constant ใน settings routes
// =============================================
export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    role: userRoleEnum("role").notNull(),
    permissionCode: varchar("permission_code", { length: 100 }).notNull(),
    granted: boolean("granted").notNull().default(false),
    updatedBy: integer("updated_by"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_role_permission_code").on(table.role, table.permissionCode),
    index("idx_role_permissions_role").on(table.role),
    index("idx_role_permissions_code").on(table.permissionCode),
  ]
);

// =============================================
// Relations
// =============================================

// Campus relations
export const campusRelations = relations(campus, ({ many }) => ({
  organizations: many(organizations),
}));

// Organization relations
export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  parent: one(organizations, {
    fields: [organizations.parentId],
    references: [organizations.id],
    relationName: "orgHierarchy",
  }),
  children: many(organizations, { relationName: "orgHierarchy" }),
  campus: one(campus, {
    fields: [organizations.campusId],
    references: [campus.id],
  }),
  affiliations: many(userAffiliations, { relationName: "affiliationOrg" }),
  subDepAffiliations: many(userAffiliations, { relationName: "affiliationSubDep" }),
  projects: many(projects),
}));

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  affiliations: many(userAffiliations),
  leadProjects: many(projects),
  projectMemberships: many(projectMembers),
}));

// UserAffiliation relations
export const userAffiliationsRelations = relations(
  userAffiliations,
  ({ one }) => ({
    user: one(users, {
      fields: [userAffiliations.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [userAffiliations.orgId],
      references: [organizations.id],
      relationName: "affiliationOrg",
    }),
    subDep: one(organizations, {
      fields: [userAffiliations.subDepId],
      references: [organizations.id],
      relationName: "affiliationSubDep",
    }),
  })
);

// Project relations
export const projectsRelations = relations(projects, ({ one, many }) => ({
  parent: one(projects, {
    fields: [projects.parentId],
    references: [projects.id],
    relationName: "projectHierarchy",
  }),
  children: many(projects, { relationName: "projectHierarchy" }),
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
    relationName: "createdProjects",
  }),
  lead: one(users, {
    fields: [projects.leadUserId],
    references: [users.id],
    relationName: "leadProjects",
  }),
  submitter: one(users, {
    fields: [projects.submittedBy],
    references: [users.id],
    relationName: "submittedProjects",
  }),
  approver: one(users, {
    fields: [projects.approvedBy],
    references: [users.id],
    relationName: "approvedProjects",
  }),
  rejector: one(users, {
    fields: [projects.rejectedBy],
    references: [users.id],
    relationName: "rejectedProjects",
  }),
  starter: one(users, {
    fields: [projects.startedBy],
    references: [users.id],
    relationName: "startedProjects",
  }),
  budgetGroup: one(budgetGroups, {
    fields: [projects.budgetGroupId],
    references: [budgetGroups.id],
  }),
  members: many(projectMembers),
  details: many(projectDetails),
}));

// ProjectDetail relations
export const projectDetailsRelations = relations(projectDetails, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectDetails.projectId],
    references: [projects.id],
  }),
  projectManager: one(users, {
    fields: [projectDetails.projectManagerId],
    references: [users.id],
    relationName: "managedProjectDetails",
  }),
  department: one(organizations, {
    fields: [projectDetails.departmentId],
    references: [organizations.id],
  }),
  strategy: one(strategies, {
    fields: [projectDetails.strategyId],
    references: [strategies.id],
  }),
  summaryCompletedByUser: one(users, {
    fields: [projectDetails.summaryCompletedBy],
    references: [users.id],
    relationName: "completedProjectDetails",
  }),
  targets: many(projectTargets),
  sdgs: many(projectDetailSdgs),
}));

// ProjectTarget relations
export const projectTargetsRelations = relations(projectTargets, ({ one }) => ({
  projectDetail: one(projectDetails, {
    fields: [projectTargets.projectDetailId],
    references: [projectDetails.id],
  }),
  responsibleUser: one(users, {
    fields: [projectTargets.responsibleUserId],
    references: [users.id],
    relationName: "responsibleProjectTargets",
  }),
}));

// ProjectDetailSdg relations
export const projectDetailSdgsRelations = relations(projectDetailSdgs, ({ one }) => ({
  projectDetail: one(projectDetails, {
    fields: [projectDetailSdgs.projectDetailId],
    references: [projectDetails.id],
  }),
  sdg: one(sdgs, {
    fields: [projectDetailSdgs.sdgId],
    references: [sdgs.id],
  }),
}));

// ProjectMember relations
export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

// AuditLog relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
  affiliation: one(userAffiliations, {
    fields: [auditLogs.actorAffiliationId],
    references: [userAffiliations.id],
  }),
}));

// Strategy relations
export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  tactics: many(strategicTactics),
  creator: one(users, {
    fields: [strategies.createdBy],
    references: [users.id],
    relationName: "strategyCreator",
  }),
}));

// StrategicTactic relations
export const strategicTacticsRelations = relations(strategicTactics, ({ one }) => ({
  strategy: one(strategies, {
    fields: [strategicTactics.strategyId],
    references: [strategies.id],
  }),
  creator: one(users, {
    fields: [strategicTactics.createdBy],
    references: [users.id],
    relationName: "strategicTacticCreator",
  }),
}));

// StrategicDepartment relations
export const strategicDepartmentsRelations = relations(strategicDepartments, ({ one, many }) => ({
  department: one(organizations, {
    fields: [strategicDepartments.departmentId],
    references: [organizations.id],
  }),
  tactics: many(strategicDepartmentTactics),
  creator: one(users, {
    fields: [strategicDepartments.createdBy],
    references: [users.id],
    relationName: "strategicDeptCreator",
  }),
}));

// StrategicDepartmentTactic relations
export const strategicDepartmentTacticsRelations = relations(strategicDepartmentTactics, ({ one }) => ({
  strategicDepartment: one(strategicDepartments, {
    fields: [strategicDepartmentTactics.strategicDepartmentId],
    references: [strategicDepartments.id],
  }),
  creator: one(users, {
    fields: [strategicDepartmentTactics.createdBy],
    references: [users.id],
    relationName: "strategicDeptTacticCreator",
  }),
}));

// StrategicDeanStrategy relations
export const strategicDeanStrategiesRelations = relations(strategicDeanStrategies, ({ one, many }) => ({
  department: one(organizations, {
    fields: [strategicDeanStrategies.departmentId],
    references: [organizations.id],
  }),
  tactics: many(strategicDeanTactics),
  creator: one(users, {
    fields: [strategicDeanStrategies.createdBy],
    references: [users.id],
    relationName: "strategicDeanStrategyCreator",
  }),
}));

// StrategicDeanTactic relations
export const strategicDeanTacticsRelations = relations(strategicDeanTactics, ({ one }) => ({
  strategy: one(strategicDeanStrategies, {
    fields: [strategicDeanTactics.strategicDeanStrategyId],
    references: [strategicDeanStrategies.id],
  }),
  creator: one(users, {
    fields: [strategicDeanTactics.createdBy],
    references: [users.id],
    relationName: "strategicDeanTacticCreator",
  }),
}));

// BudgetSupport relations
export const budgetSupportsRelations = relations(budgetSupports, ({ many }) => ({
  budgetTypes: many(budgetTypes),
}));

// BudgetExpenseDetail relations
export const budgetExpenseDetailsRelations = relations(budgetExpenseDetails, ({ one }) => ({
  budgetGroup: one(budgetGroups, {
    fields: [budgetExpenseDetails.budgetGroupId],
    references: [budgetGroups.id],
  }),
}));

// BudgetSubsidy relations
export const budgetSubsidiesRelations = relations(budgetSubsidies, ({ many }) => ({
  budgetSubsidyTypes: many(budgetSubsidyTypes),
}));

// BudgetSubsidyType relations
export const budgetSubsidyTypesRelations = relations(budgetSubsidyTypes, ({ one }) => ({
  subsidy: one(budgetSubsidies, {
    fields: [budgetSubsidyTypes.subsidyId],
    references: [budgetSubsidies.id],
  }),
}));

// BudgetType relations
export const budgetTypesRelations = relations(budgetTypes, ({ one, many }) => ({
  budgetSupport: one(budgetSupports, {
    fields: [budgetTypes.budgetSupportId],
    references: [budgetSupports.id],
  }),
  budgetGroups: many(budgetGroups),
}));

// BudgetGroup relations
export const budgetGroupsRelations = relations(budgetGroups, ({ one, many }) => ({
  budgetType: one(budgetSubsidyTypes, {
    fields: [budgetGroups.budgetTypeId],
    references: [budgetSubsidyTypes.id],
  }),
  expenseDetails: many(expenseDetails),
}));

// ExpenseDetail relations
export const expenseDetailsRelations = relations(expenseDetails, ({ one, many }) => ({
  parent: one(expenseDetails, {
    fields: [expenseDetails.parentId],
    references: [expenseDetails.id],
    relationName: "expenseHierarchy",
  }),
  children: many(expenseDetails, { relationName: "expenseHierarchy" }),
  budgetGroup: one(budgetGroups, {
    fields: [expenseDetails.budgetGroupId],
    references: [budgetGroups.id],
  }),
}));

// =============================================
// ตาราง announcements - ประกาศสำคัญ
// =============================================
export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull(),
    type: announcementTypeEnum("type").notNull().default("info"),
    isActive: boolean("is_active").notNull().default(true),
    isPinned: boolean("is_pinned").notNull().default(false),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_announcements_is_active").on(table.isActive),
    index("idx_announcements_created_at").on(table.createdAt),
  ]
);

// =============================================
// ตาราง sdgs - เป้าหมายการพัฒนาที่ยั่งยืน (Sustainable Development Goals)
// =============================================
export const sdgs = pgTable(
  "sdgs",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: integer("parent_id")
      .references(() => sdgs.id, { onDelete: "set null" }),
    displayName: text("display_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_sdgs_code").on(table.code),
    index("idx_sdgs_parent_id").on(table.parentId),
  ]
);

// SDGs relations
export const sdgsRelations = relations(sdgs, ({ one, many }) => ({
  parent: one(sdgs, {
    fields: [sdgs.parentId],
    references: [sdgs.id],
    relationName: "sdgHierarchy",
  }),
  children: many(sdgs, { relationName: "sdgHierarchy" }),
}));

// =============================================
// ตาราง project_implementations - ข้อมูลการดำเนินโครงการ
// =============================================
export const projectImplementations = pgTable(
  "project_implementations",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pastPerformance: text("past_performance"),             // ผลการดำเนินงานที่ผ่านมา
    riskManagement: text("risk_management"),               // ความเสี่ยงและการบริหารความเสี่ยง
    startDate: date("start_date"),                         // วันที่เริ่มดำเนินงาน
    endDate: date("end_date"),                             // วันที่สิ้นสุดดำเนินงาน
    projectLocation: text("project_location"),             // สถานที่จัดโครงการ
    province: varchar("province", { length: 255 }),        // จังหวัดที่จัดโครงการ
    evaluationMethod: text("evaluation_method"),           // วิธีประเมินผลโครงการ
    expectedOutcome: text("expected_outcome"),             // ผลที่คาดว่าจะได้รับ
    currentStep: integer("current_step").default(1),       // ขั้นตอนปัจจุบันที่บันทึก
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_project_implementations_project_id").on(table.projectId),
  ]
);

// =============================================
// ตาราง project_operators - ผู้ดำเนินโครงการ
// =============================================
export const projectOperators = pgTable(
  "project_operators",
  {
    id: serial("id").primaryKey(),
    implementationId: integer("implementation_id")
      .notNull()
      .references(() => projectImplementations.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    operatorName: varchar("operator_name", { length: 500 }), // ชื่อผู้ดำเนินโครงการ
    responsibility: text("responsibility"),                   // หน้าที่ความรับผิดชอบ
    orderNumber: integer("order_number"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_project_operators_impl_id").on(table.implementationId),
    index("idx_project_operators_user_id").on(table.userId),
  ]
);

// =============================================
// ตาราง project_funding_sources - งบประมาณและแหล่งเงิน
// =============================================
export const projectFundingSources = pgTable(
  "project_funding_sources",
  {
    id: serial("id").primaryKey(),
    implementationId: integer("implementation_id")
      .notNull()
      .references(() => projectImplementations.id, { onDelete: "cascade" }),
    fundingGroup: fundingGroupEnum("funding_group").default("main"),  // กลุ่มแหล่งเงิน
    fundingName: varchar("funding_name", { length: 500 }),            // ชื่อแหล่งเงิน
    amount: numeric("amount", { precision: 15, scale: 2 }).default("0"), // จำนวนเงิน
    fundingType: varchar("funding_type", { length: 255 }),            // ประเภทแหล่งเงิน
    orderNumber: integer("order_number"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_project_funding_sources_impl_id").on(table.implementationId),
  ]
);

// =============================================
// ตาราง project_work_plans - แผนการดำเนินงาน
// =============================================
export const projectWorkPlans = pgTable(
  "project_work_plans",
  {
    id: serial("id").primaryKey(),
    implementationId: integer("implementation_id")
      .notNull()
      .references(() => projectImplementations.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),          // หัวข้อแผนการดำเนินงาน
    description: text("description"),                             // รายละเอียด
    startDate: date("start_date"),                                // วันที่เริ่ม
    endDate: date("end_date"),                                    // วันที่สิ้นสุด
    responsiblePerson: varchar("responsible_person", { length: 500 }), // ผู้รับผิดชอบ
    status: workPlanStatusEnum("status").default("pending"),       // สถานะ
    orderNumber: integer("order_number"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_project_work_plans_impl_id").on(table.implementationId),
  ]
);

// =============================================
// ตาราง project_budget_usages - กำหนดการใช้งบประมาณ
// =============================================
export const projectBudgetUsages = pgTable(
  "project_budget_usages",
  {
    id: serial("id").primaryKey(),
    implementationId: integer("implementation_id")
      .notNull()
      .references(() => projectImplementations.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),                               // self-ref สำหรับ sub ภายใต้ main
    expenseType: budgetExpenseTypeEnum("expense_type").default("main"), // main | sub | custom
    expenseDetailId: integer("expense_detail_id"),                // FK ไป budget_expense_details
    expenseName: varchar("expense_name", { length: 500 }),        // ชื่อค่าใช้จ่าย
    amount: numeric("amount", { precision: 15, scale: 2 }).default("0"),
    calculationMethod: varchar("calculation_method", { length: 255 }),
    necessityReason: text("necessity_reason"),                    // เหตุผลความจำเป็น
    remark: text("remark"),                                       // หมายเหตุ
    personnelCount: integer("personnel_count"),                   // จำนวนบุคลากร
    orderNumber: integer("order_number"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_project_budget_usages_impl_id").on(table.implementationId),
    index("idx_project_budget_usages_parent_id").on(table.parentId),
    index("idx_project_budget_usages_expense_type").on(table.expenseType),
  ]
);

// =============================================
// ตาราง project_signatories - ผู้บริหารที่ลงนามในโครงการ
// =============================================
export const projectSignatories = pgTable(
  "project_signatories",
  {
    id: serial("id").primaryKey(),
    implementationId: integer("implementation_id")
      .notNull()
      .references(() => projectImplementations.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    signatoryName: varchar("signatory_name", { length: 500 }),
    positionTitle: varchar("position_title", { length: 500 }),
    signOrder: integer("sign_order"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_project_signatories_impl_id").on(table.implementationId),
    index("idx_project_signatories_user_id").on(table.userId),
  ]
);

// =============================================
// Relations: Project Implementation tables
// =============================================
export const projectImplementationsRelations = relations(projectImplementations, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectImplementations.projectId],
    references: [projects.id],
  }),
  operators: many(projectOperators),
  fundingSources: many(projectFundingSources),
  workPlans: many(projectWorkPlans),
  budgetUsages: many(projectBudgetUsages),
  signatories: many(projectSignatories),
}));

export const projectOperatorsRelations = relations(projectOperators, ({ one }) => ({
  implementation: one(projectImplementations, {
    fields: [projectOperators.implementationId],
    references: [projectImplementations.id],
  }),
  user: one(users, {
    fields: [projectOperators.userId],
    references: [users.id],
  }),
}));

export const projectFundingSourcesRelations = relations(projectFundingSources, ({ one }) => ({
  implementation: one(projectImplementations, {
    fields: [projectFundingSources.implementationId],
    references: [projectImplementations.id],
  }),
}));

export const projectWorkPlansRelations = relations(projectWorkPlans, ({ one }) => ({
  implementation: one(projectImplementations, {
    fields: [projectWorkPlans.implementationId],
    references: [projectImplementations.id],
  }),
}));

export const projectBudgetUsagesRelations = relations(projectBudgetUsages, ({ one, many }) => ({
  implementation: one(projectImplementations, {
    fields: [projectBudgetUsages.implementationId],
    references: [projectImplementations.id],
  }),
  parent: one(projectBudgetUsages, {
    fields: [projectBudgetUsages.parentId],
    references: [projectBudgetUsages.id],
    relationName: "budgetUsageHierarchy",
  }),
  children: many(projectBudgetUsages, { relationName: "budgetUsageHierarchy" }),
}));

export const projectSignatoriesRelations = relations(projectSignatories, ({ one }) => ({
  implementation: one(projectImplementations, {
    fields: [projectSignatories.implementationId],
    references: [projectImplementations.id],
  }),
  user: one(users, {
    fields: [projectSignatories.userId],
    references: [users.id],
  }),
}));
