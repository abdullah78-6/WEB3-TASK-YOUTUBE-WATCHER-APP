function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, _req, res, _next) {
  console.error("[Error]", err.message || err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
  });
}

module.exports = { notFoundHandler, errorHandler };
