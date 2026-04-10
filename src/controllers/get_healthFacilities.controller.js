const db     = require("../config/db");
const logger = require("../config/logger");

exports.getHealthFacilities = async (req, res) => {
  try {
    const { district_id } = req.query;

    if (!district_id) {
      return res.status(400).json({
        success: false,
        message: "district_id is required"
      });
    }

    if (isNaN(Number(district_id))) {
      return res.status(400).json({
        success: false,
        message: "district_id must be a valid number"
      });
    }

    const result = await db.query(
      `SELECT facility_id, facility_name
       FROM health_facilities
       WHERE district_id = $1
       ORDER BY facility_name ASC`,
      [parseInt(district_id)]
    );

    return res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error("getHealthFacilities Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};