// Thin wrapper around Nodemailer.
//
// Configure an SMTP provider through the environment (any provider works —
// Gmail, Resend, SendGrid, Mailgun, Brevo, Amazon SES, …):
//
//   SMTP_HOST=smtp.example.com
//   SMTP_PORT=587
//   SMTP_SECURE=false          # true for port 465
//   SMTP_USER=apikey-or-login
//   SMTP_PASS=secret
//   MAIL_FROM="Flash Cup <no-reply@yourdomain.com>"
//
// When SMTP is NOT configured, emails are printed to the server console instead
// (handy for local development) and `sendMail` still resolves.

const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
} = process.env;

const smtpConfigured = !!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);

let transporter = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === "true" || Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const FROM = MAIL_FROM || "Flash Cup <no-reply@flashcup.local>";

/** @returns {Promise<{ delivered: boolean }>} */
async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.log(
      `\n[mailer] SMTP neconfigurat — email NEtrimis.\n  Către: ${to}\n  Subiect: ${subject}\n  ${text}\n`
    );
    return { delivered: false };
  }
  await transporter.sendMail({ from: FROM, to, subject, text, html });
  return { delivered: true };
}

module.exports = { sendMail, smtpConfigured };
