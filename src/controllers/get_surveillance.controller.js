const db     = require("../config/db");
const logger = require("../config/logger");

exports.getSurveillanceReports = async (req, res) => {
  try {
    const user = req.user;

    if (!user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }


    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    
    const { region_id, district_id, search, start_date, end_date, epiweek } = req.query;

    let whereClauses = [];
    let params       = [];
    let paramIndex   = 1;

    
    if (user.role === "Regional Officer") {
      whereClauses.push(`sr.region_id = $${paramIndex++}`);
      params.push(user.region_id);
    } else if (user.role === "District Officer") {
      whereClauses.push(`sr.district_id = $${paramIndex++}`);
      params.push(user.district_id);
    } else if (user.role !== "Admin") {
      whereClauses.push(`sr.user_id = $${paramIndex++}`);
      params.push(user.id);
    }

    
    if (region_id) {
      whereClauses.push(`sr.region_id = $${paramIndex++}`);
      params.push(parseInt(region_id));
    }

    if (district_id) {
      whereClauses.push(`sr.district_id = $${paramIndex++}`);
      params.push(parseInt(district_id));
    }

    if (start_date) {
      whereClauses.push(`sr.created_at >= $${paramIndex++}`);
      params.push(start_date);
    }

    if (end_date) {
      whereClauses.push(`sr.created_at <= $${paramIndex++}`);
      params.push(end_date);
    }

    if (epiweek) {
      whereClauses.push(`sr.epiweek = $${paramIndex++}`);
      params.push(epiweek);
    }

  
    if (search) {
      whereClauses.push(`(
        r.region_name    ILIKE $${paramIndex}
        OR d.district_name ILIKE $${paramIndex}
        OR sr.epiweek    ILIKE $${paramIndex}
        OR f.facility_name ILIKE $${paramIndex}
        OR u.firstname || ' ' || u.lastname ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereSQL     = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const filterParams = [...params];

    
    const dataQuery = `
      SELECT
        sr.*,
        r.region_name,
        d.district_name,
        f.facility_name,
        u.firstname || ' ' || u.lastname AS submitted_by
      FROM surveillance_reports sr
      LEFT JOIN health_regions   r ON sr.region_id   = r.region_id
      LEFT JOIN health_district  d ON sr.district_id = d.district_id
      LEFT JOIN health_facilities f ON sr.facility_id = f.facility_id
      LEFT JOIN users            u ON sr.user_id      = u.id
      ${whereSQL}
      ORDER BY sr.id DESC
      LIMIT  $${paramIndex++}
      OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    
    const countQuery = `
      SELECT COUNT(*) AS c
      FROM surveillance_reports sr
      LEFT JOIN health_regions   r ON sr.region_id   = r.region_id
      LEFT JOIN health_district  d ON sr.district_id = d.district_id
      LEFT JOIN health_facilities f ON sr.facility_id = f.facility_id
      LEFT JOIN users            u ON sr.user_id      = u.id
      ${whereSQL}
    `;

    const [reportResult, countResult] = await Promise.all([
      db.query(dataQuery, params),
      db.query(countQuery, filterParams)
    ]);

    const reports = reportResult.rows;
    const total   = parseInt(countResult.rows[0].c);

  
    if (reports.length > 0) {
      const reportIds     = reports.map(r => r.id);
      const diseaseResult = await db.query(
        `SELECT * FROM surveillance_diseases WHERE report_id = ANY($1)`,
        [reportIds]
      );

      const diseaseMap = {};
      for (const d of diseaseResult.rows) {
        if (!diseaseMap[d.report_id]) diseaseMap[d.report_id] = [];

        const under5_male   = (d.u5_male_alive   || 0) + (d.u5_male_dead   || 0);
        const under5_female = (d.u5_female_alive || 0) + (d.u5_female_dead || 0);
        const above5_male   = (d.a5_male_alive   || 0) + (d.a5_male_dead   || 0);
        const above5_female = (d.a5_female_alive || 0) + (d.a5_female_dead || 0);
        const computedTotal = under5_male + under5_female + above5_male + above5_female;

        diseaseMap[d.report_id].push({
          name:           d.disease_name,
          under5_male,
          under5_female,
          above5_male,
          above5_female,
          total: d.total_sample_collected !== null ? d.total_sample_collected : computedTotal
        });
      }

      for (const report of reports) {
        report.diseases = diseaseMap[report.id] || [];
      }
    }

    return res.json({
      success:       true,
      role:          user.role,
      page,
      limit,
      total_records: total,
      total_pages:   Math.ceil(total / limit),
      data:          reports
    });

  } catch (error) {
    logger.error("getSurveillanceReports Error:", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Failed to fetch surveillance reports"
    });
  }
};