const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJwtSecret, getJwtExpiresIn } = require('../config/auth');

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

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nombre, correo y contraseña son obligatorios' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
      return res.status(400).json({ message: 'Usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const safeUser = buildSafeUser(user);
    const token = buildToken(user);

    return res.status(201).json({ token, user: safeUser });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = buildToken(user);

    return res.json({ token, user: buildSafeUser(user) });
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
