const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.sendSMS = async ({ to, message }) => {
  const normalized = to.startsWith("+") ? to : `+220${to}`;

  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: normalized,          // ← was passing raw `to` before
    });

    console.log(`SMS sent | SID: ${result.sid} | To: ${normalized}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error(`SMS failed | To: ${normalized} | Error: ${error.message}`);
    return { success: false, error: error.message }; // ← caller can now check this
  }
};