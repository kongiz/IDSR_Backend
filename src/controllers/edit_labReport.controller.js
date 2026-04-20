const pool   = require("../config/db");
const logger = require("../config/logger");
const { labReportSchema } = require("../schemas/Labreport.schema");

exports.editLabReport = async (req, res) => {
  const client = await pool.connect();

  try {
    const user     = req.user;
    const reportId = parseInt(req.params.id);

    if (!user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (isNaN(reportId)) {
      return res.status(400).json({ success: false, message: "Invalid report ID" });
    }

    const existing = await client.query(
      `SELECT * FROM laboratory_reports WHERE id = $1`,
      [reportId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const report = existing.rows[0];

    if (report.user_id !== user.id && user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to edit this report"
      });
    }

   
    if (user.role !== "Admin") {
        const submittedAt = new Date(report.created_at);
        const now         = new Date();
        const hoursDiff   = (now - submittedAt) / (1000 * 60 * 60);

        if (hoursDiff > 48) {
            return res.status(403).json({
                success: false,
                message: "This report can no longer be edited. The 48-hour edit window has passed."
            });
        }
    }

    const parsed = labReportSchema.safeParse(
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

    
   const imagePath = req.files && req.files.length > 0
    ? req.files[0].path.replace(/\\/g, "/")
    : report.lab_result_image;
    
    await client.query(
      `UPDATE laboratory_reports SET
        lab_name                          = $1,
        date_lab_received                 = $2,
        specimen_condition                = $3,
        test_types_performed              = $4,
        final_lab_result                  = $5,
        date_lab_sent_district            = $6,
        date_district_received_lab_result = $7,
        lab_result_image                  = $8,
        updated_at                        = NOW()
      WHERE id = $9`,
      [
        data.labName,
        data.dateLabReceived,
        data.specimenCondition,
        data.testTypesPerformed,
        data.finalLabResult,
        data.dateLabSentDistrict,
        data.dateDistrictReceivedLabResult,
        imagePath,
        reportId
      ]
    );

    await client.query(
      `INSERT INTO report_edit_logs (report_id, report_type, edited_by, previous_data, new_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [reportId, "LAB REPORT", user.id, JSON.stringify(report), JSON.stringify(data)]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Lab report updated successfully",
      data: { id: reportId }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("editLabReport Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};