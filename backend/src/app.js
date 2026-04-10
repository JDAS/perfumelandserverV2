const express = require('express');
const cors = require('cors');

const app = express();
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const customObjectRoutes = require('./routes/customObjectRoutes');
const customRecordRoutes = require('./routes/customRecordRoutes');
const suiteRoutes = require('./routes/suiteRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const storefrontSettingsRoutes = require('./routes/storefrontSettingsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { createCorsOptions } = require('./config/cors');

app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '1mb' }));

app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/custom-objects', customObjectRoutes);
app.use('/api/custom-records', customRecordRoutes);
app.use('/api/suites', suiteRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/storefront-settings', storefrontSettingsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboards', dashboardRoutes);

app.get('/api/test', (req, res) => {
  res.json({ message: 'API funcionando 🚀' });
});

app.use((err, req, res, next) => {
  if (err?.message?.startsWith('Origen no permitido por CORS')) {
    return res.status(403).json({ message: err.message });
  }

  return next(err);
});

module.exports = app;
