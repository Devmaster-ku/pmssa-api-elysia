import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth";
import { userRoutes, adminRoutes } from "./routes/users";
import { organizationRoutes } from "./routes/organizations";
import { strategyRoutes } from "./routes/strategies";
import { settingsRoutes } from "./routes/settings";
import { maintenanceRoutes } from "./routes/maintenance";
import { sdgRoutes } from "./routes/sdgs";
import { projectRoutes } from "./routes/projects";
import { projectImplementationRoutes } from "./routes/projectImplementation";
import { provinceRoutes } from "./routes/provinces";
import { authMiddleware } from "./middleware/auth";

const app = new Elysia()
  .use(cors())
  .get("/", () => ({ message: "KU-PMSSA API is running" }))
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  // Apply authentication middleware globally so every request on the main
  // server goes through it.  authMiddleware now skips the login/refresh
  // endpoints internally, so those remain public while all other routes
  // (including the ones mounted via sub-instances) will have `auth`
  // populated.
  .use(authMiddleware)
  .use(authRoutes)
  .use(userRoutes)
  .use(adminRoutes)
  .use(organizationRoutes)
  .use(strategyRoutes)
  .use(settingsRoutes)
  .use(maintenanceRoutes)
  .use(sdgRoutes)
  .use(projectRoutes)
  .use(projectImplementationRoutes)
  .use(provinceRoutes)
  .listen(3000);

console.log(
  `KU PMS Backend is running at http://${app.server?.hostname}:${app.server?.port}`
);
