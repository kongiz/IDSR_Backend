const db = require("../config/db");
const notificationService = require("./notification.services");

exports.notifyDistrictOfficer = async ({
  reportId,
  district_id,
  disease,
  site,
  reporterName,
  dateSeen
}) => {
  try {
    const result = await db.query(
      `SELECT id, email, phone
       FROM users
       WHERE role = 'District Officer'
       AND district_id = $1`,
      [district_id]
    );

    const officers = result.rows;

    for (const officer of officers) {

      const alertInsert = await db.query(
        `INSERT INTO annex2f_alerts (
          report_id,
          disease,
          district_id,
          recipient_user_id,
          alert_type,
          message
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id`,
        [
          reportId,
          disease,
          district_id,
          officer.id,
          "DISTRICT",
          `Immediate case reported: ${disease} at ${site} on ${dateSeen} by ${reporterName}`
        ]
      );

      const alertId = alertInsert.rows[0].id;
      let emailSent = false;
      let smsSent   = false;

      if (officer.email) {
        try {
          await notificationService.sendEmail({
            to:      officer.email,
            subject: "Immediate Disease Alert",
            text:    `Immediate case of ${disease} reported at ${site} on ${dateSeen} by ${reporterName}.`
          });
          emailSent = true;
        } catch (e) {
          console.error("District email failed:", e.message);
        }
      }

      if (officer.phone) {
        try {
          await notificationService.sendSMS({
            to:      officer.phone,
            message: `ALERT: ${disease} reported in your district at ${site} on ${dateSeen}.`
          });
          smsSent = true;
        } catch (e) {
          console.error("District SMS failed:", e.message);
        }
      }

      await db.query(
        `UPDATE annex2f_alerts
         SET email_sent = $1, sms_sent = $2
         WHERE id = $3`,
        [emailSent, smsSent, alertId]
      );
    }

  } catch (error) {
    console.error("District Alert Error:", error);
  }
};


exports.notifyRegionalOfficer = async ({
  reportId,
  region_id,
  disease,
  district_id,
  site,
  reporterName,
  dateSeen
}) => {
  try {
    const result = await db.query(
      `SELECT id, email, phone
       FROM users
       WHERE role = 'Regional Officer'
       AND region_id = $1`,
      [region_id]
    );

    const officers = result.rows;

    for (const officer of officers) {

      const alertInsert = await db.query(
        `INSERT INTO annex2f_alerts (
          report_id,
          disease,
          region_id,
          district_id,
          recipient_user_id,
          alert_type,
          message
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING id`,
        [
          reportId,
          disease,
          region_id,
          district_id,
          officer.id,
          "REGIONAL",
          `Escalated immediate case: ${disease} reported in district ${district_id} at ${site} on ${dateSeen}`
        ]
      );

      const alertId = alertInsert.rows[0].id;
      let emailSent = false;
      let smsSent   = false;

      if (officer.email) {
        try {
          await notificationService.sendEmail({
            to:      officer.email,
            subject: "Regional Immediate Case Alert",
            text:    `
              Immediate case reported.

              Disease    : ${disease}
              District   : ${district_id}
              Location   : ${site}
              Date Seen  : ${dateSeen}
              Reported By: ${reporterName}

              Please review immediately.
            `
          });
          emailSent = true;
        } catch (e) {
          console.error("Regional email failed:", e.message);
        }
      }

      if (officer.phone) {
        try {
          await notificationService.sendSMS({
            to:      officer.phone,
            message: `REGIONAL ALERT: ${disease} reported in district ${district_id} at ${site} on ${dateSeen}.`
          });
          smsSent = true;
        } catch (e) {
          console.error("Regional SMS failed:", e.message);
        }
      }

      await db.query(
        `UPDATE annex2f_alerts
         SET email_sent = $1, sms_sent = $2
         WHERE id = $3`,
        [emailSent, smsSent, alertId]
      );
    }

  } catch (error) {
    console.error("Regional Alert Error:", error);
  }
};


exports.triggerNationalAlertCheck = async ({
  reportId,
  disease,
  district_id,
  region_id
}) => {
  try {
    const thresholdResult = await db.query(
      `SELECT threshold_count, time_window_hours
       FROM annex2f_disease_thresholds
       WHERE disease_name = $1 AND is_active = TRUE`,
      [disease]
    );

    if (thresholdResult.rows.length === 0) {
      return;
    }

    const { threshold_count, time_window_hours } = thresholdResult.rows[0];

    const countResult = await db.query(
      `SELECT COUNT(*)
       FROM annex2f_immediate_case_reports
       WHERE disease = $1
       AND district_id = $2
       AND created_at >= NOW() - INTERVAL '${time_window_hours} HOURS'`,
      [disease, district_id]
    );

    const count = Number(countResult.rows[0].count);

    if (count >= threshold_count) {

      const admins = await db.query(
        `SELECT id FROM users WHERE role = 'Admin'`
      );

      for (const admin of admins.rows) {

        const alertInsert = await db.query(
          `INSERT INTO annex2f_alerts (
            report_id,
            disease,
            region_id,
            district_id,
            recipient_user_id,
            alert_type,
            message
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING id`,
          [
            reportId,
            disease,
            region_id,
            district_id,
            admin.id,
            "NATIONAL",
            `🚨 NATIONAL ALERT: ${count} cases of ${disease} in ${time_window_hours} hours in district ${district_id}`
          ]
        );

        const alertId = alertInsert.rows[0].id;
        let emailSent = false;
        let smsSent   = false;

        // Fetch admin contact details
        const adminDetails = await db.query(
          `SELECT email, phone FROM users WHERE id = $1`,
          [admin.id]
        );

        const adminUser = adminDetails.rows[0];

        if (adminUser?.email) {
          try {
            await notificationService.sendEmail({
              to:      adminUser.email,
              subject: "🚨 NATIONAL DISEASE ALERT",
              text:    `
                NATIONAL ALERT

                Disease  : ${disease}
                District : ${district_id}
                Region   : ${region_id}
                Cases    : ${count} in the last ${time_window_hours} hours

                Immediate action required.
              `
            });
            emailSent = true;
          } catch (e) {
            console.error("National email failed:", e.message);
          }
        }

        if (adminUser?.phone) {
          try {
            await notificationService.sendSMS({
              to:      adminUser.phone,
              message: `🚨 NATIONAL ALERT: ${count} cases of ${disease} in district ${district_id} in ${time_window_hours} hours.`
            });
            smsSent = true;
          } catch (e) {
            console.error("National SMS failed:", e.message);
          }
        }

        await db.query(
          `UPDATE annex2f_alerts
           SET email_sent = $1, sms_sent = $2
           WHERE id = $3`,
          [emailSent, smsSent, alertId]
        );
      }
    }

  } catch (error) {
    console.error("Dynamic Threshold Error:", error);
  }
};