#!/usr/bin/env node
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

const config = {
  host: process.env.DATABASE_HOST || "127.0.0.1",
  port: parseInt(process.env.DATABASE_PORT || "3306"),
  database: process.env.DATABASE_NAME || "ku_pms_db",
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "P@55w0rd",
};

async function runMigration() {
  let connection;
  try {
    console.log("🔌 Connecting to database...");
    connection = await mysql.createConnection(config);

    // Read migration SQL file
    const migrationFile = path.join(".", "drizzle", "0011_create_sdgs_table.sql");
    const sql = fs.readFileSync(migrationFile, "utf-8");

    console.log("📝 Executing migration: 0011_create_sdgs_table.sql");

    // Execute the migration
    await connection.execute(sql);

    console.log("✅ Migration applied successfully!");

    // Verify table exists
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [config.database, "sdgs"]
    );

    if (tables.length > 0) {
      console.log("✓ Table 'sdgs' created successfully");

      // Show table structure
      const [columns] = await connection.execute(
        "DESCRIBE sdgs"
      );
      console.log("\n📋 Table structure:");
      columns.forEach((col) => {
        console.log(`   - ${col.Field}: ${col.Type} ${col.Null === "NO" ? "NOT NULL" : "nullable"}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
