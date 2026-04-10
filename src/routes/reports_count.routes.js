const express    = require("express");
const router     = express.Router();
const auth       = require("../middleware/auth.middleware");
const controller = require("../controllers/report_count.controller");
const { pollingLimiter } = require("../middleware/rateLimiter.middleware");

router.get("/get_reports_count", auth, pollingLimiter, controller.countReports);

module.exports = router;