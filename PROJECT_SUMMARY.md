# Project Summary

Resumen corto para retomar este proyecto rapido sin reanalizar todo el repo.

## Que es este proyecto

`perfumeland-app` es una app full-stack para operaciones comerciales de Perfumeland.
Combina:

- storefront de productos
- panel admin protegido
- motor de objetos dinamicos tipo mini-CRM/ERP
- automatizaciones por triggers y flows
- reportes, dashboards, cotizaciones, pagos e inventario

La parte mas importante no es solo el catalogo: el nucleo real del sistema es la capa de metadatos y registros dinamicos montada sobre MongoDB.

## Stack

### Frontend

- React 19
- Vite
- React Router
- Zustand
- Axios
- Tailwind CSS
- Recharts

### Backend

- Node.js
- Express 5
- MongoDB + Mongoose
- JWT para autenticacion
- Multer para uploads
- Cloudinary para archivos
- `serverless-http` para despliegue serverless

## Estructura general

### `frontend/`

Interfaz publica y admin.

- `src/App.jsx`: define las rutas principales
- `src/layouts/`: layouts publico y admin
- `src/pages/`: paginas top-level
- `src/components/`: componentes UI, formularios, builder y admin
- `src/context/ObjectMetadataContext.jsx`: cachea los objetos dinamicos para el admin
- `src/context/StorefrontContext.jsx`: contexto del storefront
- `src/services/`: cliente HTTP y servicios de datos
- `src/store/`: estado persistente con Zustand

### `backend/`

API y logica de negocio.

- `src/app.js`: monta middlewares y rutas
- `src/server.js`: arranque local del servidor
- `src/functions/api.js`: entrada serverless para Netlify
- `src/routes/`: rutas Express
- `src/controllers/`: capa HTTP
- `src/services/`: logica de negocio principal
- `src/models/`: modelos Mongoose
- `src/scripts/`: migraciones, sincronizaciones y backfills
- `src/data/suites.js`: definiciones base de objetos de negocio
- `test/`: pruebas custom del backend

### `scripts/`

Scripts auxiliares a nivel repo, por ejemplo generacion de PDFs.

## Arquitectura clave

### 1. Motor de objetos dinamicos

El sistema permite definir objetos custom en MongoDB usando metadatos.

Archivo clave:

- `backend/src/models/CustomObject.js`

Define:

- campos
- layouts
- list views
- lookup filters
- formulas
- rollups
- triggers por objeto

Los registros reales de esos objetos se guardan con schema flexible:

- `backend/src/models/CustomRecord.js`

Cada objeto usa su propia coleccion y el modelo se resuelve dinamicamente con `getCustomRecordModel(objectName)`.

Esto convierte la app en algo mucho mas cercano a un Salesforce/CRM liviano que a una tienda tradicional.

### 2. Admin basado en metadata

El frontend admin no depende solo de formularios fijos.

Piezas importantes:

- `frontend/src/context/ObjectMetadataContext.jsx`
- `frontend/src/pages/ObjectMetadataPage.jsx`
- `frontend/src/components/ObjectForm.jsx`
- `frontend/src/components/ObjectListView.jsx`
- `frontend/src/components/LayoutEditor.jsx`
- `frontend/src/components/ListViewsEditor.jsx`
- `frontend/src/components/TriggerModal.jsx`

La UI del admin se construye en gran parte desde la metadata de `CustomObject`.

### 3. Automatizaciones

Hay dos capas relacionadas:

- triggers dentro de `CustomObject`
- flows mas estructurados en `AutomationFlow`

Se ven servicios como:

- `backend/src/services/triggerMotor.js`
- `backend/src/services/triggersEngine.js`
- `backend/src/services/automationFlowService.js`

Los triggers soportan acciones como:

- `updateField`
- `copyFromLookup`
- `createRecord`
- `generatePayments`
- `generatePaymentPlan`
- `setSaleItemPrice`
- `syncSaleItemStatus`
- `setSalePaymentStatus`

### 4. Suite base de negocio

El archivo `backend/src/data/suites.js` trae una suite llamada `commerce-ops`.

Esa suite instala objetos base como:

- `product`
- `sales`
- `sale_item`
- `payment`
- `payment_plan`
- `campaign`
- `campaign_participant`
- `campaign_entry`
- `campaign_sale_link`
- `attachments`
- `expenses`

En otras palabras, el negocio vive principalmente dentro de objetos dinamicos predefinidos, no tanto en modelos Mongoose fijos por cada entidad.

### 5. Reportes y dashboards

El backend incluye definiciones y servicios para reporteria:

- `backend/src/models/ReportDefinition.js`
- `backend/src/models/DashboardDefinition.js`
- `backend/src/controllers/reportController.js`
- `backend/src/controllers/dashboardController.js`

Servicios visibles por nombre:

- resumen financiero
- pagos por dia
- pagos proximos
- rendimiento anual por vendedor
- inversion street
- review de precios
- resumen de cliente

## Flujos visibles del producto

- Catalogo publico con home, carrito y detalle de producto
- Login y acceso admin
- CRUD dinamico de objetos y registros
- Cotizaciones y builder de cotizaciones
- Ventas, productos de venta y calculos de precios
- Credito, planes de pago y pagos
- Campanas/promociones/rifas
- Adjuntos y archivos
- Reportes y dashboards
- Workspace admin experimental (`workspace-lab` y `workspace-lab-2`)
- Pagina operativa movil (`/admin/mobile`)

## Entradas y rutas principales

### Frontend

Rutas importantes en `frontend/src/App.jsx`:

- `/`
- `/cart`
- `/products/:id`
- `/login`
- `/admin`
- `/admin/settings`
- `/admin/object/:apiName`
- `/admin/:object/new`
- `/admin/:object/:id`
- `/admin/:object/:id/view`
- `/admin/quote-builder`
- `/admin/workspace-lab`
- `/admin/workspace-lab-2`
- `/admin/mobile`

### Backend

Rutas base montadas en `backend/src/app.js`:

- `/api/products`
- `/api/auth`
- `/api/custom-objects`
- `/api/custom-records`
- `/api/suites`
- `/api/uploads`
- `/api/storefront-settings`
- `/api/reports`
- `/api/dashboards`
- `/api/automation-flows`

## Auth y estado

- El frontend usa `axios` con interceptor en `frontend/src/services/apiClient.js`
- Si una respuesta da `401`, hace logout automatico
- El auth state se persiste en Zustand en `frontend/src/store/authStore.js`
- `ObjectMetadataContext` solo carga metadata si hay token y el usuario es admin

## Deploy e integracion

El repo parece preparado para deploy en Netlify:

- `netlify.toml` compila el frontend desde `frontend/`
- publica `frontend/dist`
- usa funciones en `backend/src/functions`
- redirige `/api/*` hacia `/.netlify/functions/api/:splat`

Para local:

- frontend por Vite
- backend por Express tradicional

## Variables de entorno esperadas

### Backend

Segun `backend/.env.example`:

- `PORT`
- `NODE_ENV`
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `BOOTSTRAP_ADMIN_TOKEN`
- `CORS_ORIGIN`
- `FRONTEND_APP_URL`
- `PUBLIC_APP_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER`

### Frontend

Segun `frontend/.env.example`:

- `VITE_API_URL`

## Comandos utiles

### Repo root

- `npm test`
  Nota: hoy no sirve como entrypoint real; el root tiene un placeholder.

### Backend

- `cd backend && npm run dev`
- `cd backend && npm test`
- `cd backend && npm run install:suite`
- `cd backend && npm run migrate:legacy`
- `cd backend && npm run recalculate:rollups`
- `cd backend && npm run enrich:products`

Tambien hay muchos scripts de sync/backfill/report metadata en `backend/src/scripts/`.

### Frontend

- `cd frontend && npm run dev`
- `cd frontend && npm run build`
- `cd frontend && npm run lint`

## Pruebas que ya existen

El backend tiene un runner custom en `backend/test/run.js`.

Cubre al menos:

- trigger motor
- automation flows
- custom record query/service
- quote conversion
- rollups
- supplier catalog
- client summary
- sale payment summary
- sales payment highlights
- price review report

No vi un setup fuerte de pruebas en frontend.

## Archivos donde empezar segun tarea

Si la tarea es de UI o rutas:

- `frontend/src/App.jsx`
- `frontend/src/pages/`
- `frontend/src/components/`

Si la tarea es de objetos dinamicos:

- `backend/src/models/CustomObject.js`
- `backend/src/models/CustomRecord.js`
- `backend/src/services/customObjectService.js`
- `backend/src/services/customRecordService.js`
- `frontend/src/context/ObjectMetadataContext.jsx`

Si la tarea es de automatizaciones:

- `backend/src/services/triggerMotor.js`
- `backend/src/services/triggersEngine.js`
- `backend/src/services/automationFlowService.js`

Si la tarea es de catalogo/storefront:

- `backend/src/routes/productRoutes.js`
- `backend/src/controllers/productController.js`
- `frontend/src/pages/Home.jsx`
- `frontend/src/pages/ProductDetailPage.jsx`
- `frontend/src/components/ProductCard.jsx`

Si la tarea es de ventas/pagos/reportes:

- `backend/src/data/suites.js`
- `backend/src/services/salePaymentSummaryService.js`
- `backend/src/services/salesPaymentHighlightService.js`
- `backend/src/services/priceReviewReportService.js`
- `backend/src/controllers/reportController.js`

## Riesgos o detalles para recordar

- El repo mezcla ecommerce visible con un backend meta-programable bastante amplio.
- Mucha logica de negocio puede venir desde metadata, no solo desde codigo fijo.
- `backend/src/data/suites.js` es enorme y parece ser una fuente importante de verdad del dominio.
- Hay scripts operativos y migraciones que probablemente modifican datos reales; conviene revisar bien antes de ejecutarlos.
- El root `package.json` no representa bien el flujo real del proyecto; casi todo vive en `frontend/` y `backend/`.

## Regla practica para retomar rapido

Cuando vuelvas a entrar a este repo:

1. Mira `frontend/src/App.jsx` para ubicar las vistas.
2. Mira `backend/src/app.js` para ubicar las APIs.
3. Si algo parece "magico", casi seguro viene de `CustomObject`, `CustomRecord` o `suites.js`.
4. Si afecta precios, pagos, ventas o cotizaciones, revisa tambien triggers/flows.
5. Si afecta layout o formularios admin, revisa metadata antes de cambiar componentes a ciegas.

## Ultima actualizacion

Generado el 2026-05-08 durante una exploracion del repo local.
