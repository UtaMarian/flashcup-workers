const express = require("express");
const { listTransfers } = require("../controllers/transfers.controller");

const router = express.Router();

router.get("/", listTransfers);

module.exports = router;
