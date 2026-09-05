const express = require("express");
const { getMyReferrals } = require("../controllers/referrals.controller");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);
router.get("/me", getMyReferrals);

module.exports = router;
