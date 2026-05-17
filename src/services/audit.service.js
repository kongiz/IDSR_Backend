const db     = require("../config/db");
const logger = require("../config/logger");

/**
 * Log an auditable action
 * @param {object} params
 * @param {number}  params.userId
 * @param {string}  params.action     - VIEW | CREATE | UPDATE | DELETE | EXPORT | LOGIN | LOGOUT
 * @param {string}  params.resource   - LAB_REPORT | SURVEILLANCE_REPORT | USER_PROFILE | AUTH | etc.
 * @param {number}  [params.resourceId]
 * @param {string}  [params.ipAddress]
 * @param {string}  [params.userAgent]
 * @param {object}  [params.metadata]
 */
exports.audit = async ({
  userId,
  action,
  resource,
  resourceId  = null,
  ipAddress   = null,
  userAgent   = null,
  metadata    = null,
}) => {
  try {
    await db.query(
      `INSERT INTO audit_logs
        (user_id, action, resource, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        action,
        resource,
        resourceId,
        ipAddress,
        userAgent,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    logger.error("Audit log failed:", {
      err:      err.message,
      userId,
      action,
      resource,
    });
  }
};