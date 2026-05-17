const pool = require("../config/db");
const { decrypt, hashForLookup } = require("../../utils/encryption");
const { audit } = require("../services/audit.service");

exports.getSpecimenReports = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { region_id, district_id, dateSpecimenCollect, search } = req.query;

    const userResult = await client.query(
      `SELECT role, region_id, district_id FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { role, region_id: userRegion, district_id: userDistrict } = userResult.rows[0];

    const conditions = [];
    const params     = [];

    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (role === "Regional Officer") {
      conditions.push(`u.region_id = ${addParam(userRegion)}`);
    } else if (role === "District Officer") {
      conditions.push(`u.district_id = ${addParam(userDistrict)}`);
    } else if (role !== "Admin") {
      conditions.push(`ls.user_id = ${addParam(userId)}`);
    }

    if (region_id) {
      conditions.push(`u.region_id = ${addParam(parseInt(region_id))}`);
    }
    if (district_id) {
      conditions.push(`u.district_id = ${addParam(parseInt(district_id))}`);
    }
    if (dateSpecimenCollect) {
      conditions.push(`ls.date_specimen_collect >= ${addParam(dateSpecimenCollect)}`);
    }

    
    if (search) {
      const term       = `%${search.trim()}%`;
      const searchHash = hashForLookup(search);
      conditions.push(`(
        ls.patient_name       ILIKE ${addParam(term)}     OR
        ls.specimen_unique_id ILIKE ${addParam(term)}     OR
        u.firstname_hash      = ${addParam(searchHash)}   OR
        u.lastname_hash       = ${addParam(searchHash)}
      )`);
    }

    const where = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const joins = `
      FROM laboratory_report_form_with_specimen ls
      LEFT JOIN users           u ON ls.user_id    = u.id
      LEFT JOIN health_regions  r ON u.region_id   = r.region_id
      LEFT JOIN health_district d ON u.district_id = d.district_id
    `;

    const countParams = [...params];
    const dataParams  = [...params, limit, offset];

    const dataQuery = `
      SELECT
        ls.*,
        u.firstname AS submitted_firstname,
        u.lastname  AS submitted_lastname,
        r.region_name,
        d.district_name
      ${joins}
      ${where}
      ORDER BY ls.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      ${joins}
      ${where}
    `;

    const [dataResult, countResult] = await Promise.all([
      client.query(dataQuery, dataParams),
      client.query(countQuery, countParams)
    ]);

    const total = parseInt(countResult.rows[0].total);

   
    const results = dataResult.rows.map(row => ({
      ...row,
      full_name: row.submitted_firstname && row.submitted_lastname
        ? `${decrypt(row.submitted_firstname)} ${decrypt(row.submitted_lastname)}`
        : null,
      submitted_firstname: undefined,
      submitted_lastname:  undefined,
    }));

    await audit({
  userId:    userId,
  action:    "VIEW",
  resource:  "SPECIMEN_REPORT",
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
  metadata:  { count: results.length, page, filters: { region_id, district_id, dateSpecimenCollect, search } },
  });

    return res.json({
      success: true,
      data: {
        role,
        page,
        limit,
        total_records: total,
        total_pages:   Math.ceil(total / limit),
        results,
      }
    });

  } catch (error) {
    console.error("getSpecimenReports Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch specimen reports" });

  } finally {
    client.release();
  }
};