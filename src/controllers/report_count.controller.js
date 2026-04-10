const db     = require("../config/db");
const logger = require("../config/logger");

exports.countReports = async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await db.query(
      `SELECT role, region_id, district_id FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const { role, region_id, district_id } = userResult.rows[0];
    let totalReports = 0;

    const allTables = [
      "surveillance_reports",
      "annex2f_immediate_case_reports",
      "laboratory_reports",
      "laboratory_report_form_with_specimen"
    ];

    const joinTables = [
      "annex2f_immediate_case_reports",
      "laboratory_reports",
      "laboratory_report_form_with_specimen"
    ];

    
    if (role === "Admin") {
      for (const table of allTables) {
        const result = await db.query(`SELECT COUNT(*) AS c FROM ${table}`);
        totalReports += parseInt(result.rows[0].c);
      }
    }

    
    else if (role === "Regional Officer") {
      const sResult = await db.query(
        `SELECT COUNT(*) AS c FROM surveillance_reports WHERE region_id = $1`,
        [region_id]
      );
      totalReports += parseInt(sResult.rows[0].c);

      for (const table of joinTables) {
        const result = await db.query(
          `SELECT COUNT(*) AS c
           FROM ${table} r
           JOIN users u ON r.user_id = u.id
           WHERE u.region_id = $1`,
          [region_id]
        );
        totalReports += parseInt(result.rows[0].c);
      }
    }

 
    else if (role === "District Officer") {
      const sResult = await db.query(
        `SELECT COUNT(*) AS c FROM surveillance_reports WHERE district_id = $1`,
        [district_id]
      );
      totalReports += parseInt(sResult.rows[0].c);

      for (const table of joinTables) {
        const result = await db.query(
          `SELECT COUNT(*) AS c
           FROM ${table} r
           JOIN users u ON r.user_id = u.id
           WHERE u.district_id = $1`,
          [district_id]
        );
        totalReports += parseInt(result.rows[0].c);
      }
    }

 
    else {
      for (const table of allTables) {
        const result = await db.query(
          `SELECT COUNT(*) AS c FROM ${table} WHERE user_id = $1`,
          [userId]
        );
        totalReports += parseInt(result.rows[0].c);
      }
    }

    return res.json({
      success:       true,
      total_reports: totalReports
    });

  } catch (error) {
    logger.error("countReports Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Failed to count reports"
    });
  }
};