export default function httpError(status, code, details) {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}
