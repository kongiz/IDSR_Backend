const db = require("../config/db");

exports.getHealthDistricts = async (req, res) => {
  try {
    const { rows: districts } = await db.query(
      `SELECT 
         d.district_id,
         d.district_name,
         r.region_id,
         r.region_name,
         r.region_code
       FROM health_district d
       JOIN health_regions r ON d.region_id = r.region_id
       ORDER BY r.region_name, d.district_name`
    );

    res.json({
      success: true,
      data: districts
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Query failed"
    });
  }
};