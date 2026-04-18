const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' https: data: blob:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' https: data:",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

function applySecurityHeaders(req, res, next) {
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()"
  );

  const forwardedProto = req.headers["x-forwarded-proto"];
  const isSecureRequest =
    req.secure ||
    (Array.isArray(forwardedProto)
      ? forwardedProto[0] === "https"
      : String(forwardedProto || "").split(",")[0].trim() === "https");

  if (isSecureRequest) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  next();
}

module.exports = {
  CONTENT_SECURITY_POLICY,
  applySecurityHeaders,
};
