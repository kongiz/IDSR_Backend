const db = require("../config/db");

exports.getFacilityLocations = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        region_id,
        district_id,
        facility_id,
        facility_geo,
        created_at
       FROM surveillance_reports
       WHERE facility_geo IS NOT NULL
         AND facility_geo != ''`
    );

    res.json(result.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch facility locations"
    });
  }
};