const pool   = require("../config/db");
const logger = require("../config/logger");
const { decryptUserList, decryptUserFields } = require("../services/userEncryption.service");
const { hashForLookup }                      = require("../../utils/encryption");

const VALID_ROLES = [
  "Admin",
  "Regional Officer",
  "District Officer",
  "Health Officer",
  "Clinician",
  "Lab Technician",
  "Community Health Worker"
];


exports.getAllUsers = async (req, res) => {
  try {
    const { role, region_id, district_id, is_active, search } = req.query;

    let query = `
      SELECT 
        u.id, u.firstname, u.lastname, u.email, u.phone,
        u.role, u.is_active, u.is_verified, u.created_at,
        r.region_name, d.district_name
      FROM users u
      LEFT JOIN health_regions r ON u.region_id = r.region_id
      LEFT JOIN health_district d ON u.district_id = d.district_id
      WHERE 1=1
    `;

    const params = [];
    let idx = 1;

    if (role) {
      query += ` AND u.role = $${idx++}`;
      params.push(role);
    }
    if (region_id) {
      query += ` AND u.region_id = $${idx++}`;
      params.push(parseInt(region_id));
    }
    if (district_id) {
      query += ` AND u.district_id = $${idx++}`;
      params.push(parseInt(district_id));
    }
    if (is_active !== undefined) {
      query += ` AND u.is_active = $${idx++}`;
      params.push(is_active === "true");
    }

   
    if (search) {
      const searchHash = hashForLookup(search);
      query += ` AND (
        u.firstname_hash = $${idx}   OR
        u.lastname_hash  = $${idx}   OR
        u.role       = $${idx}   OR
        u.region_id  = $${idx}   OR
        u.district_id= $${idx}   OR
        u.email_hash     = $${idx}
      )`;
      params.push(searchHash);
      idx++;
    }

    query += ` ORDER BY u.created_at DESC`;

    const result = await pool.query(query, params);

    
    const users = decryptUserList(result.rows);

    return res.json({ success: true, data: users });

  } catch (error) {
    logger.error("getAllUsers Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.updateUserStatus = async (req, res) => {
  try {
    const { id }      = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      return res.status(400).json({ success: false, message: "is_active must be a boolean" });
    }

    const result = await pool.query(
      `UPDATE users SET is_active = $1 WHERE id = $2 
       RETURNING id, firstname, lastname, is_active`,
      [is_active, parseInt(id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

   
    const user = decryptUserFields(result.rows[0]);

    logger.info(`User ${user.id} ${is_active ? "activated" : "deactivated"} by admin`);

    return res.json({
      success: true,
      message: `User ${is_active ? "activated" : "deactivated"} successfully`,
      data: user
    });

  } catch (error) {
    logger.error("updateUserStatus Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`
      });
    }

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot change your own role" });
    }

    const result = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2 
       RETURNING id, firstname, lastname, role`,
      [role, parseInt(id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

   
    const user = decryptUserFields(result.rows[0]);

    logger.info(`User ${user.id} role changed to ${role} by admin`);

    return res.json({
      success: true,
      message: "User role updated successfully",
      data: user
    });

  } catch (error) {
    logger.error("updateUserRole Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};