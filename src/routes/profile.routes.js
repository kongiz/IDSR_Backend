const express    = require("express");
const router     = express.Router();
const auth       = require("../middleware/auth.middleware");
const controller = require("../controllers/profile.controller");
const { generalLimiter } = require("../middleware/rateLimiter.middleware");

router.get(   "/",               generalLimiter, auth, controller.getProfile);
router.patch( "/update",         generalLimiter, auth, controller.updateProfile);
router.patch( "/change-password",generalLimiter, auth, controller.changePassword);

module.exports = router;