export default function errorHandler(error, _req, res, _next) {
  console.error("[login] error no controlado:", error.message);
  res.status(error.status ?? 500).json({ error: error.code ?? "internal_error" });
}
