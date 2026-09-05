// Each entry is [attackFactor, defenseFactor] — attackFactor scales the
// team's own expected goals, defenseFactor scales how many they concede
// (applied to the opponent's expected goals). See matchSim.js.
const STYLE_MODS = {
  ECHILIBRAT: [1, 1],
  OFENSIV: [1.15, 1.10],
  DEFENSIV: [0.88, 0.85],
  POSESIE: [1.05, 0.95],
  CONTRAATAC: [1.05, 1.0],
};

const MARKING_MODS = {
  ZONAL: [1, 1],
  OM_LA_OM: [0.97, 0.92],
};

const PRESSING_MODS = {
  SCAZUT: [0.95, 0.90],
  MEDIU: [1, 1],
  RIDICAT: [1.06, 1.08],
};

/** Combines style + marking + pressing into a single { attackMod, defenseMod } pair. */
function tacticModifiers({ style, marking, pressing } = {}) {
  const [sa, sd] = STYLE_MODS[style] || STYLE_MODS.ECHILIBRAT;
  const [ma, md] = MARKING_MODS[marking] || MARKING_MODS.ZONAL;
  const [pa, pd] = PRESSING_MODS[pressing] || PRESSING_MODS.MEDIU;
  return { attackMod: sa * ma * pa, defenseMod: sd * md * pd };
}

module.exports = { STYLE_MODS, MARKING_MODS, PRESSING_MODS, tacticModifiers };
