const db     = require("../config/db");
const jwt    = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const logger = require("../config/logger");

exports.refreshAccessToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: "Refresh token required"
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token"
      });
    }

    const userId = decoded.data.id;
    const tokenResult = await db.query(
      "SELECT refresh_token, expiry FROM user_tokens WHERE user_id = $1",
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Session not found. Please log in again."
      });
    }

    const storedToken = tokenResult.rows[0];
    if (new Date(storedToken.expiry) < new Date()) {
      await db.query("DELETE FROM user_tokens WHERE user_id = $1", [userId]);
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again."
      });
    }

  
    const tokenMatch = await bcrypt.compare(refresh_token, storedToken.refresh_token);

    if (!tokenMatch) {
      await db.query("DELETE FROM user_tokens WHERE user_id = $1", [userId]);
      logger.warn("Refresh token mismatch — possible reuse attack", { userId });
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token. Please log in again."
      });
    }
    
    const userResult = await db.query(
      `SELECT id, firstname, lastname, email, phone, role, region_id, district_id
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const user      = userResult.rows[0];
    const issuedAt  = Math.floor(Date.now() / 1000);


    const accessExpirySeconds = parseInt(process.env.JWT_EXPIRES_IN) * 60 || 3600;

    const newAccessToken = jwt.sign(
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

    const newRefreshToken = jwt.sign(
      {
        iat: issuedAt,
        exp: issuedAt + refreshExpirySeconds,
        data: { id: userId }
      },
      process.env.JWT_REFRESH_SECRET
    );

    const hashedNewRefresh = await bcrypt.hash(newRefreshToken, 6);
    const newExpiry        = new Date(Date.now() + refreshExpirySeconds * 1000);

    await db.query(
      "UPDATE user_tokens SET refresh_token = $1, expiry = $2 WHERE user_id = $3",
      [hashedNewRefresh, newExpiry, userId]
    );

    return res.status(200).json({
      success:       true,
      access_token:  newAccessToken,
      refresh_token: newRefreshToken
    });

  } catch (error) {
    logger.error("Refresh Token Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};