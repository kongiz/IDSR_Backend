const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/auth.controller");
const { otpLimiter, otpVerifyLimiter } = require("../middleware/rateLimiter.middleware");


router.post("/resend-otp",       otpLimiter,       controller.resendVerificationOtp);
router.post("/forgot-password",  otpLimiter,       controller.forgotPassword);
router.post("/verify-email",     otpVerifyLimiter, controller.verifyEmail);
router.post("/verify-reset-otp", otpVerifyLimiter, controller.verifyResetOtp);
router.post("/reset-password",   otpVerifyLimiter, controller.resetPassword);

module.exports = router;