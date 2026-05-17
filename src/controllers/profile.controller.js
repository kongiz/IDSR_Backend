const pool   = require("../config/db");
const bcrypt = require("bcryptjs");
const logger = require("../config/logger");
const { decryptUserFields, encryptUserFields } = require("../services/userEncryption.service");
const { audit } = require("../services/audit.service");

exports.getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id, u.firstname, u.lastname, u.email, u.phone, 
        u.gender, u.role, u.is_verified, u.created_at,
        hr.region_name,
        hd.district_name
       FROM users u
       LEFT JOIN health_regions  hr ON u.region_id   = hr.region_id
       LEFT JOIN health_district hd ON u.district_id = hd.district_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = decryptUserFields(result.rows[0]);

    // Audit log — VIEW profile
    await audit({
      userId:     req.user.id,
      action:     "VIEW",
      resource:   "USER_PROFILE",
      resourceId: req.user.id,
      ipAddress:  req.ip,
      userAgent:  req.headers["user-agent"],
    });

    return res.json({ success: true, data: user });

  } catch (err) {
    logger.error("getProfile error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.updateProfile = async (req, res) => {
  try {
    const { firstname, lastname, phone } = req.body;

    if (!firstname || !lastname) {
      return res.status(400).json({ success: false, message: "First and last name are required" });
    }

    const encrypted = encryptUserFields({
      firstname: firstname.trim(),
      lastname:  lastname.trim(),
      phone:     phone?.trim() || null,
    });

    await pool.query(
      `UPDATE users 
       SET firstname      = $1,
           lastname       = $2,
           phone          = $3,
           firstname_hash = $4,
           lastname_hash  = $5
       WHERE id = $6`,
      [
        encrypted.firstname,
        encrypted.lastname,
        encrypted.phone || null,
        encrypted.firstname_hash,
        encrypted.lastname_hash,
        req.user.id
      ]
    );

    // Audit log — UPDATE profile
    await audit({
      userId:     req.user.id,
      action:     "UPDATE",
      resource:   "USER_PROFILE",
      resourceId: req.user.id,
      ipAddress:  req.ip,
      userAgent:  req.headers["user-agent"],
      metadata:   { fields_updated: ["firstname", "lastname", "phone"] },
    });

    return res.json({ success: true, message: "Profile updated successfully" });

  } catch (err) {
    logger.error("updateProfile error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const result = await pool.query(
      `SELECT password FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "New password must be different from current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE users SET password = $1 WHERE id = $2`,
      [hashedPassword, req.user.id]
    );

    // Audit log — password change
    await audit({
      userId:     req.user.id,
      action:     "UPDATE",
      resource:   "USER_PASSWORD",
      resourceId: req.user.id,
      ipAddress:  req.ip,
      userAgent:  req.headers["user-agent"],
    });

    return res.json({ success: true, message: "Password changed successfully" });

  } catch (err) {
    logger.error("changePassword error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};