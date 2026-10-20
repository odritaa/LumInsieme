export default function errorHandler(error, _req, res, _next) {
  const status = error.status ?? 500;
  if (status >= 500) console.error("[reunion] error no controlado:", error.message);
  const body = { error: error.code ?? "internal_error" };
  if (error.details) body.details = error.details;
  res.status(status).json(body);
}
