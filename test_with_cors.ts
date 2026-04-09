import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authMiddleware } from "./src/middleware/auth";
import { settingsRoutes } from "./src/routes/settings";
import { authRoutes } from "./src/routes/auth";
import { userRoutes, adminRoutes } from "./src/routes/users";
import { organizationRoutes } from "./src/routes/organizations";
import { strategyRoutes } from "./src/routes/strategies";

const app = new Elysia()
  .use(cors())
  .get("/", () => ({ message: "KU PMS" }))
  .get("/health", () => ({ status: "ok" }))
  .use(authMiddleware)
  .use(authRoutes)
  .use(userRoutes)
  .use(adminRoutes)
  .use(organizationRoutes)
  .use(strategyRoutes)
  .use(settingsRoutes)
  .listen(3067);

await new Promise(r => setTimeout(r, 1000));

const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwidHlwZSI6ImFjY2VzcyIsInVzZXJuYW1lIjoidGVzdCIsImFmZmlsaWF0aW9uSWQiOiIxIiwicm9sZSI6Im9yZ19hZG1pbiIsIm9yZ0lkIjoiMiJ9.SrsSa5bf6txDsE4tJNwBbJOJlXjiwbwPzHC3ApAvyCk";
const resp = await fetch("http://localhost:3067/api/settings/organizations/all", { headers: { Authorization: `Bearer ${token}` } });
console.log("Status:", resp.status);
console.log("Response:", (await resp.text()).slice(0, 100));
process.exit(0);
