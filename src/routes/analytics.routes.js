const express    = require("express");
const router     = express.Router();
const auth       = require("../middleware/auth.middleware");
const controller = require("../controllers/analytics.controller");
const { generalLimiter } = require("../middleware/rateLimiter.middleware");

router.get(
  "/get_analytics",
  generalLimiter,
  auth,
  controller.getAnalysisReport
);

module.exports = router;