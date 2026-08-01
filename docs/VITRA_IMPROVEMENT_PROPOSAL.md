# Propuesta de evolucion de Vitra

Fecha: 2026-07-31  
Estado: propuesta para revision  
Horizonte sugerido: 4 fases incrementales

## 1. Resumen ejecutivo

Vitra ya cuenta con un nucleo configurable potente: objetos dinamicos, layouts,
formulas, rollups, automatizaciones, reportes y dashboards. La recomendacion no
es ampliar indiscriminadamente el numero de modulos, sino fortalecer primero los
flujos que generan valor diario y la confiabilidad de la informacion financiera.

La propuesta prioriza dos resultados:

1. Que una persona pueda vender, cobrar y atender a un cliente completamente
   desde el telefono.
2. Que Vitra pueda explicar con precision cuanto se vendio, cuanto se cobro y
   cuanto se gano en cada operacion.

La incorporacion de Renacer se mantiene aislada y en descubrimiento hasta que
estos fundamentos sean suficientemente estables.

## 2. Principios de la propuesta

- Mobile first para tareas operativas, no para configuracion avanzada.
- Valores financieros historicos e inmutables en cada transaccion.
- Configuracion mediante metadata cuando el comportamiento sea reutilizable.
- Codigo especializado solamente para reglas que requieran consistencia fuerte.
- Ninguna cifra financiera sin formula documentada y posibilidad de auditoria.
- Entregas pequenas que puedan probarse en produccion sin reemplazos masivos.
- Perfumeland y Renacer no comparten datos, secretos ni bases de datos.

## 3. Fase 1: operacion movil completa

### Objetivo

Completar las tareas comerciales mas frecuentes sin utilizar las vistas de
escritorio.

### Alcance

#### Inicio movil

- Ventas recientes.
- Saldo pendiente visible.
- Accesos rapidos a venta, cobro, cliente y cotizacion.
- Indicador de cobros vencidos y proximos.
- Busqueda global por cliente, telefono o referencia de venta.

La primera version del inicio, ventas recientes y navegacion inferior ya esta
implementada localmente.

#### Nueva venta movil

Flujo propuesto:

```text
Cliente
  -> productos
  -> contado o credito
  -> descuento
  -> resumen
  -> pago inicial
  -> confirmacion
  -> WhatsApp
```

Capacidades:

- Buscar o crear cliente sin abandonar la venta.
- Buscar productos por nombre, marca o SKU.
- Mostrar disponibilidad antes de agregar.
- Editar cantidades y eliminar lineas facilmente.
- Aplicar precios de contado o credito usando las reglas actuales.
- Mostrar costo faltante al usuario autorizado.
- Configurar cuotas y primer pago.
- Vista previa antes de confirmar.
- Evitar envios duplicados al tocar varias veces el boton.
- Abrir el registro creado y compartir resumen por WhatsApp.

#### Cobros

- Bandeja de vencidos.
- Bandeja de proximos pagos.
- Filtros por vendedor y fecha.
- Registro rapido de pago total o parcial.
- Confirmacion posterior con saldo actualizado.
- Historial reciente de pagos.
- Copia o envio de comprobante.

### Fuera del alcance

- Edicion de metadata desde telefono.
- Builders de reportes, layouts o flows.
- Operacion sin conexion en la primera entrega.
- Aplicacion nativa para iOS o Android.

### Criterios de aceptacion

- Crear una venta completa en un telefono sin abrir el formulario generico.
- Registrar el primer pago dentro del mismo flujo.
- El costo historico queda capturado en cada linea vendida.
- Doble toque o reintento de red no crea ventas duplicadas.
- Inventario, rollups, pagos y comisiones quedan sincronizados.
- El resumen del cliente refleja los valores finales.
- Interfaz util desde 360 px de ancho.
- Acciones principales tienen objetivos tactiles de al menos 44 px.

### Entregables

- Flujo de venta movil.
- Busqueda movil de clientes y productos.
- Bandeja de cobros.
- Confirmacion y comprobante.
- Pruebas de los recorridos criticos.
- Guia corta para usuarios.

## 4. Fase 2: confianza financiera

### Objetivo

Convertir cada venta en una fuente financiera explicable y auditable.

### Modelo de calculo

```text
ingreso_neto = suma(linea.total)

costo_historico = suma(linea.cost_snapshot * linea.quantity)

ganancia_bruta = ingreso_con_costo_conocido - costo_historico

ganancia_esperada = ganancia_bruta - comision_generada

saldo_pendiente = total_venta - total_pagado
```

La ganancia cobrada debe reportarse separadamente. No debe confundirse efectivo
recibido con rentabilidad final.

### Alcance

- Garantizar `cost_snapshot` al crear cada `sale_item`.
- Advertir o bloquear la confirmacion si falta costo, segun permiso.
- Campos derivados de ganancia por venta.
- Comisiones generadas y pagadas claramente separadas.
- Cobertura de costos visible en reportes.
- Motivo y usuario para descuentos extraordinarios.
- Tratamiento consistente de anulaciones y devoluciones.
- Diagnostico de ventas historicas sin costo.
- Backfill simulado antes de cualquier correccion historica.

### Criterios de aceptacion

- Toda venta nueva tiene 100% de cobertura de costos o una excepcion auditada.
- El total de venta coincide con la suma de lineas despues de descuentos.
- Ganancia esperada descuenta la comision generada una sola vez.
- Una anulacion excluye correctamente venta, costo y comision de los reportes.
- Cada KPI permite identificar los registros que lo componen.

### Entregables

- Validador financiero en venta.
- Resumen financiero por venta.
- Reportes de excepciones.
- Herramienta de diagnostico historico.
- Pruebas de formulas y casos limite.
- Diccionario de metricas financieras.

## 5. Fase 3: gobierno y confiabilidad

### Objetivo

Hacer visibles y controlables los efectos automaticos de Vitra.

### Auditoria

Registrar:

- Correlation ID de la operacion.
- Usuario y origen.
- Objeto y registro.
- Trigger o flow ejecutado.
- Valores anteriores y posteriores.
- Duracion.
- Resultado o error.
- Numero de intento si hubo reproceso.

### Consistencia

- Idempotencia para ventas, pagos e integraciones.
- Transacciones MongoDB en operaciones compatibles.
- Estados `pending`, `processing`, `completed` y `failed` en procesos largos.
- Reconciliacion de inventario, pagos, campañas y rollups.
- Reintentos solo para errores recuperables.

### Permisos

Roles iniciales:

- Administrador de plataforma.
- Gerencia.
- Vendedor.
- Cobrador.
- Inventario.
- Solo lectura.

Controles por objeto, accion y campos sensibles. Costos y ganancias deben poder
ocultarse a perfiles no autorizados.

### Criterios de aceptacion

- Toda automatizacion financiera deja rastro consultable.
- Un pago reprocesado con el mismo identificador no se duplica.
- Los vendedores no ven informacion fuera de su alcance.
- Existe una vista operativa para errores y reconciliaciones pendientes.

## 6. Fase 4: Vitra como producto multiempresa

### Objetivo

Preparar Vitra para Perfumeland, Renacer y futuros clientes sin mezclar reglas ni
datos.

### Arquitectura

```text
Vitra Core
|- metadata y registros
|- automatizaciones
|- permisos y auditoria
|- reportes y dashboards
`- integraciones

Suites
|- Perfumeland
`- Renacer

Instancias
|- deployment + DB Perfumeland
`- deployment + DB Renacer
```

### Alcance

- Manifiesto de instancia.
- Branding configurable.
- Suites versionadas.
- Instalador con simulacion y confirmacion explicita.
- Guardas contra una base destino equivocada.
- Administrador inicial seguro.
- Migraciones con conteos de control.
- Version de metadata instalada por cliente.

### Renacer

Renacer permanece en estado `discovery`. No se instalara `commerce-ops` completa
hasta documentar productos, inventario, ventas, credito, pagos, usuarios y
reportes necesarios.

## 7. Trabajo transversal

### Pruebas

- Unitarias para calculos y validaciones.
- Integracion para venta, pago e inventario.
- Componentes para formularios dinamicos.
- End-to-end para venta movil y cobro.
- Pruebas en dispositivos reales.
- Pruebas con red lenta y reenvios.

### Rendimiento

- Indices para busqueda movil.
- Paginacion obligatoria.
- Agregaciones MongoDB para reportes grandes.
- Evitar cargar colecciones completas en memoria.
- Medicion de tiempos de triggers y endpoints.

### Seguridad

- Secretos exclusivos por instancia.
- Rate limits en autenticacion e integraciones.
- Redaccion de datos sensibles en logs.
- Laboratorios temporales deshabilitados al finalizar.
- Dependencias y permisos revisados antes de cada release importante.

## 8. Orden recomendado de entregas

### Entrega A: base movil

- Inicio movil ya implementado.
- Busqueda de cliente y venta.
- Bandeja de cobros.

### Entrega B: venta movil

- Carrito operativo.
- Precios y descuentos.
- Credito y primer pago.
- Confirmacion y WhatsApp.

### Entrega C: integridad financiera

- Costo obligatorio o excepcion.
- Ganancia por venta.
- Comisiones y anulaciones.
- Reporte de datos incompletos.

### Entrega D: auditoria y permisos

- Bitacora de automatizaciones.
- Idempotencia.
- Roles iniciales.

### Entrega E: Renacer

- Descubrimiento cerrado.
- Suite aprobada.
- Instancia y base independientes.
- Migracion y validacion.

## 9. Decisiones requeridas

Antes de implementar la venta movil se deben aprobar estas reglas:

1. Puede confirmarse una venta si el producto no tiene costo?
2. Quien puede autorizar descuentos y existe un limite?
3. Puede venderse sin inventario disponible?
4. Puede crearse un cliente solo con nombre o se exige telefono?
5. El primer pago es obligatorio en ventas a credito?
6. Se permite distribuir un pago entre varias cuotas?
7. Que sucede con costo y comision al anular una venta?
8. Que perfiles pueden ver costo, margen y ganancia?

## 10. Indicadores de exito

- Porcentaje de ventas creadas desde movil.
- Tiempo promedio para crear una venta.
- Tiempo promedio para registrar un cobro.
- Porcentaje de ventas nuevas con costo completo.
- Diferencias encontradas en reconciliacion.
- Errores de automatizacion por cada cien operaciones.
- Pagos o ventas duplicados.
- Usuarios activos por rol.
- Incidencias reportadas despues de cada entrega.

## 11. Recomendacion de inicio

Comenzar con un prototipo navegable de la venta movil utilizando los objetos y
reglas actuales, sin escribir datos. Validar el recorrido con usuarios reales y
cerrar las ocho decisiones pendientes. Luego implementar persistencia e
integraciones en incrementos pequenos.

La primera meta concreta es:

> Crear una venta de contado o credito, registrar el primer pago y enviar el
> resumen al cliente desde un telefono, con costo historico e idempotencia.
