const pool = require("../config/db");

exports.getMapPoints = async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) return res.status(401).json({ success: false, message: "Unauthorized" });

    
    let surveillanceWhere = "";
    let annexWhere        = "";
    const params          = [];

    if (user.role === "Regional Officer") {
      surveillanceWhere = `WHERE sr.region_id = $1`;
      annexWhere        = `WHERE a.region_id  = $1`;
      params.push(user.region_id);
    } else if (user.role === "District Officer") {
      surveillanceWhere = `WHERE sr.district_id = $1`;
      annexWhere        = `WHERE a.district_id  = $1`;
      params.push(user.district_id);
    }
    

    const [surveillanceResult, annexResult] = await Promise.all([

      // Surveillance report points
      pool.query(`
        SELECT
          sr.id,
          sr.facility_geo                          AS geo,
          f.facility_name                          AS label,
          r.region_name,
          d.district_name,
          sr.epiweek,
          sr.date_from,
          sr.date_to,
          'SURVEILLANCE'                           AS type
        FROM surveillance_reports sr
        LEFT JOIN health_facilities f ON sr.facility_id = f.facility_id
        LEFT JOIN health_regions    r ON sr.region_id   = r.region_id
        LEFT JOIN health_district   d ON sr.district_id = d.district_id
        ${surveillanceWhere}
        AND sr.facility_geo IS NOT NULL
        AND sr.facility_geo != ''
        ORDER BY sr.id DESC
      `, params),

      // Annex 2F — individual case points
      pool.query(`
        SELECT
          a.id,
          a.caseGeo                                AS geo,
          a.disease                                AS label,
          a.patient_name,
          a.outcome,
          a.gender,
          a.age,
          r.region_name,
          d.district_name,
          a.date_seen,
          'ANNEX2F'                                AS type
        FROM annex2f_immediate_case_reports a
        LEFT JOIN health_regions  r ON a.region_id   = r.region_id
        LEFT JOIN health_district d ON a.district_id = d.district_id
        ${annexWhere}
        AND a.caseGeo IS NOT NULL
        AND a.caseGeo != ''
        ORDER BY a.id DESC
      `, params)
    ]);

    
    const parseGeo = (geoStr) => {
      if (!geoStr) return null;
      const parts = geoStr.split(",").map(s => parseFloat(s.trim()));
      if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
      return { lat: parts[0], lng: parts[1] };
    };

    const surveillancePoints = surveillanceResult.rows
      .map(row => ({ ...row, coords: parseGeo(row.geo) }))
      .filter(row => row.coords !== null);

    const annexPoints = annexResult.rows
      .map(row => ({ ...row, coords: parseGeo(row.geo) }))
      .filter(row => row.coords !== null);

    return res.json({
      success: true,
      data: {
        surveillance: surveillancePoints,
        annex2f:      annexPoints
      }
    });

  } catch (error) {
    console.error("getMapPoints Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch map points" });
  }
};