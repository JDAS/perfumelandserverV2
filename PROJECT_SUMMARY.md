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

## Dashboard de campanas

En julio de 2026 se incorporo un reporte especializado y un dashboard para analizar
el rendimiento financiero y operativo de las campanas.

Archivos principales:

- `backend/src/services/campaignPerformanceService.js`
- `backend/src/scripts/syncCampaignDashboard.js`
- `backend/test/campaignPerformanceService.test.js`
- `frontend/src/components/admin/DashboardRenderer.jsx`

Definiciones instaladas en MongoDB:

- reporte `campaign_performance`
- dashboard `campaign_overview`, visible como `Campañas Perfumeland`

El dashboard cruza:

- `campaign`
- `campaign_sale_link`
- `campaign_participant`
- `campaign_entry`
- `sales`
- `sale_item`

Metricas principales:

- ventas unicas vinculadas
- ventas generadas
- dinero cobrado
- saldo pendiente
- costo conocido
- ganancia bruta
- comisiones generadas
- comisiones pagadas
- ganancia esperada
- margen bruto y esperado
- cobertura de costos
- participantes
- acciones asignadas y porcentaje de avance

### Reglas de calculo

Una venta puede tener varios registros en `campaign_sale_link` cuando participan
varios nombres. Los calculos financieros deben deduplicar por `sale_id` dentro de
cada campana.

La ganancia se calcula con valores historicos de los productos:

```text
ganancia_bruta =
  suma(sale_item.total) - suma(sale_item.cost_snapshot * sale_item.quantity)

ganancia_esperada =
  ganancia_bruta - suma(sales.commission_amount)
```

Para no sobreestimar la rentabilidad, la ganancia esperada descuenta todas las
comisiones generadas, incluso si `commission_paid` todavia es falso.

Tambien se informa `commission_paid` por separado.

Los productos sin `cost_snapshot` no deben asumir costo cero como si la ganancia
fuera definitiva. El dashboard calcula la ganancia sobre ingresos con costo
conocido y muestra `cost_coverage`.

### Ultima lectura de datos

Lectura realizada el 2026-07-22/23:

- 2 campanas
- 50 ventas unicas vinculadas
- 51 participantes
- 265 acciones asignadas
- CRC 1.794.000 vendidos
- CRC 1.330.500 cobrados
- CRC 463.500 pendientes
- CRC 537.250 de ganancia bruta conocida
- CRC 295.000 de comisiones generadas
- CRC 250.000 de comisiones pagadas
- CRC 242.250 de ganancia esperada
- 14,28% de margen esperado
- 94,54% de cobertura de costos

Por campana:

- Dia de la madre: CRC 87.000 de ganancia esperada
- Dia del padre: CRC 155.250 de ganancia esperada

Las cifras son dinamicas y deben consultarse nuevamente para conocer el estado
actual.

## Decisiones y principios para futuras tareas

- Tratar Vitra como una plataforma CRM/ERP configurable, no solo como ecommerce.
- Antes de crear una pantalla o regla fija, comprobar si corresponde a metadata.
- Mantener separado el nucleo generico de Vitra de las reglas de Perfumeland.
- En reportes financieros, deduplicar entidades y documentar claramente cada
  formula.
- Diferenciar ganancia bruta, ganancia esperada y dinero efectivamente cobrado.
- Usar costos historicos (`cost_snapshot`) y mostrar cobertura cuando falten.
- Considerar las comisiones generadas como obligacion aunque no esten pagadas.
- No ejecutar migraciones, backfills o scripts de escritura sin revisar su alcance.
- Una definicion nueva en MongoDB puede requerir tambien desplegar el backend que
  conoce su motor. Si la metadata se actualiza antes del codigo publicado, los
  widgets nuevos pueden aparecer en cero.

## Mejoras prioritarias identificadas

1. Completar y garantizar `cost_snapshot` en todas las ventas.
2. Agregar auditoria visible para triggers y automatizaciones.
3. Proteger operaciones compuestas con transacciones o idempotencia.
4. Incorporar permisos por objeto, campo, accion y propietario.
5. Versionar y publicar cambios de metadata de forma controlada.
6. Escalar reportes mediante agregaciones e indices.
7. Ampliar pruebas del frontend y de flujos financieros completos.
8. Definir la atribucion cuando dos campanas se superponen.

## Estado de validacion del dashboard

- Backend: 42 pruebas aprobadas.
- Frontend: build de produccion aprobado.
- La definicion del reporte y dashboard fue instalada en MongoDB.
- Los cambios de comisiones requieren un deploy posterior a su implementacion.

## Ultima actualizacion

Actualizado el 2026-07-22 durante la implementacion del dashboard de campanas y
la revision de las reglas de ganancia, costos y comisiones.

## Nueva instancia: Renacer

El 2026-07-24 se inicio el onboarding de una segunda empresa llamada Renacer.

Decision de arquitectura:

- compartir el codigo de Vitra
- usar deployment independiente
- usar base MongoDB independiente (`vitra_renacer`)
- usar usuarios, JWT, secretos y carpeta Cloudinary independientes
- no agregar datos de Renacer a las colecciones de Perfumeland

La estructura inicial esta en `instances/renacer/`. Su estado es `discovery`; no
se ha creado conexion, base, deploy, usuario, suite ni migracion. Antes de instalar
objetos se debe completar `instances/renacer/DISCOVERY.md` y decidir que modulos
de `commerce-ops` aplican realmente.

## Experiencia movil

El 2026-07-27 se inicio la reconstruccion funcional de `/admin/mobile`.

Primera etapa implementada:

- inicio operativo como pantalla predeterminada
- listado de las ocho ventas completadas mas recientes
- monto pendiente visible por venta
- acceso directo a registrar pago o abrir resumen
- acciones para nueva venta y nueva cotizacion
- venta seleccionada conservada entre secciones
- navegacion inferior persistente para uso con una mano
- soporte de `safe-area` para telefonos
- cabecera y espaciado de escritorio ocultos en movil
- refresco de ventas despues de registrar un pago

Archivos principales:

- `frontend/src/pages/MobileOpsPage.jsx`
- `frontend/src/layouts/AdminLayout.jsx`

Validacion inicial:

- `npm run lint`: aprobado
- `npm run build`: aprobado

Siguientes etapas sugeridas:

1. formulario de venta verdaderamente movil, sin salir al formulario generico
2. busqueda dedicada por cliente, telefono o saldo
3. bandeja de cobros vencidos y proximos
4. historial y comprobante despues de registrar pago
5. pruebas en dispositivos y anchos reales

## Laboratorio temporal de integraciones

El 2026-07-29 se agrego una API temporal para probar frameworks de integracion
donde Salesforce envia o consulta datos.

Ruta base:

- `/api/integration-lab`

Caracteristicas:

- deshabilitada por defecto mediante `INTEGRATION_LAB_ENABLED=false`
- autenticacion Basic, Bearer estatico, API Key, OAuth 2.0 Client Credentials y HMAC
- metodos GET, POST, PUT, PATCH y DELETE
- escenarios configurables que fallan las primeras N llamadas
- codigos de error configurables, incluyendo 429 y 5xx
- contador persistente para validar reprocesos en ambientes serverless
- historial temporal con request/correlation ID
- TTL para eliminar automaticamente escenarios e intentos
- colecciones dedicadas, sin usar objetos de negocio

Archivos clave:

- `docs/INTEGRATION_LAB.md`
- `backend/src/routes/integrationLabRoutes.js`
- `backend/src/controllers/integrationLabController.js`
- `backend/src/services/integrationLabService.js`
- `backend/src/models/IntegrationLabScenario.js`
- `backend/src/models/IntegrationLabAttempt.js`

Salesforce es responsable de implementar el retry. El laboratorio solamente
responde con fallos deterministas y registra si Salesforce reenvio la solicitud.

Pruebas publicas realizadas el 2026-07-30 en
`https://perfumelandweb.netlify.app/api/integration-lab`:

- health: 200
- administracion anonima: 401
- credenciales invalidas para todos los modos: 401
- API Key valida: 503, 503 y 200 en tres intentos
- historial persistido: tres intentos con el mismo `X-Request-Id`
- Basic valido: 200
- Bearer estatico valido: 200
- OAuth 2.0 Client Credentials: token emitido y callout 200
- HMAC positivo pendiente porque falta `INTEGRATION_LAB_HMAC_SECRET` en el `.env`
  local

Los escenarios `salesforce-retry-test` y `auth-smoke-test` fueron creados con TTL
de una hora y se eliminan automaticamente.

## Propuesta de evolucion

El 2026-07-31 se documento una propuesta formal en
`docs/VITRA_IMPROVEMENT_PROPOSAL.md`.

Orden recomendado:

1. operacion y venta movil completa
2. integridad financiera y costo historico
3. auditoria, idempotencia y permisos
4. producto multiempresa y onboarding de Renacer

La meta inicial propuesta es crear una venta de contado o credito, registrar el
primer pago y enviar el resumen desde un telefono, con costo historico e
idempotencia.

## Campanas agotadas y planes de pago

El 2026-07-31 se corrigio un bloqueo entre campañas y planes de pago.

Comportamiento anterior:

- si una campaña no tenia suficientes acciones, `campaignSyncService` lanzaba 400
- el error hacia parecer fallida la operacion y podia dejar una venta sin completar
  procesos posteriores

Comportamiento nuevo:

- asignar todas las acciones disponibles
- no bloquear venta ni plan de pago
- devolver `assignedEntryCount`, `unassignedEntryCount` y `assignmentPartial`
- agregar `unassignedEntries` al resumen de sincronizacion

Tambien se agrego una defensa para planes de pago:

- `sales.saledate` es obligatorio y tiene hoy como valor predeterminado
- si una venta historica no tiene fecha, el generador usa `createdAt`

Se reparo la venta `6a6d6f0fb47505395ea32acf` con fecha local 2026-07-31:

- plan generado: 4 cuotas por un total de CRC 55.000
- acciones deseadas: 5
- acciones disponibles y asignadas: 2 (`08` y `68`)
- vinculo de campaña creado

Validacion: 49 pruebas de backend aprobadas. El cambio de comportamiento requiere
deploy para aplicarse automaticamente a futuras operaciones; la metadata y la
venta indicada ya fueron actualizadas directamente.
