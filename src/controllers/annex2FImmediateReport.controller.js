const pool = require("../config/db");
const alertService = require("../services/alert.services");
const { immediateReportSchema } = require("../schemas/Immediatereport.schema");
const { notifyUser, notifyByRole } = require("../services/notificationFirebase.service");

exports.submitImmediateReport = async (req, res) => {
   console.log("=== INCOMING BODY ===", JSON.stringify(req.body, null, 2));
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
        message: "Admin cannot submit immediate reports"
      });
    }

    // Zod validation + sanitization
    const parsed = immediateReportSchema.safeParse(
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

    
    const districtResult = await client.query(
      `SELECT region_id FROM health_district WHERE district_id = $1`,
      [data.district]
    );

    if (districtResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Invalid district selected"
      });
    }

    const region_id = districtResult.rows[0].region_id;

    // Duplicate check
    const duplicate = await client.query(
        `SELECT 1 FROM annex2f_immediate_case_reports
        WHERE user_id    = $1
          AND disease    = $2
          AND date_seen  = $3
          AND patient_name = $4`,
        [user.id, data.disease, data.dateSeen, data.patientName]
      );

    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "A report with the same disease, district, site, and date seen already exists"
      });
    }

    if (!user.region_id || !user.district_id) {
      return res.status(400).json({
        success: false,
        message: "Your account has no region or district assigned. Please contact admin."
      });
    }

    // Insert
  const insertResult = await client.query(
  `INSERT INTO annex2f_immediate_case_reports (
    user_id, region_id, district_id, facility_id,
    reporting_site_name, disease, patient_type,
    date_seen, patient_name, date_of_birth, age,
    gender, address, area, phone_number, occupation,
    date_of_onset, travel_history, destination,
    vaccine_doses, date_last_vaccine, date_specimen,
    date_lab, lab_results, outcome, classification,
    date_facility_notified, date_sent_district, reporter_name, caseGeo
  )
  VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
    $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
    $21,$22,$23,$24,$25,$26,$27,$28,$29, $30
  )
  RETURNING id`,
  [
    user.id,
    user.region_id             || null,
    user.district_id           || null,
    user.facility_id           || null,
    data.site                  || null,   
    data.disease,
    data.inpatientOutpatient   || null,   
    data.dateSeen,
    data.patientName           || null,
    data.dateOfBirth           || null,
    data.age                   || null,
    data.gender                || null,
    data.address               || null,
    data.urbanRural            || null,   
    data.phoneNumber           || null,
    data.occupation            || null,
    data.dateOfOnset           || null,
    data.travelHistory         || null,
    data.destination           || null,
    data.vaccineDoses          || null,
    data.dateLastVaccine       || null,
    data.dateSpecimen          || null,
    data.dateLab               || null,
    data.labResults            || null,
    data.outcome               || null,
    data.classification        || null,
    data.dateFacilityNotified,
    data.dateSentDistrict      || null,
    data.reporterName,
    data.caseGeo               || null
  ]
);

    const reportId = insertResult.rows[0].id;

    await client.query("COMMIT");

    await Promise.all([
  notifyUser({
    user_id:        user.id,
    title:          "Report Submitted",
    body:           `Your Annex 2F report for ${data.disease} has been submitted successfully.`,
    type:           "REPORT_SUBMITTED",
    reference_id:   reportId,
    reference_type: "ANNEX2F"
  }),
  notifyByRole({
    roles:          ["District Officer"],
    title:          "New Immediate Case Report",
    body:           `A new Annex 2F report for ${data.disease} was submitted by ${data.reporterName}.`,
    type:           "REPORT_SUBMITTED",
    reference_id:   reportId,
    reference_type: "ANNEX2F"
  }),
  notifyByRole({
    roles:          ["Regional Officer", "Admin"],
    title:          "New Immediate Case Report",
    body:           `New Annex 2F report for ${data.disease} in ${data.site ?? "unknown site"}.`,
    type:           "REPORT_SUBMITTED",
    reference_id:   reportId,
    reference_type: "ANNEX2F"
  }),

  alertService.notifyDistrictOfficer({ reportId, district_id: data.district, disease: data.disease, site: data.site, reporterName: data.reporterName, dateSeen: data.dateSeen }),
  alertService.notifyRegionalOfficer({ reportId, region_id, disease: data.disease, district_id: data.district }),
  alertService.triggerNationalAlertCheck({ reportId, disease: data.disease, district_id: data.district, region_id })
]);

    return res.status(201).json({
      success: true,
      message: "Immediate report submitted and alerts triggered",
      data: { id: reportId }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.log("submitImmediateReport Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });

  } finally {
    client.release();
  }
};