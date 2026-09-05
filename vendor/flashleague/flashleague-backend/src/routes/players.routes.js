const express = require("express");
const {
  getMe, updateProfile, changePassword, train, resign, joinTeam, getPlayerProfile,
  listMyTransferOffers, acceptTransferOffer, declineTransferOffer,
  getShop, createShopCheckout, getShopOrderStatus, buyTokenEnergy, claimDailyGift,
  markTutorialSeen, dismissManagerNotice, markPageTipSeen,
} = require("../controllers/players.controller");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Public — anyone can view a player's page (trophy case, history, stats).
router.get("/:id/profile", getPlayerProfile);

router.use(authenticate);

router.get("/me", getMe);
router.patch("/me", updateProfile);
router.patch("/me/password", changePassword);
router.post("/me/train", train);
router.post("/me/resign", resign);
router.post("/me/join", joinTeam);
router.post("/me/tutorial-seen", markTutorialSeen);
router.post("/me/manager-notice/dismiss", dismissManagerNotice);
router.post("/me/page-tip-seen", markPageTipSeen);

router.get("/me/shop", getShop);
router.post("/me/shop/checkout", createShopCheckout);
router.get("/me/shop/orders/:sessionId", getShopOrderStatus);
router.post("/me/shop/token-energy", buyTokenEnergy);
router.post("/me/shop/daily-gift", claimDailyGift);

router.get("/me/transfer-offers", listMyTransferOffers);
router.post("/me/transfer-offers/:id/accept", acceptTransferOffer);
router.post("/me/transfer-offers/:id/decline", declineTransferOffer);

module.exports = router;
