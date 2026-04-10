const express       = require("express");
const router        = express.Router();
const auth          = require("../middleware/auth.middleware");
const controller    = require("../controllers/annex2GLabSpecimen.controller");
const getController = require("../controllers/get_annex2GLabSpecimen.controller");
const { generalLimiter, reportSubmitLimiter } = require("../middleware/rateLimiter.middleware");
const { blockRole } = require("../middleware/roleGuard.middleware");


router.post(
  "/submit_annex2GLabSpecimen",
  reportSubmitLimiter,
  auth,
  blockRole("Admin"),
  controller.submitSpecimenReport
);


router.get(
  "/get_annex2GLabSpecimen",
  generalLimiter,
  auth,
  getController.getSpecimenReports
);

module.exports = router;