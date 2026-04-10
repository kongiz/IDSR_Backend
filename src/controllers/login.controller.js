const db     = require("../config/db");
const jwt    = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const logger = require("../config/logger");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }


    const userResult = await db.query(
      `SELECT id, firstname, lastname, email, phone, password,
              role, region_id, district_id, is_verified
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const user = userResult.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        requiresVerification: true,
        email: user.email
      });
    }

    const issuedAt            = Math.floor(Date.now() / 1000);
    const accessExpirySeconds = parseInt(process.env.JWT_EXPIRES_IN) * 60 || 3600;


    const accessToken = jwt.sign(
      {
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
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const userId      = req.user.id;
    const { fcm_token } = req.body;

    await db.query(
      "DELETE FROM user_tokens WHERE user_id = $1",
      [userId]
    );

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

    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });

  } catch (error) {
    logger.error("Logout Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};