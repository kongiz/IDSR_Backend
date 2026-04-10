const express          = require("express");
const router           = express.Router();
const signupController = require("../controllers/signup.controller");
const { authLimiter }  = require("../middleware/rateLimiter.middleware");


router.post(
  "/signup",
  authLimiter,
  signupController.selfRegister
);

module.exports = router;