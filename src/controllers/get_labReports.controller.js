const db = require("../config/db");
const { decrypt, hashForLookup } = require("../../utils/encryption");
const { audit } = require("../services/audit.service");

exports.getLabReports = async (req, res) => {
  try {
    const userId = req.user.id;

    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const {
      region_id,
      district_id,
      result_type,
      date_lab_received,
      search
    } = req.query;

    const userResult = await db.query(
      "SELECT role, region_id, district_id FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    const { role, region_id: userRegion, district_id: userDistrict } = userResult.rows[0];

    let whereClauses = [];
    let params       = [];
    let paramIndex   = 1;

    if (role === "Regional Officer") {
      whereClauses.push(`u.region_id = $${paramIndex++}`);
      params.push(userRegion);
    } else if (role === "District Officer") {
      whereClauses.push(`u.district_id = $${paramIndex++}`);
      params.push(userDistrict);
    } else if (role !== "Admin") {
      whereClauses.push(`lr.user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (region_id) {
      whereClauses.push(`u.region_id = $${paramIndex++}`);
      params.push(region_id);
    }
    if (district_id) {
      whereClauses.push(`u.district_id = $${paramIndex++}`);
      params.push(district_id);
    }
    if (result_type) {
      whereClauses.push(`lr.final_lab_result = $${paramIndex++}`);
      params.push(result_type);
    }
    if (date_lab_received) {
      whereClauses.push(`lr.date_lab_received >= $${paramIndex++}`);
      params.push(date_lab_received);
    }

    
    if (search) {
      const searchHash = hashForLookup(search);
      whereClauses.push(`(
        lr.lab_name              ILIKE $${paramIndex}     OR
        lr.specimen_condition    ILIKE $${paramIndex}     OR
        r.region_name            ILIKE $${paramIndex}     OR
        d.district_name          ILIKE $${paramIndex}     OR
        u.firstname_hash         = $${paramIndex + 1}     OR
        u.lastname_hash          = $${paramIndex + 1}
      )`);
      params.push(`%${search}%`, searchHash);
      paramIndex += 2;
    }

    const whereSQL = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const dataQuery = `
      SELECT lr.*,
             u.firstname AS submitted_firstname,
             u.lastname  AS submitted_lastname,
             r.region_name,
             d.district_name
      FROM laboratory_reports lr
      LEFT JOIN users           u ON lr.user_id     = u.id
      LEFT JOIN health_regions  r ON u.region_id    = r.region_id
      LEFT JOIN health_district d ON u.district_id  = d.district_id
      ${whereSQL}
      ORDER BY lr.id DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await db.query(dataQuery, [...params, limit, offset]);

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    
    const labReports = dataResult.rows.map(row => {
      const images = Array.isArray(row.lab_result_images)
        ? row.lab_result_images.map(img =>
            `${baseUrl}/${img.replace(/\\/g, "/").replace(/^\/+/, "")}`)
        : [];

      return {
        ...row,
        full_name: row.submitted_firstname && row.submitted_lastname
          ? `${decrypt(row.submitted_firstname)} ${decrypt(row.submitted_lastname)}`
          : null,
        submitted_firstname: undefined, 
        submitted_lastname:  undefined,
        lab_result_images:   images,
      };
    });

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM laboratory_reports lr
      LEFT JOIN users           u ON lr.user_id    = u.id
      LEFT JOIN health_regions  r ON u.region_id   = r.region_id
      LEFT JOIN health_district d ON u.district_id = d.district_id
      ${whereSQL}
    `;

    const countResult = await db.query(countQuery, params);
    const total       = Number(countResult.rows[0].total);

   await audit({
  userId:    userId,
  action:    "VIEW",
  resource:  "LAB_REPORT",
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
  metadata:  { count: labReports.length, page, filters: { region_id, district_id, result_type, date_lab_received, search } },
});

    res.json({
      status:        "success",
      role,
      page,
      limit,
      total_records: total,
      total_pages:   Math.ceil(total / limit),
      data:          labReports
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      status:  "error",
      message: "Failed to fetch laboratory reports"
    });
  }
};