const express = require("express");
const router  = express.Router();
const mapController = require("../controllers/map.controller");
const auth = require("../middleware/auth.middleware");
const { generalLimiter } = require("../middleware/rateLimiter.middleware");

router.get("/get_map", generalLimiter, auth, mapController.getMapPoints);

module.exports = router;