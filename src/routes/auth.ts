import { Elysia, t } from "elysia";
import { db } from "../db";
import { users, userAffiliations } from "../schema";
import { eq, or, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { jwtPlugin, authMiddleware } from "../middleware/auth";

// -----------------------------------------------
// Constants
// -----------------------------------------------
const ACCESS_EXPIRES = Number(process.env.JWT_ACCESS_EXPIRES ?? 900); // 15 min
const REFRESH_EXPIRES = Number(process.env.JWT_REFRESH_EXPIRES ?? 604800); // 7 days

// -----------------------------------------------
// Helper: sign tokens (รวม affiliationId, role, orgId)
// -----------------------------------------------
async function signTokens(
  jwtAccess: { sign: Function },
  jwtRefresh: { sign: Function },
  payload: {
    id: number;
    username: string;
    affiliationId?: number | null;
    role?: string | null;
    orgId?: number | null;
  }
) {
  const now = Math.floor(Date.now() / 1000);

  const accessToken = await jwtAccess.sign({
    sub: String(payload.id),
    username: payload.username,
    affiliationId: payload.affiliationId ? String(payload.affiliationId) : null,
    role: payload.role ?? null,
    orgId: payload.orgId ? String(payload.orgId) : null,
    type: "access",
    exp: now + ACCESS_EXPIRES,
  });

  const refreshToken = await jwtRefresh.sign({
    sub: String(payload.id),
    type: "refresh",
    exp: now + REFRESH_EXPIRES,
  });

  return { accessToken, refreshToken };
}

// -----------------------------------------------
// Helper: ดึง affiliations ของ user พร้อมข้อมูล org
// -----------------------------------------------
async function getUserAffiliations(userId: number) {
  return db.query.userAffiliations.findMany({
    where: and(
      eq(userAffiliations.userId, userId),
      eq(userAffiliations.isActive, true)
    ),
    with: {
      organization: {
        with: {
          parent: true, // ดึง org แม่ (faculty) กรณีสังกัด department
          campus: true, // ดึงข้อมูลส่วนงาน (วิทยาเขต)
        },
      },
      subDep: true, // หน่วยงานย่อย (sub_dep_id → organizations)
    },
  });
}

// -----------------------------------------------
// Auth Plugin
// -----------------------------------------------
export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .use(authMiddleware)

  // -----------------------------------------------
  // POST /api/auth/login
  // -----------------------------------------------
  .post(
    "/login",
    async ({ body, jwtAccess, jwtRefresh, set }) => {
      const { username, password } = body;

      // Find user by username OR email
      const user = await db.query.users.findFirst({
        where: or(
          eq(users.username, username.toLowerCase()),
          eq(users.email, username.toLowerCase())
        ),
      });

      if (!user) {
        set.status = 401;
        return { success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
      }

      if (!user.isActive) {
        set.status = 403;
        return { success: false, message: "บัญชีผู้ใช้ถูกระงับการใช้งาน" };
      }

      if (!user.password) {
        set.status = 401;
        return {
          success: false,
          message: "บัญชีนี้ใช้การเข้าสู่ระบบผ่าน KU ALL LOGIN เท่านั้น",
        };
      }

      // Verify password (supports both $2a$ and $2y$ bcrypt hashes)
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        set.status = 401;
        return { success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
      }

      // Update last_login_at (fire-and-forget)
      db.update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id))
        .catch(() => { });

      // ดึง affiliations ทั้งหมดของ user
      const affiliations = await getUserAffiliations(user.id);

      // กำหนด active affiliation อัตโนมัติ
      let activeAffiliation = null;
      if (affiliations.length === 1) {
        activeAffiliation = affiliations[0];
      } else if (affiliations.length > 1) {
        // ใช้ primary affiliation ก่อน ถ้าไม่มีใช้ตัวแรก
        activeAffiliation =
          affiliations.find((a) => a.isPrimary) ?? affiliations[0];
      }

      const { accessToken, refreshToken } = await signTokens(
        jwtAccess,
        jwtRefresh,
        {
          id: user.id,
          username: user.username,
          affiliationId: activeAffiliation?.id,
          role: activeAffiliation?.role,
          orgId: activeAffiliation?.orgId,
        }
      );

      return {
        success: true,
        accessToken,
        refreshToken,
        expiresIn: ACCESS_EXPIRES,
        user: {
          id: user.id,
          username: user.username,
          nameTh: user.nameTh,
          nameEn: user.nameEn,
          email: user.email,
          avatar: user.avatar,
        },
        activeAffiliation: activeAffiliation
          ? {
            id: activeAffiliation.id,
            role: activeAffiliation.role,
            positionTitle: activeAffiliation.positionTitle,
            organization: activeAffiliation.organization,
            subDep: activeAffiliation.subDep ?? null,
          }
          : null,
        affiliations: affiliations.map((a) => ({
          id: a.id,
          role: a.role,
          positionTitle: a.positionTitle,
          isPrimary: a.isPrimary,
          organization: a.organization,
          subDepId: a.subDepId,
          subDep: a.subDep,
        })),
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
      }),
    }
  )

  // -----------------------------------------------
  // POST /api/auth/refresh
  // -----------------------------------------------
  .post(
    "/refresh",
    async ({ body, jwtAccess, jwtRefresh, set }) => {
      const { refreshToken } = body;

      const payload = await jwtRefresh.verify(refreshToken);
      if (!payload || payload.type !== "refresh") {
        set.status = 401;
        return {
          success: false,
          message: "Refresh token ไม่ถูกต้องหรือหมดอายุ",
        };
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(payload.sub)),
      });

      if (!user || !user.isActive) {
        set.status = 401;
        return { success: false, message: "ไม่พบผู้ใช้หรือบัญชีถูกระงับ" };
      }

      // ดึง primary affiliation สำหรับ token ใหม่
      const affiliations = await getUserAffiliations(user.id);
      const activeAffiliation =
        affiliations.find((a) => a.isPrimary) ?? affiliations[0] ?? null;

      const { accessToken, refreshToken: newRefreshToken } = await signTokens(
        jwtAccess,
        jwtRefresh,
        {
          id: user.id,
          username: user.username,
          affiliationId: activeAffiliation?.id,
          role: activeAffiliation?.role,
          orgId: activeAffiliation?.orgId,
        }
      );

      return {
        success: true,
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: ACCESS_EXPIRES,
        user: {
          id: user.id,
          username: user.username,
          nameTh: user.nameTh,
          nameEn: user.nameEn,
          email: user.email,
          avatar: user.avatar,
        },
      };
    },
    {
      body: t.Object({
        refreshToken: t.String({ minLength: 1 }),
      }),
    }
  )

  // -----------------------------------------------
  // GET /api/auth/me — ต้อง login ก่อน
  // -----------------------------------------------
  // don't trust authMiddleware here – verify token manually so the
  // endpoint still works even if the middleware isn't wired up correctly.
  .get("/me", async ({ headers, jwtAccess, set }) => {
    // `headers` comes in as a plain object, not the Fetch Headers class
    const authHeader =
      headers.authorization || headers.Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "");

    if (!token) {
      set.status = 401;
      return { success: false, message: "Unauthorized" };
    }

    let payload;
    try {
      payload = await jwtAccess.verify(token);
    } catch (e) {
      set.status = 401;
      return { success: false, message: "Invalid or expired token" };
    }

    if (!payload || payload.type !== "access") {
      set.status = 401;
      return { success: false, message: "Invalid token" };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(payload.sub)),
    });
    if (!user || !user.isActive) {
      set.status = 401;
      return { success: false, message: "ไม่พบผู้ใช้หรือบัญชีถูกระงับ" };
    }

    const affiliations = await getUserAffiliations(user.id);
    const activeAffiliation =
      affiliations.find((a) => a.id === Number(payload.affiliationId)) ??
      affiliations.find((a) => a.isPrimary) ??
      affiliations[0] ??
      null;

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        nameTh: user.nameTh,
        nameEn: user.nameEn,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        kuUid: user.kuUid,
        kuFacultyId: user.kuFacultyId,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      activeAffiliation: activeAffiliation
        ? {
          id: activeAffiliation.id,
          role: activeAffiliation.role,
          positionTitle: activeAffiliation.positionTitle,
          organization: activeAffiliation.organization,
          subDep: activeAffiliation.subDep ?? null,
        }
        : null,
      affiliations: affiliations.map((a) => ({
        id: a.id,
        role: a.role,
        positionTitle: a.positionTitle,
        isPrimary: a.isPrimary,
        organization: a.organization,
        subDepId: a.subDepId,
        subDep: a.subDep,
      })),
    };
  })

  // -----------------------------------------------
  // GET /api/auth/me/affiliations — ดึงรายการสังกัดทั้งหมด
  // -----------------------------------------------
  .get("/me/affiliations", async (ctx) => {
    const { auth } = ctx as any;
    const affiliations = await getUserAffiliations(auth.user.id);

    return {
      success: true,
      affiliations: affiliations.map((a) => ({
        id: a.id,
        role: a.role,
        positionTitle: a.positionTitle,
        isPrimary: a.isPrimary,
        isActive: a.isActive,
        startDate: a.startDate,
        endDate: a.endDate,
        organization: a.organization,
        subDepId: a.subDepId,
        subDep: a.subDep,
      })),
    };
  })

  // -----------------------------------------------
  // POST /api/auth/switch-affiliation — สลับสังกัด (Session Switcher)
  // -----------------------------------------------
  .post(
    "/switch-affiliation",
    async (ctx) => {
      const { body, auth, jwtAccess, jwtRefresh, set } = ctx as any;
      const { affiliationId } = body;

      // ตรวจสอบว่า affiliation นี้เป็นของ user จริง
      const affiliation = await db.query.userAffiliations.findFirst({
        where: and(
          eq(userAffiliations.id, affiliationId),
          eq(userAffiliations.userId, auth.user.id),
          eq(userAffiliations.isActive, true)
        ),
        with: {
          organization: true,
        },
      });

      if (!affiliation) {
        set.status = 404;
        return {
          success: false,
          message: "ไม่พบสังกัดที่ระบุ หรือสังกัดนี้ไม่ได้เปิดใช้งาน",
        };
      }

      // Issue new tokens with new affiliation context
      const { accessToken, refreshToken } = await signTokens(
        jwtAccess,
        jwtRefresh,
        {
          id: auth.user.id,
          username: auth.user.username,
          affiliationId: affiliation.id,
          role: affiliation.role,
          orgId: affiliation.orgId,
        }
      );

      return {
        success: true,
        accessToken,
        refreshToken,
        expiresIn: ACCESS_EXPIRES,
        activeAffiliation: {
          id: affiliation.id,
          role: affiliation.role,
          positionTitle: affiliation.positionTitle,
          organization: affiliation.organization,
          subDep: affiliation.subDep ?? null,
        },
      };
    },
    {
      body: t.Object({
        affiliationId: t.Number(),
      }),
    }
  )

  // -----------------------------------------------
  // POST /api/auth/change-password
  // -----------------------------------------------
  .post(
    "/change-password",
    async ({ body, headers, jwtAccess, set }) => {
      // Manual token verification (like /me endpoint)
      const authHeader =
        headers.authorization || headers.Authorization || "";
      const token = String(authHeader).replace(/^Bearer\s+/i, "");

      if (!token) {
        set.status = 401;
        return { success: false, message: "กรุณาเข้าสู่ระบบก่อน" };
      }

      let payload;
      try {
        payload = await jwtAccess.verify(token);
      } catch (e) {
        set.status = 401;
        return { success: false, message: "Token ไม่ถูกต้องหรือหมดอายุ" };
      }

      if (!payload || payload.type !== "access") {
        set.status = 401;
        return { success: false, message: "Token ไม่ถูกต้อง" };
      }

      const { currentPassword, newPassword } = body;

      // Get current user with password
      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(payload.sub)),
      });

      if (!user) {
        set.status = 404;
        return { success: false, message: "ไม่พบผู้ใช้" };
      }

      if (!user.isActive) {
        set.status = 403;
        return { success: false, message: "บัญชีผู้ใช้ถูกระงับการใช้งาน" };
      }

      if (!user.password) {
        set.status = 400;
        return {
          success: false,
          message: "บัญชีนี้ใช้การเข้าสู่ระบบผ่าน KU ALL LOGIN เท่านั้น ไม่สามารถเปลี่ยนรหัสผ่านได้",
        };
      }

      // Verify current password
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        set.status = 401;
        return { success: false, message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
      }

      // Validate new password requirements
      if (newPassword.length < 8) {
        set.status = 400;
        return { success: false, message: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร" };
      }

      if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword)) {
        set.status = 400;
        return { success: false, message: "รหัสผ่านใหม่ต้องมีตัวพิมพ์ใหญ่และตัวพิมพ์เล็ก" };
      }

      if (!/[0-9]/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) {
        set.status = 400;
        return { success: false, message: "รหัสผ่านใหม่ต้องมีตัวเลขและสัญลักษณ์พิเศษ" };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await db.update(users)
        .set({ 
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

      return { 
        success: true, 
        message: "เปลี่ยนรหัสผ่านสำเร็จ" 
      };
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: 1 }),
      }),
    }
  )

  // -----------------------------------------------
  // POST /api/auth/logout
  // -----------------------------------------------
  .post("/logout", () => {
    return { success: true, message: "ออกจากระบบสำเร็จ" };
  });
