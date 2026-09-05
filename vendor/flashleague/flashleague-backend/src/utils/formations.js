// Slot templates for the Prim 11 builder. Each formation is an ordered list
// of 11 position codes (index 0 = GK) — the single source of truth for
// which position each lineup slot requires. Mirrored in frontend/src/ui.jsx
// (grouped into rows for rendering) — keep both in sync.
const FORMATIONS = {
  "4-4-2": ["GK", "LB", "DC", "DC", "RB", "ML", "MC", "MC", "MR", "ST", "ST"],
  "4-3-3": ["GK", "LB", "DC", "DC", "RB", "MC", "MC", "MC", "LW", "ST", "RW"],
  "3-5-2": ["GK", "DC", "DC", "DC", "ML", "MC", "MC", "MC", "MR", "ST", "ST"],
  "4-2-3-1": ["GK", "LB", "DC", "DC", "RB", "DMC", "DMC", "AML", "AMC", "AMR", "ST"],
  "3-4-3": ["GK", "DC", "DC", "DC", "ML", "MC", "MC", "MR", "LW", "ST", "RW"],
  "5-3-2": ["GK", "LB", "DC", "DC", "DC", "RB", "MC", "MC", "MC", "ST", "ST"],
};

module.exports = { FORMATIONS };
