const pool  = require("../config/db");
const admin = require("../config/firebase");
const logger = require("../config/logger");


async function saveNotification({ user_id, title, body, type, reference_id, reference_type }) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user_id, title, body, type, reference_id ?? null, reference_type ?? null]
    );
  } catch (err) {
    logger.error("saveNotification error:", { err: err.message });
  }
}


async function getFcmTokens(user_id) {
  try {
    const result = await pool.query(
      `SELECT fcm_token FROM user_fcm_tokens WHERE user_id = $1`,
      [user_id]
    );
    return result.rows.map(r => r.fcm_token);
  } catch (err) {
    logger.error("getFcmTokens error:", { err: err.message });
    return [];
  }
}


async function getFcmTokensByRole(roles = []) {
  try {
    const result = await pool.query(
      `SELECT t.fcm_token
       FROM user_fcm_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE u.role = ANY($1)`,
      [roles]
    );
    return result.rows.map(r => r.fcm_token);
  } catch (err) {
    logger.error("getFcmTokensByRole error:", { err: err.message });
    return [];
  }
}


async function getUserIdsByRole(roles = []) {
  try {
    const result = await pool.query(
      `SELECT id FROM users WHERE role = ANY($1)`,
      [roles]
    );
    return result.rows.map(r => r.id);
  } catch (err) {
    logger.error("getUserIdsByRole error:", { err: err.message });
    return [];
  }
}


async function sendPush(tokens, title, body, data = {}) {
  if (!tokens.length) return;

  const chunks = chunkArray(tokens, 500);

  for (const chunk of chunks) {
    try {
      const messages = chunk.map(token => ({
        token,
        notification: { title, body },
        data,
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "idsr_notifications"
          }
        }
      }));

      const response = await admin.messaging().sendEach(messages);

      response.responses.forEach(async (resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            await pool.query(
              `DELETE FROM user_fcm_tokens WHERE fcm_token = $1`,
              [chunk[idx]]
            );
          }
        }
      });

    } catch (err) {
      logger.error("sendPush error:", { err: err.message });
    }
  }
}


async function notifyUser({ user_id, title, body, type, reference_id, reference_type }) {
  await saveNotification({ user_id, title, body, type, reference_id, reference_type });
  const tokens = await getFcmTokens(user_id);
  await sendPush(tokens, title, body, {
    type,
    reference_id:   String(reference_id ?? ""),
    reference_type: reference_type ?? ""
  });
}


async function notifyByRole({ roles, title, body, type, reference_id, reference_type }) {
  const userIds = await getUserIdsByRole(roles);
  const tokens  = await getFcmTokensByRole(roles);

  await Promise.all(
    userIds.map(uid =>
      saveNotification({ user_id: uid, title, body, type, reference_id, reference_type })
    )
  );

  await sendPush(tokens, title, body, {
    type,
    reference_id:   String(reference_id ?? ""),
    reference_type: reference_type ?? ""
  });
}


async function sendWeeklySurveillanceReminder() {
  try {
    const title = "Weekly Surveillance Report Due";
    const body  = "Please submit your weekly surveillance report before end of the day.";

    const userIds = await getUserIdsByRole(["Health Officer"]);
    const tokens  = await getFcmTokensByRole(["Health Officer"]);

    await Promise.all(
      userIds.map(uid =>
        saveNotification({
          user_id:        uid,
          title,
          body,
          type:           "REMINDER",
          reference_id:   null,
          reference_type: null
        })
      )
    );

    await sendPush(tokens, title, body, { type: "REMINDER" });
    logger.info(`Weekly reminder sent to ${userIds.length} health officers`);
  } catch (err) {
    logger.error("sendWeeklySurveillanceReminder error:", { err: err.message });
  }
}


function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  notifyUser,
  notifyByRole,
  sendWeeklySurveillanceReminder,
  saveNotification,
  getFcmTokens
};