const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth.middleware");
const pool    = require("../config/db");

router.post("/fcm-token", auth, async (req, res) => {
  try {
    const { fcm_token, device_id } = req.body;

    if (!fcm_token) {
      return res.status(400).json({ success: false, message: "FCM token required" });
    }

    await pool.query(
      `INSERT INTO user_fcm_tokens (user_id, fcm_token, device_id, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET fcm_token = $2, updated_at = NOW()`,
      [req.user.id, fcm_token, device_id ?? "default"]
    );

    return res.json({ success: true, message: "FCM token saved" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to save FCM token" });
  }
});

module.exports = router;