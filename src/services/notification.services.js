const https = require("https");

exports.sendEmail = async ({ to, subject, text }) => {
  try {
    const payload = JSON.stringify({
      sender: { name: "IDSR System", email: process.env.ALERT_EMAIL },
      to: [{ email: to }],
      subject,
      textContent: text
    });

    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "api.brevo.com",
        path: "/v3/smtp/email",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "Content-Length": Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error(`Brevo API error: ${res.statusCode} ${data}`));
        });
      });
      req.on("error", reject);
      req.write(payload);
      req.end();
    });

    console.log("Email sent successfully");
    return true;
  } catch (error) {
    console.error("Email Error:", error.message);
    return false;
  }
};