const pool    = require("../config/db");
const bcrypt  = require("bcrypt");
const logger  = require("../config/logger");
const otpService = require("../services/otp.service");


exports.resendVerificationOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const result = await pool.query(
      `SELECT id, firstname, is_verified FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      return res.status(400).json({ success: false, message: "Email is already verified" });
    }

    await otpService.sendVerificationOtp(user.id, email, user.firstname);

    return res.json({ success: true, message: "Verification code sent to your email" });

  } catch (err) {
    logger.error("resendVerificationOtp error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const result = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const userId = result.rows[0].id;
    const verification = await otpService.verifyOtp(userId, otp, "EMAIL_VERIFY");

    if (!verification.valid) {
      return res.status(400).json({ success: false, message: verification.message });
    }

    await pool.query(
      `UPDATE users SET is_verified = TRUE WHERE id = $1`,
      [userId]
    );

    return res.json({ success: true, message: "Email verified successfully. You can now login." });

  } catch (err) {
    logger.error("verifyEmail error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const result = await pool.query(
      `SELECT id, firstname FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

   
    if (result.rows.length === 0) {
      return res.json({ success: true, message: "If this email exists, a reset code has been sent" });
    }

    const user = result.rows[0];
    await otpService.sendPasswordResetOtp(user.id, email, user.firstname);

    return res.json({ success: true, message: "Password reset code sent to your email" });

  } catch (err) {
    logger.error("forgotPassword error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const result = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const userId = result.rows[0].id;


    const userOtp = await pool.query(
      `SELECT otp_code, otp_expires_at, otp_type FROM users WHERE id = $1`,
      [userId]
    );

    const { otp_code, otp_expires_at, otp_type } = userOtp.rows[0];

    if (otp_type !== "PASSWORD_RESET") {
      return res.status(400).json({ success: false, message: "Invalid OTP type" });
    }
    if (otp_code !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP code" });
    }
    if (new Date() > otp_expires_at) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    return res.json({ success: true, message: "OTP verified. You can now reset your password." });

  } catch (err) {
    logger.error("verifyResetOtp error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── reset password ────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const result = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const userId = result.rows[0].id;

    // verify OTP one final time and clear it
    const verification = await otpService.verifyOtp(userId, otp, "PASSWORD_RESET");
    if (!verification.valid) {
      return res.status(400).json({ success: false, message: verification.message });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query(
      `UPDATE users SET password = $1 WHERE id = $2`,
      [hashedPassword, userId]
    );

    return res.json({ success: true, message: "Password reset successfully. You can now login." });

  } catch (err) {
    logger.error("resetPassword error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};