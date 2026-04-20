const express = require("express");
const router = express.Router();
const controller = require("../controllers/admin_user.controller");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/authorizeRole.middleware");
const { generalLimiter } = require("../middleware/rateLimiter.middleware");

router.get(
  "/admin/users",
  generalLimiter,
  verifyToken,
  authorizeRole("Admin"),
  controller.getAllUsers
);

router.patch(
  "/admin/users/:id/status",
  generalLimiter,
  verifyToken,
  authorizeRole("Admin"),
  controller.updateUserStatus
);

router.patch(
  "/admin/users/:id/role",
  generalLimiter,
  verifyToken,
  authorizeRole("Admin"),
  controller.updateUserRole
);

module.exports = router;