// Express 4 no propaga los rechazos de handlers async al errorHandler: hay que encadenarlos a mano.
export default function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
