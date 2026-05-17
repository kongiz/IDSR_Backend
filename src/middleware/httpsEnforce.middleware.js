const logger = require("../config/logger");


module.exports = (req, res, next) => {
    if (process.env.NODE_ENV === "production") {
        if (req.headers["x-forwarded-proto"] !== "https") {
            logger.warn("HTTP redirected to HTTPS", {url: req.originalUrl, ip: req.ip});
            return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
        }
    }
    next();
}