const { default: rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const Redis          = require("ioredis");
const logger         = require("../config/logger");

let redisClient  = null;
let redisHealthy = false;

function getRedisClient() {
  if (redisClient) return redisClient;

redisClient = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 1,
  enableOfflineQueue:   false,
  lazyConnect:          true,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 500, 3000);
  },
});

  redisClient.on("connect", () => {
    redisHealthy = true;
    logger.info("Rate limiter Redis connected");
  });

  redisClient.on("error", (err) => {
    redisHealthy = false;
    logger.error("Rate limiter Redis error:", err.message);
  });

  redisClient.on("close", () => {
    redisHealthy = false;
    logger.warn("Rate limiter Redis connection closed");
  });

  
  redisClient.connect().catch(() => {
    logger.warn("Rate limiter: Redis unavailable, falling back to memory store");
  });

  return redisClient;
}

getRedisClient();

function makeStore(prefix) {
  if (!redisHealthy) return undefined; 

  try {
    return new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix:      `rl:${prefix}:`,
    });
  } catch (err) {
    logger.warn(`Rate limiter: could not create Redis store for "${prefix}", using memory`);
    return undefined;
  }
}

const userOrIpKey = (req) => {
  return req.user?.id ? `user_${req.user.id}` : ipKeyGenerator(req);
};

const onLimitReached = (limiterName) => (req, res, next, options) => {
  logger.warn("Rate limit hit", {
    limiter:    limiterName,
    userId:     req.user?.id || "unauthenticated",
    ip:         req.ip,
    method:     req.method,
    url:        req.originalUrl,
    retryAfter: res.getHeader("Retry-After"),
  });
  res.status(options.statusCode).json(options.message);
};

exports.globalLimiter = rateLimit({
  windowMs:        1 * 60 * 1000,
  max:             300,
  store:           makeStore("global"),
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         onLimitReached("global"),
  message: { success: false, message: "Too many requests, please slow down" },
});

exports.generalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             200,
  keyGenerator:    userOrIpKey,
  store:           makeStore("general"),
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         onLimitReached("general"),
  message: { success: false, message: "Too many requests, please try again later" },
});

exports.pollingLimiter = rateLimit({
  windowMs:        1 * 60 * 1000,
  max:             60,
  keyGenerator:    userOrIpKey,
  skip:            (req) => !!req.user,
  store:           makeStore("polling"),
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         onLimitReached("polling"),
  message: { success: false, message: "Too many requests, please try again later" },
});

exports.authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  store:           makeStore("auth"),
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         onLimitReached("auth"),
  message: { success: false, message: "Too many login attempts, please try again later" },
});

exports.refreshLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             60,
  store:           makeStore("refresh"),
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         onLimitReached("refresh"),
  message: { success: false, message: "Too many token refresh attempts, please try again later" },
});

exports.reportSubmitLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  keyGenerator:    userOrIpKey,
  store:           makeStore("report_submit"),
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         onLimitReached("report_submit"),
  message: { success: false, message: "Too many submissions, please wait before submitting again" },
});

exports.otpLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  store:           makeStore("otp_request"),
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         onLimitReached("otp_request"),
  message: { success: false, message: "Too many OTP requests, please try again in an hour" },
});

exports.otpVerifyLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  store:           makeStore("otp_verify"),
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         onLimitReached("otp_verify"),
  message: { success: false, message: "Too many verification attempts, please try again later" },
});