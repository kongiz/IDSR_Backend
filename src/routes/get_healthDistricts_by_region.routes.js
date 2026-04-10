const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/get_healthDistricts_by_region.controller");
const { generalLimiter } = require("../middleware/rateLimiter.middleware");


router.get(
  "/get_healthDistricts_by_region",
  generalLimiter,
  controller.getHealthDistricts
);

module.exports = router;