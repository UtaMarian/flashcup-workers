// 6-digit email-verification code: generation, hashing, and the verification
// email itself. Only the hash is ever stored (sha256 with a server-side pepper).

const crypto = require("crypto");
const { sendMail, smtpConfigured } = require("./mailer");

const PEPPER = process.env.JWT_SECRET || "dev-secret-change-me";

const CODE_TTL_MIN = Number(process.env.EMAIL_CODE_TTL_MIN || 15);
const RESEND_COOLDOWN_SEC = Number(process.env.EMAIL_RESEND_COOLDOWN_SEC || 60);
const MAX_ATTEMPTS = Number(process.env.EMAIL_MAX_ATTEMPTS || 5);
const APP_NAME = "Flash Cup";

function generateCode() {
  // 100000–999999, cryptographically random.
  return String(crypto.randomInt(100000, 1000000));
}

function hashCode(code, userId) {
  return crypto.createHash("sha256").update(`${code}:${userId}:${PEPPER}`).digest("hex");
}

/** Build the { emailVerifyCodeHash, emailVerifyExpiresAt, emailVerifySentAt, emailVerifyAttempts } patch. */
function buildCodeFields(code, userId) {
  return {
    emailVerifyCodeHash: hashCode(code, userId),
    emailVerifyExpiresAt: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000),
    emailVerifySentAt: new Date(),
    emailVerifyAttempts: 0,
  };
}

async function sendVerificationEmail(user, code) {
  const subject = `${APP_NAME} — codul tău de verificare: ${code}`;
  const text =
    `Salut, ${user.firstName}!\n\n` +
    `Codul tău de verificare pentru ${APP_NAME} este: ${code}\n` +
    `Este valabil ${CODE_TTL_MIN} minute.\n\n` +
    `Dacă nu tu ai creat acest cont, ignoră acest mesaj.`;
  const html =
    `<p>Salut, <b>${user.firstName}</b>!</p>` +
    `<p>Codul tău de verificare pentru <b>${APP_NAME}</b> este:</p>` +
    `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
    `<p>Este valabil ${CODE_TTL_MIN} minute. Dacă nu tu ai creat acest cont, ignoră acest mesaj.</p>`;

  return sendMail({ to: user.email, subject, text, html });
}

module.exports = {
  generateCode,
  hashCode,
  buildCodeFields,
  sendVerificationEmail,
  smtpConfigured,
  CODE_TTL_MIN,
  RESEND_COOLDOWN_SEC,
  MAX_ATTEMPTS,
};
