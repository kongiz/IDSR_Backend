const express    = require("express");
const router     = express.Router();
const auth       = require("../middleware/auth.middleware");
const controller = require("../controllers/location.controller");
const { generalLimiter } = require("../middleware/rateLimiter.middleware");


router.get(
  "/get_facility_locations",
  generalLimiter,
  auth,
  controller.getFacilityLocations
);

module.exports = router;