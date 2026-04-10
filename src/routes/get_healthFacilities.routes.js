const express    = require("express");
const router     = require("express").Router();
const controller = require("../controllers/get_healthFacilities.controller");
const { generalLimiter } = require("../middleware/rateLimiter.middleware");

router.get(
  "/get_healthFacilities",
  generalLimiter,
  controller.getHealthFacilities
);

module.exports = router;