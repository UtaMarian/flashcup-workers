// Password reset — same 6-digit-code mechanism as email verification, for
// LOCAL (email/password) accounts. Only the code hash is stored.
// Reuses generateCode + hashCode from emailVerification so salting/format match.

const { generateCode, hashCode, smtpConfigured } = require("./emailVerification");
const { sendMail } = require("./mailer");

const RESET_TTL_MIN = Number(process.env.PASSWORD_RESET_TTL_MIN || 15);
const RESET_COOLDOWN_SEC = Number(process.env.PASSWORD_RESET_COOLDOWN_SEC || 60);
const RESET_MAX_ATTEMPTS = Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS || 5);
const APP_NAME = "Flash Cup";

/** Patch for the passwordReset* columns. */
function buildResetFields(code, userId) {
  return {
    passwordResetCodeHash: hashCode(code, userId),
    passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MIN * 60 * 1000),
    passwordResetSentAt: new Date(),
    passwordResetAttempts: 0,
  };
}

async function sendPasswordResetEmail(user, code) {
  const subject = `${APP_NAME} — cod de resetare a parolei: ${code}`;
  const text =
    `Salut, ${user.firstName}!\n\n` +
    `Codul pentru resetarea parolei ${APP_NAME} este: ${code}\n` +
    `Este valabil ${RESET_TTL_MIN} minute.\n\n` +
    `Dacă nu tu ai cerut resetarea, ignoră acest mesaj — parola rămâne neschimbată.`;
  const html =
    `<p>Salut, <b>${user.firstName}</b>!</p>` +
    `<p>Codul pentru resetarea parolei <b>${APP_NAME}</b> este:</p>` +
    `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
    `<p>Este valabil ${RESET_TTL_MIN} minute. Dacă nu tu ai cerut resetarea, ignoră acest mesaj — parola rămâne neschimbată.</p>`;

  return sendMail({ to: user.email, subject, text, html });
}

module.exports = {
  generateCode,
  hashCode,
  buildResetFields,
  sendPasswordResetEmail,
  smtpConfigured,
  RESET_TTL_MIN,
  RESET_COOLDOWN_SEC,
  RESET_MAX_ATTEMPTS,
};
