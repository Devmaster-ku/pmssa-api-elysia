import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  boolean,
  text,
  jsonb,
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
  "pending",
  "approved",
  "rejected",
  "in_progress",
  "completed",
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
    projectName: varchar("project_name", { length: 500 }).notNull(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fiscalYear: integer("fiscal_year").notNull(),
    status: projectStatusEnum("status").notNull().default("draft"),
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    leadUserId: integer("lead_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_projects_org_id").on(table.orgId),
    index("idx_projects_status").on(table.status),
    index("idx_projects_fiscal_year").on(table.fiscalYear),
    index("idx_projects_lead_user_id").on(table.leadUserId),
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
  members: many(projectMembers),
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
