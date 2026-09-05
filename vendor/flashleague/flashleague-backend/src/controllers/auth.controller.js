const prisma = require("../config/db");
const { hashPassword, comparePassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");
const { levelFromTotalXp } = require("../utils/xp");
const {
  verifyGoogleCredential,
  verifyFacebookAccessToken,
} = require("../utils/oauth");
const {
  generateCode,
  hashCode,
  buildCodeFields,
  sendVerificationEmail,
  smtpConfigured,
  RESEND_COOLDOWN_SEC,
  MAX_ATTEMPTS,
} = require("../utils/emailVerification");
const {
  buildResetFields,
  sendPasswordResetEmail,
  RESET_COOLDOWN_SEC,
  RESET_MAX_ATTEMPTS,
} = require("../utils/passwordReset");
const { recordReferral, completeReferral } = require("../utils/referrals");

const VALID_POSITIONS = [
  "GK", "DC", "LB", "RB", "DMC", "MC", "ML", "MR",
  "AMC", "AML", "AMR", "ST", "LW", "RW",
];

const IS_PROD = process.env.NODE_ENV === "production";

function publicUser(user) {
  const {
    passwordHash,
    emailVerifyCodeHash,
    emailVerifyExpiresAt,
    emailVerifyAttempts,
    passwordResetCodeHash,
    passwordResetExpiresAt,
    passwordResetSentAt,
    passwordResetAttempts,
    ...rest
  } = user;
  return rest;
}

/**
 * Validate the mandatory team + position choice and create the player row.
 * Shared by classic register and the social sign-in "complete profile" step.
 * `res` is passed so validation failures can short-circuit with the right code;
 * returns the created user, or null if a response was already sent.
 */
async function createPlayer(res, { email, passwordHash, firstName, lastName, teamId, position, nationality, googleId, facebookId, avatarUrl, authProvider }) {
  if (!VALID_POSITIONS.includes(position)) {
    res.status(400).json({ error: `Poziție invalidă. Valori acceptate: ${VALID_POSITIONS.join(", ")}.` });
    return null;
  }
  if (nationality !== undefined && nationality !== null && nationality !== "" && !/^[A-Z]{2}$/.test(nationality)) {
    res.status(400).json({ error: "Naționalitate invalidă." });
    return null;
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    res.status(409).json({ error: "Există deja un cont cu acest email." });
    return null;
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    res.status(404).json({ error: "Echipa selectată nu există." });
    return null;
  }

  const squadCount = await prisma.user.count({ where: { teamId } });
  if (squadCount >= 30) {
    res.status(409).json({ error: "Echipa selectată are deja lotul complet (30 de jucători)." });
    return null;
  }

  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: passwordHash || null,
      firstName,
      lastName,
      teamId,
      position,
      nationality: nationality || null,
      googleId: googleId || null,
      facebookId: facebookId || null,
      avatarUrl: avatarUrl || null,
      authProvider: authProvider || "LOCAL",
      role: "PLAYER",
      teamHistory: {
        create: { teamId, reason: "JOINED" },
      },
    },
  });
}

/**
 * Generate a fresh verification code, persist its hash, and email it.
 * Best-effort: a mail failure is logged but doesn't throw (user can resend).
 */
async function issueVerificationCode(user) {
  const code = generateCode();
  await prisma.user.update({
    where: { id: user.id },
    data: buildCodeFields(code, user.id),
  });
  try {
    await sendVerificationEmail(user, code);
  } catch (err) {
    console.error("[auth] Trimiterea emailului de verificare a eșuat:", err.message);
  }
  return code;
}

// POST /api/auth/register
// Team selection AND on-field position are both mandatory, per spec.
async function register(req, res, next) {
  try {
    const { email, password, firstName, lastName, teamId, position, nationality, ref } = req.body;

    if (!email || !password || !firstName || !lastName || !teamId || !position) {
      return res.status(400).json({
        error: "Câmpurile email, parolă, prenume, nume, echipă și poziție pe teren sunt obligatorii.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Parola trebuie să aibă minimum 8 caractere." });
    }

    const passwordHash = await hashPassword(password);

    const user = await createPlayer(res, {
      email, passwordHash, firstName, lastName, teamId, position, nationality,
      authProvider: "LOCAL",
    });
    if (!user) return; // createPlayer already answered

    // Credit whoever invited them — pays out once the email is verified.
    await recordReferral(user.id, ref);

    // LOCAL accounts must verify their email before they can play.
    const code = await issueVerificationCode(user);

    const token = signToken(user);
    const body = { token, user: publicUser(user), needsEmailVerification: true };
    // Dev convenience: surface the code when there's no SMTP to deliver it.
    if (!smtpConfigured && !IS_PROD) body.devCode = code;
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email și parolă sunt obligatorii." });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(401).json({ error: "Email sau parolă incorecte." });

    if (user.status === "BANNED") return res.status(403).json({ error: "Acest cont a fost banat." });
    if (user.status === "SUSPENDED") return res.status(403).json({ error: "Acest cont este suspendat." });

    if (!user.passwordHash) {
      return res.status(400).json({
        error: "Acest cont folosește autentificare Google/Facebook. Conectează-te cu butonul respectiv.",
      });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Email sau parolă incorecte." });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signToken(updated);
    res.json({ token, user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

/**
 * Shared tail for both social providers. `identity` is the normalized profile
 * from utils/oauth. Existing accounts (matched by provider id or email) are
 * logged straight in. New accounts are created right away *without* a team or
 * on-field position — the client then routes them to the onboarding page,
 * which calls POST /api/auth/complete-profile.
 */
async function finishSocialAuth(res, provider, identity, ref) {
  const idField = provider === "GOOGLE" ? "googleId" : "facebookId";

  let user =
    (await prisma.user.findUnique({ where: { [idField]: identity.providerId } })) ||
    (await prisma.user.findUnique({ where: { email: identity.email } }));

  if (user) {
    if (user.status === "BANNED") return res.status(403).json({ error: "Acest cont a fost banat." });
    if (user.status === "SUSPENDED") return res.status(403).json({ error: "Acest cont este suspendat." });

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        [idField]: user[idField] || identity.providerId,
        avatarUrl: user.avatarUrl || identity.avatarUrl || null,
        authProvider: provider,
        // The provider already verified this address.
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
        lastLoginAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email: identity.email,
        passwordHash: null,
        firstName: identity.firstName || "Jucător",
        lastName: identity.lastName || "",
        [idField]: identity.providerId,
        avatarUrl: identity.avatarUrl || null,
        authProvider: provider,
        role: "PLAYER",
        // Provider-verified email — no code needed.
        emailVerifiedAt: new Date(),
        // teamId + position deliberately left null — set at onboarding.
        lastLoginAt: new Date(),
      },
    });

    // New account via an invite link — the provider already verified the
    // address, so the referral pays out right away.
    await recordReferral(user.id, ref);
    await completeReferral(user.id);
  }

  const token = signToken(user);
  return res.json({ token, user: publicUser(user), needsProfile: !user.position });
}

// POST /api/auth/google   { credential }
async function googleAuth(req, res, next) {
  try {
    const identity = await verifyGoogleCredential(req.body.credential);
    await finishSocialAuth(res, "GOOGLE", identity, req.body.ref);
  } catch (err) {
    if (err && err.message && !err.status) return res.status(401).json({ error: err.message });
    next(err);
  }
}

// POST /api/auth/facebook   { accessToken }
async function facebookAuth(req, res, next) {
  try {
    const identity = await verifyFacebookAccessToken(req.body.accessToken);
    await finishSocialAuth(res, "FACEBOOK", identity, req.body.ref);
  } catch (err) {
    if (err && err.message && !err.status) return res.status(401).json({ error: err.message });
    next(err);
  }
}

// POST /api/auth/complete-profile   { teamId, position, nationality }
// Authenticated (Bearer). Fills in the mandatory team + on-field position for a
// social sign-in account that was created without them. Only runs while the
// profile is still incomplete — position can't be changed here afterwards.
async function completeProfile(req, res, next) {
  try {
    const user = req.user;
    if (user.position) {
      return res.status(409).json({ error: "Profilul este deja complet." });
    }

    const { teamId, position, nationality } = req.body;
    if (!teamId || !position) {
      return res.status(400).json({ error: "Echipa și poziția pe teren sunt obligatorii." });
    }
    if (!VALID_POSITIONS.includes(position)) {
      return res.status(400).json({ error: `Poziție invalidă. Valori acceptate: ${VALID_POSITIONS.join(", ")}.` });
    }
    if (nationality !== undefined && nationality !== null && nationality !== "" && !/^[A-Z]{2}$/.test(nationality)) {
      return res.status(400).json({ error: "Naționalitate invalidă." });
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: "Echipa selectată nu există." });

    const squadCount = await prisma.user.count({ where: { teamId } });
    if (squadCount >= 30) {
      return res.status(409).json({ error: "Echipa selectată are deja lotul complet (30 de jucători)." });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        teamId,
        position,
        nationality: nationality || null,
        teamHistory: { create: { teamId, reason: "JOINED" } },
      },
    });

    const token = signToken(updated);
    res.json({ token, user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-email   { code }
// Authenticated. Marks a LOCAL account as verified once the emailed 6-digit
// code checks out (with expiry + attempt limiting).
async function verifyEmail(req, res, next) {
  try {
    const user = req.user;
    if (user.emailVerifiedAt) {
      return res.status(409).json({ error: "Emailul este deja verificat." });
    }

    const code = String(req.body.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Codul trebuie să aibă 6 cifre." });
    }
    if (!user.emailVerifyCodeHash || !user.emailVerifyExpiresAt) {
      return res.status(400).json({ error: "Nu există un cod activ. Cere un cod nou." });
    }
    if (Date.now() > new Date(user.emailVerifyExpiresAt).getTime()) {
      return res.status(400).json({ error: "Codul a expirat. Cere un cod nou." });
    }
    if (user.emailVerifyAttempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Prea multe încercări. Cere un cod nou." });
    }

    if (hashCode(code, user.id) !== user.emailVerifyCodeHash) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifyAttempts: { increment: 1 } },
      });
      return res.status(400).json({ error: "Cod incorect." });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyCodeHash: null,
        emailVerifyExpiresAt: null,
        emailVerifyAttempts: 0,
      },
    });

    // If they came in through an invite link, the referrer gets their tokens now.
    await completeReferral(updated.id);

    res.json({ token: signToken(updated), user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/resend-verification
// Authenticated. Throttled re-send of a fresh code.
async function resendVerification(req, res, next) {
  try {
    const user = req.user;
    if (user.emailVerifiedAt) {
      return res.status(409).json({ error: "Emailul este deja verificat." });
    }
    if (user.emailVerifySentAt) {
      const elapsed = (Date.now() - new Date(user.emailVerifySentAt).getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SEC) {
        return res.status(429).json({
          error: `Așteaptă ${Math.ceil(RESEND_COOLDOWN_SEC - elapsed)} secunde înainte de a cere alt cod.`,
        });
      }
    }

    const code = await issueVerificationCode(user);
    const body = { success: true };
    if (!smtpConfigured && !IS_PROD) body.devCode = code;
    res.json(body);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/forgot-password   { email }
// Unauthenticated. Always answers 200 (never reveals whether an email exists).
// Only acts for LOCAL accounts (those that actually have a password).
async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "Emailul este obligatoriu." });

    const user = await prisma.user.findUnique({ where: { email } });
    const body = { success: true };

    if (user && user.passwordHash && user.status === "ACTIVE") {
      const throttled =
        user.passwordResetSentAt &&
        (Date.now() - new Date(user.passwordResetSentAt).getTime()) / 1000 < RESET_COOLDOWN_SEC;

      if (!throttled) {
        const code = generateCode();
        await prisma.user.update({
          where: { id: user.id },
          data: buildResetFields(code, user.id),
        });
        try {
          await sendPasswordResetEmail(user, code);
        } catch (err) {
          console.error("[auth] Trimiterea emailului de resetare a eșuat:", err.message);
        }
        if (!smtpConfigured && !IS_PROD) body.devCode = code;
      }
    }

    res.json(body);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password   { email, code, newPassword }
// Unauthenticated. Verifies the emailed 6-digit code, sets the new password and
// logs the user straight in.
async function resetPassword(req, res, next) {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const code = String(req.body.code || "").trim();
    const { newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Email, cod și parola nouă sunt obligatorii." });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Codul trebuie să aibă 6 cifre." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Parola nouă trebuie să aibă minimum 8 caractere." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const GENERIC = "Cod invalid sau expirat. Cere un cod nou.";

    if (!user || !user.passwordResetCodeHash || !user.passwordResetExpiresAt) {
      return res.status(400).json({ error: GENERIC });
    }
    if (user.status === "BANNED") return res.status(403).json({ error: "Acest cont a fost banat." });
    if (Date.now() > new Date(user.passwordResetExpiresAt).getTime()) {
      return res.status(400).json({ error: GENERIC });
    }
    if (user.passwordResetAttempts >= RESET_MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Prea multe încercări. Cere un cod nou." });
    }
    if (hashCode(code, user.id) !== user.passwordResetCodeHash) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetAttempts: { increment: 1 } },
      });
      return res.status(400).json({ error: "Cod incorect." });
    }

    const passwordHash = await hashPassword(newPassword);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetCodeHash: null,
        passwordResetExpiresAt: null,
        passwordResetSentAt: null,
        passwordResetAttempts: 0,
        // Receiving the reset email also proves the address.
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
        lastLoginAt: new Date(),
      },
    });

    // A never-verified account that resets its password has now proven the
    // address — settle any pending invite referral.
    if (!user.emailVerifiedAt) await completeReferral(updated.id);

    res.json({ token: signToken(updated), user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res) {
  const derived = levelFromTotalXp(req.user.xp);
  res.json({ user: publicUser(req.user), progression: derived });
}

module.exports = {
  register,
  login,
  me,
  googleAuth,
  facebookAuth,
  completeProfile,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  VALID_POSITIONS,
};
