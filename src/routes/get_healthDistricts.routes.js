const express = require("express");
const router = express.Router();
const controller = require("../controllers/get_healthDistricts.controller");
const { generalLimiter } = require("../middleware/rateLimiter.middleware");


router.get("/get_healthDistricts", generalLimiter, controller.getHealthDistricts);

module.exports = router;
