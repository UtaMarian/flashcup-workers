const prisma = require("../config/db");

const SETTINGS_ID = 1;

const EDITABLE_FIELDS = [
  "leagueWinnerTeamPrize", "championsQualifyTeamPrize", "internationalQualifyTeamPrize",
  "leagueWinnerPlayerBonus", "leaguePlayerMaxCash", "leaguePlayerMinCash",
  "cupWinnerTeamPrize", "cupFinalistTeamPrize", "cupSemifinalistTeamPrize", "cupQuarterfinalistTeamPrize",
  "cupWinnerPlayerBonus", "cupFinalistPlayerPrize", "cupSemifinalistPlayerPrize", "cupQuarterfinalistPlayerPrize",
  "championsCupWinnerTeamPrize", "championsCupWinnerPlayerBonus",
  "internationalCupWinnerTeamPrize", "internationalCupWinnerPlayerBonus",
  "nationalSupercupWinnerTeamPrize", "nationalSupercupWinnerPlayerBonus",
  "internationalSupercupWinnerTeamPrize", "internationalSupercupWinnerPlayerBonus",
  "supercupDay", "nationalCupStartRound", "continentalCupStartRound",
  "cupMatchDayStartHour", "cupMatchDayEndHour",
  "defaultMatchDayStartHour", "defaultMatchDayEndHour", "defaultDaysBetweenRounds", "defaultDoubleRoundRobin",
  "defaultQualifyChampionsSlots", "defaultQualifyInternationalSlots",
];

/** Lazily creates the singleton GameSettings row (schema defaults) on first read. */
async function getGameSettings() {
  const existing = await prisma.gameSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.gameSettings.create({ data: { id: SETTINGS_ID } });
}

/** Partial update — only whitelisted fields are ever written. */
async function updateGameSettings(patch) {
  await getGameSettings(); // ensure the row exists before updating it
  const data = {};
  for (const key of EDITABLE_FIELDS) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }
  return prisma.gameSettings.update({ where: { id: SETTINGS_ID }, data });
}

module.exports = { getGameSettings, updateGameSettings, EDITABLE_FIELDS };
