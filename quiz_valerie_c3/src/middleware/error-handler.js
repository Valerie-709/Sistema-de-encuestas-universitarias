export default function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || error.status || 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    status: "error",
    message: statusCode >= 500 ? "Internal server error" : error.message,
  });
}
