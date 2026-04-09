import { Elysia } from "elysia";

// Simulate the full server setup with multiple sub-apps all using authMiddleware
const authPlugin = new Elysia({ name: "auth-middleware" })
  .derive({ as: 'global' }, () => {
    console.log("derive called!");
    return { auth: { role: "test" } };
  });

// Multiple sub-routes all using the same plugin (like users, admin, org, strategy, settings)
const routes1 = new Elysia({ prefix: "/api/r1" }).use(authPlugin).get("/test", ({ auth }) => ({ r: "r1", auth: (auth as any)?.role }));
const routes2 = new Elysia({ prefix: "/api/r2" }).use(authPlugin).get("/test", ({ auth }) => ({ r: "r2", auth: (auth as any)?.role }));
const routes3 = new Elysia({ prefix: "/api/r3" }).use(authPlugin).get("/test", ({ auth }) => ({ r: "r3", auth: (auth as any)?.role }));
const routes4 = new Elysia({ prefix: "/api/r4" }).use(authPlugin).get("/test", ({ auth }) => ({ r: "r4", auth: (auth as any)?.role }));
const routes5 = new Elysia({ prefix: "/api/r5" }).use(authPlugin).get("/test", ({ auth }) => ({ r: "r5", auth: (auth as any)?.role }));

const app = new Elysia()
  .use(authPlugin)
  .use(routes1)
  .use(routes2)
  .use(routes3)
  .use(routes4)
  .use(routes5)
  .listen(3068);

await new Promise(r => setTimeout(r, 500));
const r = await fetch("http://localhost:3068/api/r5/test");
console.log("r5 response:", await r.text());
process.exit(0);
