/**
 * migrate-strategies.ts
 * สร้างตาราง strategies, strategic_tactics, strategic_departments, strategic_department_tactics
 * รันโดยตรงผ่าน mysql2 — ไม่ผ่าน Drizzle migration system
 *
 * Usage: bun run src/migrate-strategies.ts
 */

import mysql from "mysql2/promise";

const statements = [
  // 1. strategies
  `CREATE TABLE IF NOT EXISTS \`strategies\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(1000) NOT NULL,
    \`campus\` varchar(100),
    \`order_list\` int,
    \`is_active\` boolean NOT NULL DEFAULT true,
    \`created_by\` int,
    \`updated_by\` int,
    \`deleted_by\` int,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    \`deleted_at\` timestamp,
    CONSTRAINT \`strategies_id\` PRIMARY KEY(\`id\`)
  )`,

  `CREATE INDEX \`idx_strategies_campus\` ON \`strategies\` (\`campus\`)`,
  `CREATE INDEX \`idx_strategies_order_list\` ON \`strategies\` (\`order_list\`)`,
  `CREATE INDEX \`idx_strategies_is_active\` ON \`strategies\` (\`is_active\`)`,

  // 2. strategic_tactics
  `CREATE TABLE IF NOT EXISTS \`strategic_tactics\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`strategy_id\` int NOT NULL,
    \`name\` varchar(1000) NOT NULL,
    \`description\` text,
    \`order_sequence\` int,
    \`is_active\` boolean NOT NULL DEFAULT true,
    \`created_by\` int,
    \`updated_by\` int,
    \`deleted_by\` int,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    \`deleted_at\` timestamp,
    CONSTRAINT \`strategic_tactics_id\` PRIMARY KEY(\`id\`)
  )`,

  `CREATE INDEX \`idx_strategic_tactics_strategy_id\` ON \`strategic_tactics\` (\`strategy_id\`)`,
  `CREATE INDEX \`idx_strategic_tactics_is_active\` ON \`strategic_tactics\` (\`is_active\`)`,

  // 3. strategic_departments
  `CREATE TABLE IF NOT EXISTS \`strategic_departments\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(1000) NOT NULL,
    \`department_id\` int,
    \`description\` text,
    \`year\` int,
    \`is_active\` boolean NOT NULL DEFAULT true,
    \`created_by\` int,
    \`updated_by\` int,
    \`deleted_by\` int,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    \`deleted_at\` timestamp,
    CONSTRAINT \`strategic_departments_id\` PRIMARY KEY(\`id\`)
  )`,

  `CREATE INDEX \`idx_strategic_departments_department_id\` ON \`strategic_departments\` (\`department_id\`)`,
  `CREATE INDEX \`idx_strategic_departments_year\` ON \`strategic_departments\` (\`year\`)`,
  `CREATE INDEX \`idx_strategic_departments_is_active\` ON \`strategic_departments\` (\`is_active\`)`,

  // 4. strategic_department_tactics
  `CREATE TABLE IF NOT EXISTS \`strategic_department_tactics\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`strategic_department_id\` int NOT NULL,
    \`name\` varchar(1000) NOT NULL,
    \`description\` text,
    \`order\` int,
    \`is_active\` boolean NOT NULL DEFAULT true,
    \`created_by\` int,
    \`updated_by\` int,
    \`deleted_by\` int,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    \`deleted_at\` timestamp,
    CONSTRAINT \`strategic_department_tactics_id\` PRIMARY KEY(\`id\`)
  )`,

  `CREATE INDEX \`idx_strategic_dept_tactics_dept_id\` ON \`strategic_department_tactics\` (\`strategic_department_id\`)`,
  `CREATE INDEX \`idx_strategic_dept_tactics_is_active\` ON \`strategic_department_tactics\` (\`is_active\`)`,
];

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    for (const sql of statements) {
      const label = sql.trim().split("\n")[0].substring(0, 60);
      process.stdout.write(`  → ${label}... `);
      try {
        await conn.execute(sql);
        console.log("OK");
      } catch (err: any) {
        if (err.code === "ER_DUP_KEYNAME") {
          console.log("SKIP (index มีอยู่แล้ว)");
        } else {
          throw err;
        }
      }
    }
    console.log("\n✓ migrate-strategies เสร็จสมบูรณ์");
  } catch (err) {
    console.error("\n✗ Error:", err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
