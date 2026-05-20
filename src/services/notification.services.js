const { TransactionalEmailsApi, SendSmtpEmail, ApiClient } = require("@getbrevo/brevo");

const apiInstance = new TransactionalEmailsApi();
apiInstance.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

exports.sendEmail = async ({ to, subject, text }) => {
  try {
    const email = new SendSmtpEmail();
    email.sender = { name: "IDSR System", email: process.env.ALERT_EMAIL };
    email.to = [{ email: to }];
    email.subject = subject;
    email.textContent = text;

    await apiInstance.sendTransacEmail(email);
    console.log("Email sent successfully");
    return true;
  } catch (error) {
    console.error("Email Error:", error.message);
    return false;
  }
};