// QA harness: fixed disposable Unix socket; real feature router; no production server import.
const express = require("express");
const fs = require("fs");
const path = require("path");
const { setup, branding, logoPath, root } = require("./local-fixture");
const { createServiceReportRouter } = require("../../serviceReports/routes");
const {
  createPortalSession,
  readPortalUserFromRequest,
  buildPortalAuthCookie,
} = require("../../lib/portalAuth");
const security = require("../../lib/security");
const secret = "synthetic-local-qa-session-secret-0000000000";
const users = {
  manager: { id: "1", employeeId: "1", name: "QA Manager", role: "Admin" },
  technician: {
    id: "QA-EMP-2",
    employeeId: "QA-EMP-2",
    name: "QA Technician",
    role: "Technician",
  },
  reviewer: {
    id: "QA-EMP-3",
    employeeId: "QA-EMP-3",
    name: "QA Reviewer",
    role: "Operations",
  },
  other: {
    id: "QA-EMP-4",
    employeeId: "QA-EMP-4",
    name: "QA Other Staff",
    role: "Sales",
  },
};
function cookie(name) {
  return buildPortalAuthCookie(
    createPortalSession({ user: users[name], secret }),
    { secure: false, sameSite: "Lax", path: "/" },
  ).split(";")[0];
}
async function start({ reset = false, port = 5188 } = {}) {
  const pool = await setup({ reset }),
    app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    req.portalUser = readPortalUserFromRequest(req, { secret });
    next();
  });
  app.use(security.inputGuard);
  app.use(
    security.csrfGuard(
      new Set([`http://127.0.0.1:${port}`]),
      "skuas_portal_session",
    ),
  );
  app.get("/api/auth/me", (req, res) =>
    req.portalUser ? res.json({ user: req.portalUser }) : res.sendStatus(401),
  );
  app.use(
    "/api/service-reports",
    createServiceReportRouter({
      getConnection: () => pool.getConnection(),
      loadSettings: async () => {
        const c = await pool.getConnection();
        try {
          await c.query("SELECT 1");
          return branding();
        } finally {
          c.release();
        }
      },
      resolveAsset: () => logoPath,
      privateRoot: path.join(root, "private-evidence"),
    }),
  );
  app.get("/api/public/google-maps-config", (req, res) =>
    res.json({ googleMapsEnabled: false }),
  );
  app.get("/api/settings", (req, res) =>
    res.json({
      companyName: "SKUAS · Synthetic QA",
      brandingAccentColor: "#1d2547",
    }),
  );
  // Unrelated shell requests are synthetic empty responses. No request is forwarded externally.
  app.use("/api", (req, res) => res.json([]));
  app.use(express.static(path.join(root, "build")));
  app.get("/{*splat}", (req, res) =>
    res.sendFile(path.join(root, "build/index.html")),
  );
  const server = await new Promise((resolve) => {
    const s = app.listen(port, "127.0.0.1", () => resolve(s));
  });
  return {
    pool,
    server,
    cookie,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    },
  };
}
if (require.main === module)
  start({ reset: process.argv.includes("--reset") })
    .then(() => console.log("Synthetic QA only: http://127.0.0.1:5188"))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
module.exports = { start, cookie, users };
