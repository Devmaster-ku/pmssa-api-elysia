-- =============================================
-- สร้างตาราง role_permissions สำหรับระบบ Permission Matrix
-- PostgreSQL — รันเพื่อสร้างตารางใหม่โดยไม่กระทบตารางเดิม
-- =============================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id               SERIAL        NOT NULL,
  role             VARCHAR(50)   NOT NULL,
  permission_code  VARCHAR(100)  NOT NULL,
  granted          BOOLEAN       NOT NULL DEFAULT FALSE,
  updated_by       INTEGER       NULL,
  updated_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT uq_role_permission_code UNIQUE (role, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_code ON role_permissions (permission_code);

-- =============================================
-- Seed: Permission Matrix (19 permissions × 10 roles = 190 rows)
-- true = มีสิทธิ์, false = ไม่มีสิทธิ์
-- =============================================

INSERT INTO role_permissions (role, permission_code, granted) VALUES
-- project.view
('super_admin',       'project.view', true),
('org_admin',         'project.view', true),
('univ_executive',    'project.view', true),
('univ_officer',      'project.view', true),
('campus_executive',  'project.view', true),
('campus_officer',    'project.view', true),
('faculty_executive', 'project.view', true),
('unit_head',         'project.view', true),
('project_lead',      'project.view', true),
('staff',             'project.view', true),

-- project.create
('super_admin',       'project.create', true),
('org_admin',         'project.create', true),
('univ_executive',    'project.create', false),
('univ_officer',      'project.create', true),
('campus_executive',  'project.create', false),
('campus_officer',    'project.create', true),
('faculty_executive', 'project.create', false),
('unit_head',         'project.create', true),
('project_lead',      'project.create', true),
('staff',             'project.create', true),

-- project.edit
('super_admin',       'project.edit', true),
('org_admin',         'project.edit', true),
('univ_executive',    'project.edit', false),
('univ_officer',      'project.edit', true),
('campus_executive',  'project.edit', false),
('campus_officer',    'project.edit', true),
('faculty_executive', 'project.edit', false),
('unit_head',         'project.edit', true),
('project_lead',      'project.edit', true),
('staff',             'project.edit', false),

-- project.delete
('super_admin',       'project.delete', true),
('org_admin',         'project.delete', true),
('univ_executive',    'project.delete', false),
('univ_officer',      'project.delete', false),
('campus_executive',  'project.delete', false),
('campus_officer',    'project.delete', false),
('faculty_executive', 'project.delete', false),
('unit_head',         'project.delete', false),
('project_lead',      'project.delete', false),
('staff',             'project.delete', false),

-- project.submit
('super_admin',       'project.submit', true),
('org_admin',         'project.submit', true),
('univ_executive',    'project.submit', false),
('univ_officer',      'project.submit', true),
('campus_executive',  'project.submit', false),
('campus_officer',    'project.submit', true),
('faculty_executive', 'project.submit', false),
('unit_head',         'project.submit', true),
('project_lead',      'project.submit', true),
('staff',             'project.submit', true),

-- project.approve
('super_admin',       'project.approve', true),
('org_admin',         'project.approve', true),
('univ_executive',    'project.approve', true),
('univ_officer',      'project.approve', false),
('campus_executive',  'project.approve', true),
('campus_officer',    'project.approve', false),
('faculty_executive', 'project.approve', true),
('unit_head',         'project.approve', true),
('project_lead',      'project.approve', false),
('staff',             'project.approve', false),

-- budget.view
('super_admin',       'budget.view', true),
('org_admin',         'budget.view', true),
('univ_executive',    'budget.view', true),
('univ_officer',      'budget.view', true),
('campus_executive',  'budget.view', true),
('campus_officer',    'budget.view', true),
('faculty_executive', 'budget.view', true),
('unit_head',         'budget.view', true),
('project_lead',      'budget.view', true),
('staff',             'budget.view', true),

-- budget.manage
('super_admin',       'budget.manage', true),
('org_admin',         'budget.manage', true),
('univ_executive',    'budget.manage', false),
('univ_officer',      'budget.manage', true),
('campus_executive',  'budget.manage', false),
('campus_officer',    'budget.manage', true),
('faculty_executive', 'budget.manage', false),
('unit_head',         'budget.manage', true),
('project_lead',      'budget.manage', true),
('staff',             'budget.manage', false),

-- budget.approve
('super_admin',       'budget.approve', true),
('org_admin',         'budget.approve', true),
('univ_executive',    'budget.approve', true),
('univ_officer',      'budget.approve', false),
('campus_executive',  'budget.approve', true),
('campus_officer',    'budget.approve', false),
('faculty_executive', 'budget.approve', true),
('unit_head',         'budget.approve', true),
('project_lead',      'budget.approve', false),
('staff',             'budget.approve', false),

-- report.view
('super_admin',       'report.view', true),
('org_admin',         'report.view', true),
('univ_executive',    'report.view', true),
('univ_officer',      'report.view', true),
('campus_executive',  'report.view', true),
('campus_officer',    'report.view', true),
('faculty_executive', 'report.view', true),
('unit_head',         'report.view', true),
('project_lead',      'report.view', true),
('staff',             'report.view', true),

-- report.export
('super_admin',       'report.export', true),
('org_admin',         'report.export', true),
('univ_executive',    'report.export', true),
('univ_officer',      'report.export', true),
('campus_executive',  'report.export', true),
('campus_officer',    'report.export', true),
('faculty_executive', 'report.export', true),
('unit_head',         'report.export', true),
('project_lead',      'report.export', true),
('staff',             'report.export', false),

-- strategy.view
('super_admin',       'strategy.view', true),
('org_admin',         'strategy.view', true),
('univ_executive',    'strategy.view', true),
('univ_officer',      'strategy.view', true),
('campus_executive',  'strategy.view', true),
('campus_officer',    'strategy.view', true),
('faculty_executive', 'strategy.view', true),
('unit_head',         'strategy.view', true),
('project_lead',      'strategy.view', true),
('staff',             'strategy.view', true),

-- strategy.manage
('super_admin',       'strategy.manage', true),
('org_admin',         'strategy.manage', true),
('univ_executive',    'strategy.manage', false),
('univ_officer',      'strategy.manage', true),
('campus_executive',  'strategy.manage', false),
('campus_officer',    'strategy.manage', true),
('faculty_executive', 'strategy.manage', false),
('unit_head',         'strategy.manage', false),
('project_lead',      'strategy.manage', false),
('staff',             'strategy.manage', false),

-- user.view
('super_admin',       'user.view', true),
('org_admin',         'user.view', true),
('univ_executive',    'user.view', true),
('univ_officer',      'user.view', true),
('campus_executive',  'user.view', true),
('campus_officer',    'user.view', true),
('faculty_executive', 'user.view', true),
('unit_head',         'user.view', true),
('project_lead',      'user.view', false),
('staff',             'user.view', false),

-- user.manage
('super_admin',       'user.manage', true),
('org_admin',         'user.manage', true),
('univ_executive',    'user.manage', false),
('univ_officer',      'user.manage', true),
('campus_executive',  'user.manage', false),
('campus_officer',    'user.manage', true),
('faculty_executive', 'user.manage', false),
('unit_head',         'user.manage', false),
('project_lead',      'user.manage', false),
('staff',             'user.manage', false),

-- settings.view
('super_admin',       'settings.view', true),
('org_admin',         'settings.view', true),
('univ_executive',    'settings.view', true),
('univ_officer',      'settings.view', true),
('campus_executive',  'settings.view', true),
('campus_officer',    'settings.view', true),
('faculty_executive', 'settings.view', true),
('unit_head',         'settings.view', true),
('project_lead',      'settings.view', false),
('staff',             'settings.view', false),

-- settings.manage
('super_admin',       'settings.manage', true),
('org_admin',         'settings.manage', true),
('univ_executive',    'settings.manage', false),
('univ_officer',      'settings.manage', true),
('campus_executive',  'settings.manage', false),
('campus_officer',    'settings.manage', false),
('faculty_executive', 'settings.manage', false),
('unit_head',         'settings.manage', false),
('project_lead',      'settings.manage', false),
('staff',             'settings.manage', false),

-- settings.org
('super_admin',       'settings.org', true),
('org_admin',         'settings.org', true),
('univ_executive',    'settings.org', false),
('univ_officer',      'settings.org', false),
('campus_executive',  'settings.org', false),
('campus_officer',    'settings.org', false),
('faculty_executive', 'settings.org', false),
('unit_head',         'settings.org', false),
('project_lead',      'settings.org', false),
('staff',             'settings.org', false),

-- settings.budget
('super_admin',       'settings.budget', true),
('org_admin',         'settings.budget', true),
('univ_executive',    'settings.budget', false),
('univ_officer',      'settings.budget', true),
('campus_executive',  'settings.budget', false),
('campus_officer',    'settings.budget', false),
('faculty_executive', 'settings.budget', false),
('unit_head',         'settings.budget', false),
('project_lead',      'settings.budget', false),
('staff',             'settings.budget', false)

ON CONFLICT (role, permission_code)
DO UPDATE SET
  granted    = EXCLUDED.granted,
  updated_at = NOW();
