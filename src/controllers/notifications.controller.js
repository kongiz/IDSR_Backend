const pool   = require("../config/db");
const logger = require("../config/logger");


exports.getNotifications = async (req, res) => {
  try {
    const user   = req.user;
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const [dataResult, countResult, unreadResult] = await Promise.all([
      pool.query(
        `SELECT * FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [user.id, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM notifications WHERE user_id = $1`,
        [user.id]
      ),
      pool.query(
        `SELECT COUNT(*) AS unread FROM notifications WHERE user_id = $1 AND is_read = false`,
        [user.id]
      )
    ]);

    return res.json({
      success:       true,
      unread_count:  parseInt(unreadResult.rows[0].unread),
      total_records: parseInt(countResult.rows[0].total),
      total_pages:   Math.ceil(parseInt(countResult.rows[0].total) / limit),
      page,
      limit,
      data:          dataResult.rows
    });

  } catch (err) {
    logger.error("getNotifications error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    return res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    logger.error("markAsRead error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
};


exports.markAllAsRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1`,
      [req.user.id]
    );
    return res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    logger.error("markAllAsRead error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    return res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    logger.error("deleteNotification error:", { err: err.message });
    return res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
};