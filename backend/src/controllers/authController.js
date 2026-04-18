const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getJwtSecret, getJwtExpiresIn } = require("../config/auth");
const { createHttpError } = require("../utils/httpError");
const {
  assertAuthActionAllowed,
  recordAuthFailure,
  clearAuthFailures,
} = require("../services/authRateLimitService");

const buildSafeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  isAdmin: user.isAdmin,
  adminTabOrder: Array.isArray(user.adminTabOrder) ? user.adminTabOrder : [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const buildToken = (user) =>
  jwt.sign({ id: user._id, isAdmin: user.isAdmin }, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  });

async function createUserFromPayload({
  name,
  email,
  password,
  isAdmin = false,
}) {
  if (!name || !email || !password) {
    const error = new Error("Nombre, correo y contrasena son obligatorios");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const userExists = await User.findOne({ email: normalizedEmail });

  if (userExists) {
    const error = new Error("Usuario ya existe");
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password: hashedPassword,
    isAdmin: Boolean(isAdmin),
  });
}

async function hasAnyUsers() {
  return (await User.countDocuments()) > 0;
}

function getBootstrapAdminToken() {
  return String(process.env.BOOTSTRAP_ADMIN_TOKEN || "").trim();
}

async function assertBootstrapAllowed(setupToken) {
  if (await hasAnyUsers()) {
    const error = new Error("El bootstrap inicial ya no esta disponible");
    error.statusCode = 409;
    throw error;
  }

  const configuredToken = getBootstrapAdminToken();

  if (!configuredToken) {
    const error = new Error(
      "BOOTSTRAP_ADMIN_TOKEN no esta configurado en el backend"
    );
    error.statusCode = 503;
    throw error;
  }

  if (String(setupToken || "").trim() !== configuredToken) {
    const error = new Error("Token de configuracion inicial invalido");
    error.statusCode = 403;
    throw error;
  }
}

exports.register = async (_req, res) => {
  return res.status(403).json({
    error: "Registro publico deshabilitado",
    message:
      "El registro publico esta deshabilitado. Usa el bootstrap inicial o la seccion Usuarios.",
  });
};

exports.getBootstrapStatus = async (_req, res) => {
  const requiresSetup = !(await hasAnyUsers());
  const bootstrapEnabled =
    requiresSetup && Boolean(getBootstrapAdminToken());

  return res.json({
    requiresSetup,
    bootstrapEnabled,
    message:
      requiresSetup && !bootstrapEnabled
        ? "Define BOOTSTRAP_ADMIN_TOKEN en el backend para habilitar el setup inicial."
        : "",
  });
};

exports.bootstrapAdmin = async (req, res) => {
  const { name, email, password, setupToken } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();

  assertAuthActionAllowed("bootstrapAdmin", req);

  try {
    await assertBootstrapAllowed(setupToken);

    const user = await createUserFromPayload({
      name,
      email: normalizedEmail,
      password,
      isAdmin: true,
    });

    clearAuthFailures("bootstrapAdmin", req);

    return res.status(201).json({
      token: buildToken(user),
      user: buildSafeUser(user),
    });
  } catch (error) {
    if (error?.statusCode && error.statusCode < 500) {
      recordAuthFailure("bootstrapAdmin", req);
    }

    throw error;
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw createHttpError(400, "Correo y contrasena son obligatorios");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  assertAuthActionAllowed("login", req, normalizedEmail);

  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    recordAuthFailure("login", req, normalizedEmail);
    throw createHttpError(401, "Credenciales invalidas");
  }

  clearAuthFailures("login", req, normalizedEmail);
  return res.json({ token: buildToken(user), user: buildSafeUser(user) });
};

exports.updatePreferences = async (req, res) => {
  const { adminTabOrder } = req.body || {};

  if (adminTabOrder !== undefined && !Array.isArray(adminTabOrder)) {
    throw createHttpError(400, "adminTabOrder debe ser un arreglo de tabs");
  }

  if (Array.isArray(adminTabOrder)) {
    req.user.adminTabOrder = adminTabOrder
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  }

  await req.user.save();

  return res.json({ user: buildSafeUser(req.user) });
};

exports.listUsers = async (_req, res) => {
  const users = await User.find()
    .sort({ createdAt: -1, _id: -1 })
    .select("-password")
    .lean();

  return res.json(users.map((user) => buildSafeUser(user)));
};

exports.adminCreateUser = async (req, res) => {
  const { name, email, password, isAdmin } = req.body || {};
  const user = await createUserFromPayload({
    name,
    email,
    password,
    isAdmin,
  });

  return res.status(201).json({
    user: buildSafeUser(user),
  });
};
