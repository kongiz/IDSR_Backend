const db     = require("../config/db");
const jwt    = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const logger = require("../config/logger");
const { recordFailedAttempt, clearFailedAttempts } = require("../middleware/loginLockout.middleware");
const { randomUUID }     = require("crypto");
const { blacklistToken } = require("../middleware/tokenBlacklist.middleware");
const { hashForLookup }  = require("../../utils/encryption");
const { decryptUserFields } = require("../services/userEncryption.service");
const { audit }          = require("../services/audit.service");


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const emailHash  = hashForLookup(email);
    const userResult = await db.query(
      `SELECT id, firstname, lastname, email, phone, password,
         role, region_id, district_id, is_verified, is_active
       FROM users WHERE email_hash = $1`,
      [emailHash]
    );

    if (userResult.rows.length === 0) {
      await recordFailedAttempt(email);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = decryptUserFields(userResult.rows[0]);
    console.log("Decrypted user:", user.email, "password exists:", !!user.password);

    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log("Password match:", passwordMatch);
    if (!passwordMatch) {
      await recordFailedAttempt(email);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        success:              false,
        message:              "Please verify your email before logging in.",
        requiresVerification: true,
        email:                user.email
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact your administrator."
      });
    }

    const issuedAt            = Math.floor(Date.now() / 1000);
    const accessExpirySeconds = parseInt(process.env.JWT_EXPIRES_IN) * 60 || 3600;

    const accessToken = jwt.sign(
      {
        jti: randomUUID(),
        iat: issuedAt,
        exp: issuedAt + accessExpirySeconds,
        data: {
          id:          user.id,
          firstname:   user.firstname,
          lastname:    user.lastname,
          email:       user.email,
          phone:       user.phone       || null,
          role:        user.role        || null,
          region_id:   user.region_id   || null,
          district_id: user.district_id || null
        }
      },
      process.env.JWT_ACCESS_SECRET
    );

    const refreshExpiryDays    = parseInt(process.env.JWT_REFRESH_EXPIRES_IN) || 15;
    const refreshExpirySeconds = refreshExpiryDays * 24 * 60 * 60;

    const refreshToken = jwt.sign(
      {
        iat: issuedAt,
        exp: issuedAt + refreshExpirySeconds,
        data: { id: user.id }
      },
      process.env.JWT_REFRESH_SECRET
    );

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    const expiryDate    = new Date(Date.now() + refreshExpirySeconds * 1000);

    await db.query(
      `INSERT INTO user_tokens (user_id, refresh_token, expiry)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET refresh_token = $2, expiry = $3`,
      [user.id, hashedRefresh, expiryDate]
    );

    await clearFailedAttempts(email);

    // Audit log — LOGIN
    await audit({
      userId:    user.id,
      action:    "LOGIN",
      resource:  "AUTH",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata:  { role: user.role },
    });

    return res.status(200).json({
      success:       true,
      access_token:  accessToken,
      refresh_token: refreshToken,
      user: {
        id:          user.id,
        firstname:   user.firstname,
        lastname:    user.lastname,
        email:       user.email,
        phone:       user.phone       || null,
        role:        user.role        || null,
        region_id:   user.region_id   || null,
        district_id: user.district_id || null
      }
    });

  } catch (error) {
    logger.error("Login Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.logout = async (req, res) => {
  try {
    const userId        = req.user.id;
    const { fcm_token } = req.body;

    if (req.decoded) {
      await blacklistToken(req.decoded);
    }

    await db.query("DELETE FROM user_tokens WHERE user_id = $1", [userId]);

    if (fcm_token) {
      await db.query(
        "DELETE FROM user_fcm_tokens WHERE user_id = $1 AND fcm_token = $2",
        [userId, fcm_token]
      );
    } else {
      await db.query(
        "DELETE FROM user_fcm_tokens WHERE user_id = $1",
        [userId]
      );
    }

    // Audit log — LOGOUT
    await audit({
      userId:    userId,
      action:    "LOGOUT",
      resource:  "AUTH",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({ success: true, message: "Logged out successfully" });

  } catch (error) {
    logger.error("Logout Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};