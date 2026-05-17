const pool   = require("../config/db");
const bcrypt = require("bcryptjs");
const { selfRegisterSchema }  = require("../schemas/selfRegister.schema");
const otpService              = require("../services/otp.service");
const { encryptUserFields }   = require("../services/userEncryption.service");
const { hashForLookup }       = require("../../utils/encryption");

exports.selfRegister = async (req, res) => {
  const client = await pool.connect();

  try {
    const parsed = selfRegisterSchema.safeParse(
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

    await client.query("BEGIN");

    
    const emailHash    = hashForLookup(email);
    const existingUser = await client.query(
      `SELECT id FROM users WHERE email_hash = $1`, [emailHash]
    );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    
    const encrypted = encryptUserFields({ firstname, lastname, phone, email });

    const insertResult = await client.query(
      `INSERT INTO users
        (firstname, lastname, phone, email, email_hash, firstname_hash, lastname_hash,
         gender, role, region_id, district_id, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        encrypted.firstname, encrypted.lastname, encrypted.phone, encrypted.email,
        encrypted.email_hash, encrypted.firstname_hash, encrypted.lastname_hash,
        gender, role, region_id || null, district_id || null, hashedPassword
      ]
    );

    await client.query("COMMIT");

    const newUserId = insertResult.rows[0].id;

    await otpService.sendVerificationOtp(newUserId, email, firstname);

    return res.status(201).json({
      success:              true,
      message:              "Account created. Please check your email for a verification code.",
      requiresVerification: true,
      email:                email 
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("selfRegister Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};