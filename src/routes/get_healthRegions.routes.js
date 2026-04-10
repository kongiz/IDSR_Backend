const express = require("express");
const router = express.Router();
const controller = require("../controllers/get_healthRegions.controller");
const { generalLimiter } = require("../middleware/rateLimiter.middleware");

router.get("/get_healthRegions", generalLimiter, controller.getHealthRegions);

module.exports = router;