const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const { adminRegisterSchema } = require("../schemas/adminRegister.schema");
const otpService = require("../services/otp.service");

exports.adminRegister = async (req, res) => {
  const client = await pool.connect();

  try {
    const creatorId = req.user.id;

    if (!creatorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const parsed = adminRegisterSchema.safeParse(
      Object.fromEntries(
        Object.entries(req.body).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
      )
    );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors
      });
    }

    const {
      firstname, lastname, phone, email,
      gender, role, region_id, district_id, password
    } = parsed.data;

    const creatorResult = await client.query(
      `SELECT role, region_id, district_id FROM users WHERE id = $1`, [creatorId]
    );

    if (creatorResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const creator = creatorResult.rows[0];
    let finalRegion   = region_id   || null;
    let finalDistrict = district_id || null;

    if (creator.role === "Admin") {
      if (role === "Regional Officer" && !region_id) {
        return res.status(400).json({ success: false, message: "Regional Officer requires a region ID" });
      }
      if (role === "District Officer" && (!region_id || !district_id)) {
        return res.status(400).json({ success: false, message: "District Officer requires both region and district IDs" });
      }
    } else if (creator.role === "Regional Officer") {
      if (role === "Admin") {
        return res.status(403).json({ success: false, message: "Regional Officers cannot create Admins" });
      }
      finalRegion = creator.region_id;
      if (role === "District Officer" && !district_id) {
        return res.status(400).json({ success: false, message: "District Officer requires a district ID" });
      }
    } else {
      return res.status(403).json({ success: false, message: "You are not allowed to create privileged users" });
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM users WHERE email = $1`, [email]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    if (finalRegion) {
      const regionCheck = await client.query(
        `SELECT 1 FROM health_regions WHERE region_id = $1`, [finalRegion]
      );
      if (regionCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Invalid region selected" });
      }
    }

    if (finalDistrict) {
      const districtCheck = await client.query(
        `SELECT 1 FROM health_district WHERE district_id = $1 AND region_id = $2`,
        [finalDistrict, finalRegion]
      );
      if (districtCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Invalid district for selected region" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertResult = await client.query(
      `INSERT INTO users
        (firstname, lastname, phone, email, gender, role, region_id, district_id, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [firstname, lastname, phone || null, email, gender || null, role, finalRegion, finalDistrict, hashedPassword]
    );

    await client.query("COMMIT");

    const newUserId = insertResult.rows[0].id;
    await otpService.sendVerificationOtp(newUserId, email, firstname);

    return res.status(201).json({
      success: true,
      message: `${role} registered successfully. A verification code has been sent to ${email}.`,
      requiresVerification: true,
      email: email
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("adminRegister Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};