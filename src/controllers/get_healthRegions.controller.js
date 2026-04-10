const db = require("../config/db");

exports.getHealthRegions = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT region_id, region_name FROM health_regions ORDER BY region_name ASC"
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error("Get Regions Error:", error);
    res.status(500).json({
      success: false,
      message: "Query failed"
    });
  }
};
