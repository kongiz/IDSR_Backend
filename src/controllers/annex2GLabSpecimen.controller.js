const pool = require("../config/db");
const { specimenReportSchema } = require("../schemas/Specimenreport.schema");

exports.submitSpecimenReport = async (req, res) => {
  const client = await pool.connect();

  try {
    const user = req.user;

    
    if (!user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (user.role === "Admin") {
      return res.status(403).json({
        success: false,
        message: "Admin cannot submit specimen reports"
      });
    }

    // Zod validation + sanitization
    const parsed = specimenReportSchema.safeParse(
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

    const data = parsed.data;

   
    await client.query("BEGIN");

  
    const duplicate = await client.query(
      `SELECT 1 FROM laboratory_report_form_with_specimen
      WHERE user_id                = $1
        AND suspected_disease      = $2
        AND date_specimen_collect  = $3
        AND specimen_unique_id     = $4`,
      [
        user.id,
        data.suspectedDisease,
        data.dateSpecimenCollect,
        data.specimenUniqueID || null
      ]
    );

    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "A specimen report with the same disease, collection date, and specimen ID already exists"
      });
    }

    const insertResult = await client.query(
      `INSERT INTO laboratory_report_form_with_specimen (
        user_id,
        region_id,
        district_id,
        date_specimen_collect,
        suspected_disease,
        specimen_type,
        specimen_unique_id,
        patient_name,
        gender,
        age,
        date_specimen_sent_lab,
        phone_number,
        email_clinician
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        user.id,
        user.region_id   || null,
        user.district_id || null,
        data.dateSpecimenCollect,
        data.suspectedDisease,
        data.specimenType,
        data.specimenUniqueID    || null,
        data.patientNameLab      || null,
        data.sex                 || null,
        data.age,
        data.dateSpecimenSentLab || null,
        data.phoneNumber         || null,
        data.emailClinician      || null
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Specimen report submitted successfully",
      data: { id: insertResult.rows[0].id }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("submitSpecimenReport Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });

  } finally {
    client.release();
  }
};