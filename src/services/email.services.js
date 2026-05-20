const Brevo = require("@getbrevo/brevo");

const client = Brevo.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const transactionalApi = new Brevo.TransactionalEmailsApi();

exports.sendEmail = async ({ to, subject, text }) => {
  try {
    const email = new Brevo.SendSmtpEmail();
    email.sender = { name: "IDSR Alert System", email: process.env.ALERT_EMAIL };
    email.to = [{ email: to }];
    email.subject = subject;
    email.textContent = text;

    await transactionalApi.sendTransacEmail(email);
    console.log("Email sent successfully");
    return true;
  } catch (error) {
    console.error("Email Error:", error.message);
    return false;
  }
};