const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.sendSMS = async ({ to, message }) => {
  try {
    const normalized = to.startsWith("+") ? to : `+220${to}`;
    
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to
    });
  } catch (error) {
    console.error("SMS Error:", error);
  }
};
