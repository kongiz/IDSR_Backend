const express       = require("express");
const router        = express.Router();
const auth          = require("../middleware/auth.middleware"); // plural
const controller    = require("../controllers/annex2FImmediateReport.controller");
const editController = require("../controllers/edit_annex2FImmediate.controller");
const getController = require("../controllers/get_annex2FImmediate.controller");
const { generalLimiter, reportSubmitLimiter } = require("../middleware/rateLimiter.middleware");
const { blockRole } = require("../middleware/roleGuard.middleware");

router.post(
  "/submit_annex2FImmediateReport",
  reportSubmitLimiter,
  auth,
  blockRole("Admin"),
  controller.submitImmediateReport
);

router.get(
  "/get_annex2FImmediateReports",
  generalLimiter,
  auth,
  getController.getImmediateReports
);

router.put(
  "/edit_annex2FImmediateReport/:id",
  generalLimiter,
  auth,
  editController.editImmediateReport
); 
module.exports = router; 