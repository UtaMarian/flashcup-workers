// Social sign-in verification helpers.
//
// Both functions take the credential the browser obtained from the provider and
// return a normalized identity: { providerId, email, firstName, lastName, avatarUrl }.
// They throw a plain Error (with a Romanian message) on any problem so the
// controller can turn it into a 401.

const { OAuth2Client } = require("google-auth-library");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || "";
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || "";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verify a Google Identity Services ID token (the `credential` string returned
 * by the GSI button callback) and extract the user's profile.
 */
async function verifyGoogleCredential(credential) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Autentificarea Google nu este configurată pe server.");
  }
  if (!credential || typeof credential !== "string") {
    throw new Error("Token Google lipsă.");
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
  } catch {
    throw new Error("Token Google invalid sau expirat.");
  }

  const p = ticket.getPayload();
  if (!p || !p.sub) throw new Error("Token Google invalid.");
  if (!p.email) throw new Error("Contul Google nu are un email asociat.");
  if (p.email_verified === false) {
    throw new Error("Emailul contului Google nu este verificat.");
  }

  return {
    providerId: p.sub,
    email: String(p.email).toLowerCase(),
    firstName: p.given_name || p.name || "Jucător",
    lastName: p.family_name || "",
    avatarUrl: p.picture || null,
  };
}

/**
 * Verify a Facebook Login access token (from `FB.login`) against the Graph API.
 * First confirms the token was issued for *our* app, then reads the profile.
 */
async function verifyFacebookAccessToken(accessToken) {
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    throw new Error("Autentificarea Facebook nu este configurată pe server.");
  }
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Token Facebook lipsă.");
  }

  const appToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;

  // 1) Make sure this token really belongs to our app and is still valid.
  const debugRes = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
      accessToken
    )}&access_token=${encodeURIComponent(appToken)}`
  );
  const debug = await debugRes.json().catch(() => ({}));
  const d = debug && debug.data;
  if (!d || !d.is_valid || String(d.app_id) !== String(FACEBOOK_APP_ID)) {
    throw new Error("Token Facebook invalid.");
  }

  // 2) Read the profile.
  const meRes = await fetch(
    `https://graph.facebook.com/me?fields=id,first_name,last_name,email,picture.width(256)&access_token=${encodeURIComponent(
      accessToken
    )}`
  );
  const me = await meRes.json().catch(() => ({}));
  if (!me || !me.id) throw new Error("Nu s-a putut citi profilul Facebook.");
  if (!me.email) {
    throw new Error(
      "Contul Facebook nu a partajat un email. Permite accesul la email sau folosește altă metodă."
    );
  }

  return {
    providerId: String(me.id),
    email: String(me.email).toLowerCase(),
    firstName: me.first_name || "Jucător",
    lastName: me.last_name || "",
    avatarUrl: me.picture && me.picture.data ? me.picture.data.url : null,
  };
}

module.exports = { verifyGoogleCredential, verifyFacebookAccessToken };
