const logger = require("../config/logger");

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Ruta ${req.method} ${req.originalUrl} nu există.` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  logger.error({ err, method: req.method, url: req.originalUrl, status }, "Unhandled request error");
  res.status(status).json({ error: err.message || "Eroare internă de server." });
}

module.exports = { notFoundHandler, errorHandler };
