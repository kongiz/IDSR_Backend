const express       = require("express");
const router        = express.Router();
const multer        = require("multer");
const auth          = require("../middleware/auth.middleware");
const upload        = require("../middleware/upload.middleware");
const controller    = require("../controllers/labReports.controller");
const getController = require("../controllers/get_labReports.controller");
const { generalLimiter, reportSubmitLimiter } = require("../middleware/rateLimiter.middleware");
const { requireRole } = require("../middleware/roleGuard.middleware");


router.post(
  "/submit_lab_report",
  reportSubmitLimiter,
  auth,
  (req, res, next) => {
    console.log("=== REACHED ROLE CHECK ===", req.user?.role);
    next();
  },
  requireRole("Lab Technician"),
  (req, res, next) => {
    console.log("=== REACHED MULTER ===");
    upload.single("labResultImage")(req, res, (err) => {
      console.log("=== MULTER DONE === err:", err);
      console.log("=== BODY AFTER MULTER ===", req.body);
      console.log("=== FILE AFTER MULTER ===", req.file);
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: err.code === "LIMIT_FILE_SIZE"
            ? "File too large. Maximum size is 5MB"
            : "File upload error"
        });
      }
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      next();
    });
  },
  controller.createLabReport
);


router.get(
  "/get_labReports",
  generalLimiter,
  auth,
  getController.getLabReports
);

module.exports = router;