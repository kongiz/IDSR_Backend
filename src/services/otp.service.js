const pool   = require("../config/db");
const crypto = require("crypto");
const { sendEmail } = require("./email.services");


function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}


async function saveOtp(userId, otp, type) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await pool.query(
    `UPDATE users 
     SET otp_code = $1, otp_expires_at = $2, otp_type = $3 
     WHERE id = $4`,
    [otp, expiresAt, type, userId]
  );
}


async function verifyOtp(userId, otp, type) {
  const result = await pool.query(
    `SELECT otp_code, otp_expires_at, otp_type 
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return { valid: false, message: "User not found" };

  const { otp_code, otp_expires_at, otp_type } = result.rows[0];

  if (otp_type !== type)        return { valid: false, message: "Invalid OTP type" };
  if (otp_code !== otp)         return { valid: false, message: "Invalid OTP code" };
  if (new Date() > otp_expires_at) return { valid: false, message: "OTP has expired" };

 
  await pool.query(
    `UPDATE users SET otp_code = NULL, otp_expires_at = NULL, otp_type = NULL WHERE id = $1`,
    [userId]
  );

  return { valid: true };
}


async function sendVerificationOtp(userId, email, firstname) {
  const otp = generateOtp();
  await saveOtp(userId, otp, "EMAIL_VERIFY");

  await sendEmail({
    to: email,
    subject: "IDSR — Verify Your Email",
    text: `Hello ${firstname},\n\nYour email verification code is:\n\n${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not create an account, please ignore this email.\n\nIDSR Team`
  });

  return otp;
}


async function sendPasswordResetOtp(userId, email, firstname) {
  const otp = generateOtp();
  await saveOtp(userId, otp, "PASSWORD_RESET");

  await sendEmail({
    to: email,
    subject: "IDSR — Password Reset Code",
    text: `Hello ${firstname},\n\nYour password reset code is:\n\n${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request a password reset, please ignore this email.\n\nIDSR Team`
  });

  return otp;
}

module.exports = {
  generateOtp,
  saveOtp,
  verifyOtp,
  sendVerificationOtp,
  sendPasswordResetOtp
};