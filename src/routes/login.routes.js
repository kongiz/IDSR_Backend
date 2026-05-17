const express           = require("express");
const router            = express.Router();
const loginController   = require("../controllers/login.controller");
const refreshController = require("../controllers/refresh_token.controller");
const { authLimiter, refreshLimiter } = require("../middleware/rateLimiter.middleware");
const { verifyToken }   = require("../middleware/auth.middleware");
const { checkLockout }     = require("../middleware/loginLockout.middleware");


router.post("/login", authLimiter, checkLockout, loginController.login);
router.post("/auth/refresh_token", refreshLimiter, refreshController.refreshAccessToken);
router.post("/logout",             verifyToken,    loginController.logout);

module.exports = router;