const express    = require("express");
const router     = express.Router();
const auth       = require("../middleware/auth.middleware");
const controller = require("../controllers/surveillance.controller");
const editController = require("../controllers/edit_surveillance.controller");
const getController = require("../controllers/get_surveillance.controller");
const { generalLimiter, reportSubmitLimiter } = require("../middleware/rateLimiter.middleware");
const { requireRole } = require("../middleware/roleGuard.middleware");


router.post(
  "/submit_surveillance_report",
  reportSubmitLimiter,
  auth,
  requireRole("Health Officer", "Clinician", "Community Health Worker"),
  controller.submitSurveillanceReport
);


router.get(
  "/get_surveillance_reports",  
  generalLimiter,
  auth,
  getController.getSurveillanceReports
);

router.put(
  "/edit_surveillance_report/:id",
  generalLimiter,
  auth,
  editController.editSurveillanceReport
);

module.exports = router;