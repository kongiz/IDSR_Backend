const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet"); 
const sanitize = require("./middleware/sanitize.middleware"); 
require("./config/db");

const { startReminderJob } = require("./jobs/reminderJob");
startReminderJob();

const logger                         = require("./config/logger");
const { globalLimiter }              = require("./middleware/rateLimiter.middleware");
const requestLogger                  = require("./middleware/requestLogger");

const app = express();

// Security headers — must be first before any other middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allows /uploads to be accessed
  contentSecurityPolicy: false,  
}));

app.use(cors({
  origin:         "*",
  methods:        ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(sanitize);
app.use(globalLimiter); 

app.use(requestLogger);


app.use("/uploads", express.static("./uploads"));


// Auth & Users
app.use("/api/v1", require("./routes/signup.routes"));
app.use("/api/v1", require("./routes/adminRegister.routes"));
app.use("/api/v1", require("./routes/login.routes"));
app.use("/api/v1/auth", require("./routes/auth.routes"));

// Admin Users
app.use("/api/v1", require("./routes/admin_user.routes"));

// Location
app.use("/api/v1", require("./routes/location.routes"));
app.use("/api/v1", require("./routes/get_healthFacilities.routes"));
app.use("/api/v1", require("./routes/get_healthDistricts.routes"));
app.use("/api/v1", require("./routes/get_healthRegions.routes"));
app.use("/api/v1", require("./routes/get_healthDistricts_by_region.routes"));

// Profile & Notifications
app.use("/api/v1/profile",       require("./routes/profile.routes"));
app.use("/api/v1/notifications", require("./routes/notifications.routes"));
app.use("/api/v1",               require("./routes/fcm.routes"));

// Reports
app.use("/api/v1", require("./routes/surveillance.routes"));
app.use("/api/v1", require("./routes/labReport.route"));
app.use("/api/v1", require("./routes/annex2FImmediateReport.routes"));
app.use("/api/v1", require("./routes/annex2GLabSpecimen.routes"));
app.use("/api/v1", require("./routes/reports_count.routes"));
app.use("/api/v1", require("./routes/analytics.routes"));
app.use("/api/v1", require("./routes/map.routes"));


app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});


app.use((err, req, res, next) => {
  logger.error("Unhandled Error:", { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    message: "An unexpected error occurred"
  });
});

module.exports = app;