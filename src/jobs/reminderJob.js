const cron   = require("node-cron");
const { sendWeeklySurveillanceReminder } = require("../services/notificationFirebase.service");
const logger = require("../config/logger");

// every Monday at 8:00 AM
function startReminderJob() {
  cron.schedule("0 8 * * 1", async () => {
    logger.info("Running weekly surveillance reminder job...");
    await sendWeeklySurveillanceReminder();
  }, {
    timezone: "Africa/Banjul"
  });

  logger.info("Weekly surveillance reminder job scheduled (Mon 08:00 Banjul time)");
}

module.exports = { startReminderJob };