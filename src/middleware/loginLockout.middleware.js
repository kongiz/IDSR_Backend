const Redis  = require("ioredis");
const logger = require("../config/logger");

const redis = new Redis({
  host:     process.env.REDIS_HOST     || "127.0.0.1",
  port:     parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db:       parseInt(process.env.REDIS_DB)   || 0,
});

const MAX_ATTEMPTS   = 5;
const LOCKOUT_TTL    = 15 * 60; // 15 minutes in seconds
const ATTEMPT_TTL    = 15 * 60; // reset attempt counter after 15 mins

const lockoutKey  = (email) => `lockout:${email.toLowerCase()}`;
const attemptsKey = (email) => `attempts:${email.toLowerCase()}`;

exports.recordFailedAttempt = async (email) => {
  try {
    const key     = attemptsKey(email);
    const attempts = await redis.incr(key);
    await redis.expire(key, ATTEMPT_TTL);

    if (attempts >= MAX_ATTEMPTS) {
      await redis.set(lockoutKey(email), "1", "EX", LOCKOUT_TTL);
      logger.warn("Account locked due to failed attempts", { email });
    }

    return attempts;
  } catch (err) {
    logger.error("Lockout recordFailedAttempt error:", err.message);
  }
};

exports.clearFailedAttempts = async (email) => {
  try {
    await redis.del(attemptsKey(email));
    await redis.del(lockoutKey(email));
  } catch (err) {
    logger.error("Lockout clearFailedAttempts error:", err.message);
  }
};

exports.checkLockout = async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return next();

    const locked = await redis.get(lockoutKey(email));
    if (locked) {
      const ttl = await redis.ttl(lockoutKey(email));
      const minutes = Math.ceil(ttl / 60);
      logger.warn("Blocked login attempt on locked account", { email, ip: req.ip });
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.`,
      });
    }

    next();
  } catch (err) {
    logger.error("Lockout checkLockout error:", err.message);
    next(); 
  }
};