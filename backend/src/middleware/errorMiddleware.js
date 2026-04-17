const multer = require("multer");
const { createHttpError } = require("../utils/httpError");

function normalizeMongooseValidationError(error) {
  const messages = Object.values(error?.errors || {})
    .map((item) => item?.message)
    .filter(Boolean);

  return {
    statusCode: 400,
    message: messages.join(" | ") || "Datos invalidos",
    details:
      messages.length > 0
        ? {
            fields: Object.keys(error?.errors || {}),
          }
        : undefined,
  };
}

function normalizeDuplicateKeyError(error) {
  const duplicateFields = Object.keys(error?.keyPattern || error?.keyValue || {});

  return {
    statusCode: 409,
    message: duplicateFields.length
      ? `Ya existe un registro con el mismo valor en: ${duplicateFields.join(", ")}`
      : "Registro duplicado",
    details:
      duplicateFields.length > 0
        ? {
            fields: duplicateFields,
          }
        : undefined,
  };
}

function normalizeError(error) {
  if (error?.message?.startsWith("Origen no permitido por CORS")) {
    return {
      statusCode: 403,
      message: error.message,
    };
  }

  if (error?.type === "entity.parse.failed") {
    return {
      statusCode: 400,
      message: "JSON invalido en el cuerpo de la solicitud",
    };
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return {
        statusCode: 400,
        message: "El archivo excede el tamano maximo permitido",
      };
    }

    return {
      statusCode: 400,
      message: error.message || "Error procesando el archivo",
    };
  }

  if (error?.name === "ValidationError") {
    return normalizeMongooseValidationError(error);
  }

  if (error?.name === "CastError") {
    return {
      statusCode: 400,
      message: error?.path
        ? `Valor invalido para ${error.path}`
        : "Valor invalido en la solicitud",
    };
  }

  if (error?.code === 11000) {
    return normalizeDuplicateKeyError(error);
  }

  const statusCode =
    Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
      ? error.statusCode
      : Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
        ? error.status
        : 500;

  return {
    statusCode,
    message: error?.message || "Ocurrio un error interno en el servidor",
    details: error?.details,
  };
}

function notFound(req, _res, next) {
  next(createHttpError(404, `Ruta no encontrada: ${req.originalUrl}`));
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const normalized = normalizeError(error);
  const isProduction = process.env.NODE_ENV === "production";
  const safeMessage =
    normalized.statusCode >= 500 && isProduction
      ? "Ocurrio un error interno en el servidor"
      : normalized.message;

  if (normalized.statusCode >= 500) {
    console.error("Unhandled backend error:", {
      method: req.method,
      path: req.originalUrl,
      message: error?.message,
      stack: error?.stack,
    });
  }

  const payload = {
    error: safeMessage,
    message: safeMessage,
  };

  if (normalized.details && !isProduction) {
    payload.details = normalized.details;
  }

  if (!isProduction && error?.stack) {
    payload.stack = error.stack;
  }

  return res.status(normalized.statusCode).json(payload);
}

module.exports = {
  notFound,
  errorHandler,
};
