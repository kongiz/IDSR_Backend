const path   = require("path");
const fs     = require("fs");
const logger = require("../config/logger");

exports.serveProtectedUpload = (req, res, next) => {
  try {
    const safePath    = path.normalize(req.path).replace(/^(\.\.[\/\\])+/, "");
    const uploadsDir  = path.resolve(__dirname, "../../uploads");
    const filePath    = path.join(uploadsDir, safePath);

    // Check directory traversal
    if (!filePath.startsWith(uploadsDir)) {
      logger.warn("Directory traversal attempt blocked", {
        userId:      req.user?.id,
        requestPath: req.path,
        ip:          req.ip,
      });
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

     // Log access to protected file
    logger.info("Protected file accessed", {
      userId:   req.user?.id,
      file:     safePath,
      ip:       req.ip,
      method:   req.method,
    });

    res.sendFile(filePath);
  } catch (err) {
    logger.error("Protected upload serve error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};