const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.ALERT_EMAIL,
    pass: process.env.ALERT_EMAIL_PASSWORD
  }
});

transporter.verify((error) => {
  if (error) {
    console.error("Email transporter error:", error.message);
  } else {
    console.log("Email transporter ready");
  }
});

exports.sendEmail = async ({ to, subject, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"IDSR Alert System" <${process.env.ALERT_EMAIL}>`,
      to,
      subject,
      text
    });
    console.log("Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Email Error:", error.message);
    return false;
  }
};