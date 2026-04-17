const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getJwtSecret, getJwtExpiresIn } = require("../config/auth");

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
  try {
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
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.bootstrapAdmin = async (req, res) => {
  try {
    const { name, email, password, setupToken } = req.body || {};

    await assertBootstrapAllowed(setupToken);

    const user = await createUserFromPayload({
      name,
      email,
      password,
      isAdmin: true,
    });

    return res.status(201).json({
      token: buildToken(user),
      user: buildSafeUser(user),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message,
      message: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Correo y contrasena son obligatorios",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Credenciales invalidas" });
    }

    return res.json({ token: buildToken(user), user: buildSafeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { adminTabOrder } = req.body || {};

    if (adminTabOrder !== undefined && !Array.isArray(adminTabOrder)) {
      return res
        .status(400)
        .json({ message: "adminTabOrder debe ser un arreglo de tabs" });
    }

    if (Array.isArray(adminTabOrder)) {
      req.user.adminTabOrder = adminTabOrder
        .map((value) => String(value || "").trim())
        .filter(Boolean);
    }

    await req.user.save();

    return res.json({ user: buildSafeUser(req.user) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.listUsers = async (_req, res) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1, _id: -1 })
      .select("-password")
      .lean();

    return res.json(users.map((user) => buildSafeUser(user)));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.adminCreateUser = async (req, res) => {
  try {
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
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message,
      message: error.message,
    });
  }
};
