const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendEmail = async ({ to, subject, text }) => {
  try {
    const { error } = await resend.emails.send({
      from: "IDSR System <onboarding@resend.dev>",
      to,
      subject,
      text
    });
    if (error) throw new Error(error.message);
    console.log("Email sent successfully");
    return true;
  } catch (error) {
    console.error("Email Error:", error.message);
    return false;
  }
};