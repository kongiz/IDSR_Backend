const pool   = require("../config/db");
const logger = require("../config/logger");
const { specimenReportSchema } = require("../schemas/Specimenreport.schema");

exports.editSpecimenReport = async (req, res) => {
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
      `SELECT * FROM laboratory_report_form_with_specimen WHERE id = $1`,
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

    await client.query(
      `UPDATE laboratory_report_form_with_specimen SET
        date_specimen_collect  = $1,
        suspected_disease      = $2,
        specimen_type          = $3,
        specimen_unique_id     = $4,
        patient_name           = $5,
        gender                 = $6,
        age                    = $7,
        date_specimen_sent_lab = $8,
        phone_number           = $9,
        email_clinician        = $10,
        updated_at             = NOW()
      WHERE id = $11`,
      [
        data.dateSpecimenCollect,
        data.suspectedDisease,
        data.specimenType,
        data.specimenUniqueID    || null,
        data.patientNameLab      || null,
        data.sex                 || null,
        data.age,
        data.dateSpecimenSentLab || null,
        data.phoneNumber         || null,
        data.emailClinician      || null,
        reportId
      ]
    );

    await client.query(
      `INSERT INTO report_edit_logs (report_id, report_type, edited_by, previous_data, new_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [reportId, "ANNEX2G SPECIMEN REPORT", user.id, JSON.stringify(report), JSON.stringify(data)]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Specimen report updated successfully",
      data: { id: reportId }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("editSpecimenReport Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};