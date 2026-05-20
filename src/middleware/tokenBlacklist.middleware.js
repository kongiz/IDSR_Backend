const Redis  = require("ioredis");
const logger = require("../config/logger");

const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

const blacklistKey = (jti) => `blacklist:${jti}`;

// Call this on logout or token compromise
exports.blacklistToken = async (decoded) => {
  try {
    const jti = decoded.jti;
    if (!jti) return;

    const now       = Math.floor(Date.now() / 1000);
    const remaining = decoded.exp - now;

    if (remaining > 0) {
      await redis.set(blacklistKey(jti), "1", "EX", remaining);
      logger.info("Token blacklisted", { jti, ttl: remaining });
    }
  } catch (err) {
    logger.error("Blacklist error:", err.message);
  }
};

exports.isBlacklisted = async (jti) => {
  try {
    if (!jti) return false;
    const result = await redis.get(blacklistKey(jti));
    return result === "1";
  } catch (err) {
    logger.error("Blacklist check error:", err.message);
    return false; 
  }
};