const express = require("express");
const {
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
} = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth");
const { loginLimiter, authLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", loginLimiter, login);

// Password reset (LOCAL accounts) — unauthenticated.
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);

// Social sign-in
router.post("/google", authLimiter, googleAuth);
router.post("/facebook", authLimiter, facebookAuth);

// Email verification (LOCAL accounts) — allowed while unverified.
router.post("/verify-email", authenticate, verifyEmail);
router.post("/resend-verification", authenticate, resendVerification);

// Onboarding — fill in the mandatory team + position for a social account.
router.post("/complete-profile", authenticate, completeProfile);

router.get("/me", authenticate, me);

module.exports = router;
