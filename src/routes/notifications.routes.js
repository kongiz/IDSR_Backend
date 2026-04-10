const express    = require("express");
const router     = express.Router();
const auth       = require("../middleware/auth.middleware");
const controller = require("../controllers/notifications.controller");
const {
  generalLimiter,
  pollingLimiter
} = require("../middleware/rateLimiter.middleware");

router.get(   "/",         auth, pollingLimiter,  controller.getNotifications);
router.patch( "/:id/read", auth, generalLimiter,  controller.markAsRead);
router.patch( "/read-all", auth, generalLimiter,  controller.markAllAsRead);
router.delete("/:id",      auth, generalLimiter,  controller.deleteNotification);

module.exports = router;