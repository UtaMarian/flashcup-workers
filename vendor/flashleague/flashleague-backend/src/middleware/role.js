/** Usage: requireRole("ADMIN") or requireRole("ADMIN", "MANAGER") */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Autentificare necesară." });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Nu ai permisiunea necesară pentru această acțiune." });
    }
    next();
  };
}

module.exports = { requireRole };
