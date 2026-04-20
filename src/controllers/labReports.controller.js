const pool   = require("../config/db");
const logger = require("../config/logger");
const { labReportSchema } = require("../schemas/Labreport.schema");
const { notifyUser, notifyByRole } = require("../services/notificationFirebase.service");



exports.createLabReport = async (req, res) => {
  console.log("=== BODY ===", JSON.stringify(req.body, null, 2));
 console.log("=== FILES ===", req.files);
  const client = await pool.connect();

  try {
    const user = req.user;

    if (!user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (user.role === "Admin") {
      return res.status(403).json({ success: false, message: "Admin cannot submit lab reports" });
    }

    if (!req.files  || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "At least one lab result image is required" });
    }

    const parsed = labReportSchema.safeParse(
      Object.fromEntries(
        Object.entries(req.body).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
      )
    );

    if (!parsed.success) {
      logger.warn("Lab report validation failed:", { errors: parsed.error.flatten().fieldErrors });
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors
      });
    }

    const data = parsed.data;

    await client.query("BEGIN");

    const duplicate = await client.query(
      `SELECT 1 FROM laboratory_reports
       WHERE user_id           = $1
         AND lab_name          = $2
         AND date_lab_received = $3
         AND final_lab_result  = $4`,
      [user.id, data.labName, data.dateLabReceived, data.finalLabResult]
    );

    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "A lab report with the same lab name, received date, and result already exists"
      });
    }

    const insertResult = await client.query(
      `INSERT INTO laboratory_reports (
        user_id,
        region_id,
        district_id,
        lab_name,
        date_lab_received,
        specimen_condition,
        test_types_performed,
        final_lab_result,
        date_lab_sent_district,
        date_district_received_lab_result,
        lab_result_images
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        user.id,
        user.region_id   || null,
        user.district_id || null,
        data.labName,
        data.dateLabReceived,
        data.specimenCondition,
        data.testTypesPerformed,
        data.finalLabResult,
        data.dateLabSentDistrict,
        data.dateDistrictReceivedLabResult,
        req.files.map(f => f.path.replace(/\\/g, "/"))
      ]
    );

    await client.query("COMMIT");

    await Promise.all([
    notifyUser({
      user_id:        user.id,
      title:          "Lab Report Submitted",
      body:           `Your lab report from ${data.labName} has been submitted successfully.`,
      type:           "REPORT_SUBMITTED",
      reference_id:   insertResult.rows[0].id,
      reference_type: "LAB"
    }),

    notifyByRole({
      roles:          ["District Officer", "Regional Officer", "Admin"],
      title:          "New Lab Report",
      body:           `A new lab report from ${data.labName} has been submitted. Result: ${data.finalLabResult}.`,
      type:           "REPORT_SUBMITTED",
      reference_id:   insertResult.rows[0].id,
      reference_type: "LAB"
    })
  ]);


    return res.status(201).json({
      success: true,
      message: "Laboratory report saved successfully",
      data: { id: insertResult.rows[0].id }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("createLabReport Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error" });

  } finally {
    client.release();
  }
};