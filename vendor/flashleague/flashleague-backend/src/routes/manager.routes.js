const express = require("express");
const {
  kickPlayer, getLineup, saveLineup, updateTeamColors,
  listFreeAgents, sendTransferOffer, listSentTransferOffers, cancelTransferOffer,
  listTransferListings, createTransferListing, withdrawTransferListing, buyTransferListing,
} = require("../controllers/manager.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

router.post("/kick/:userId", authenticate, requireRole("MANAGER", "ADMIN"), kickPlayer);
router.get("/lineup", authenticate, requireRole("MANAGER"), getLineup);
router.put("/lineup", authenticate, requireRole("MANAGER"), saveLineup);
router.patch("/team", authenticate, requireRole("MANAGER"), updateTeamColors);

// Transfers
router.get("/free-agents", authenticate, requireRole("MANAGER"), listFreeAgents);
router.get("/transfer-offers", authenticate, requireRole("MANAGER"), listSentTransferOffers);
router.post("/transfer-offers", authenticate, requireRole("MANAGER"), sendTransferOffer);
router.delete("/transfer-offers/:id", authenticate, requireRole("MANAGER"), cancelTransferOffer);
router.get("/transfer-listings", authenticate, requireRole("MANAGER"), listTransferListings);
router.post("/transfer-listings", authenticate, requireRole("MANAGER"), createTransferListing);
router.delete("/transfer-listings/:id", authenticate, requireRole("MANAGER"), withdrawTransferListing);
router.post("/transfer-listings/:id/buy", authenticate, requireRole("MANAGER"), buyTransferListing);

module.exports = router;
