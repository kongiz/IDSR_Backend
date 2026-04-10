const db = require("../config/db");

exports.getHealthDistricts = async (req, res) => {
  try {
    const { region_id } = req.query;

    if (!region_id) {
      return res.status(400).json({
        success: false,
        message: "region_id is required"
      });
    }

    const result = await db.query(
      `SELECT district_id, district_name
       FROM health_district
       WHERE region_id = $1
       ORDER BY district_name ASC`,
      [region_id]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error("Get Districts Error:", error);
    res.status(500).json({
      success: false,
      message: "Query failed"
    });
  }
};
