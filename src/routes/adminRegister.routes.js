const express = require("express");
const router  = express.Router();

const { adminRegister }  = require("../controllers/adminRegister.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { authLimiter }    = require("../middleware/rateLimiter.middleware");
const { requireRole }    = require("../middleware/roleGuard.middleware");

router.post(
  "/adminRegister",
  authLimiter,
  verifyToken,
  requireRole("Admin", "Regional Officer"),
  adminRegister
);

module.exports = router;