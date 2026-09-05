const { getGameSettings, updateGameSettings } = require("../services/settingsService");

// GET /api/admin/settings
async function getSettings(req, res, next) {
  try {
    const settings = await getGameSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/settings
async function patchSettings(req, res, next) {
  try {
    const settings = await updateGameSettings(req.body || {});
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, patchSettings };
