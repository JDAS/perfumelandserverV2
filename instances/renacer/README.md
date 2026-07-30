# Instancia Renacer

Renacer sera una instancia aislada de Vitra. Comparte el codigo de la plataforma,
pero no comparte base de datos, usuarios, archivos, secretos ni configuracion con
Perfumeland.

## Estado actual

`discovery`: estructura creada; no existe conexion, deploy, usuario, suite ni
migracion ejecutada.

## Limites de seguridad

- La base prevista es `vitra_renacer`.
- No usar la URI, nombre de base o secretos de Perfumeland.
- No copiar `backend/.env`.
- No ejecutar `install:suite` hasta aprobar los modulos requeridos.
- No importar datos sin simulacion, conteos de control y respaldo.
- Cloudinary debe usar como minimo la carpeta `renacer/attachments`.
- JWT y token de administrador deben ser exclusivos.

## Secuencia de incorporacion

1. Completar `DISCOVERY.md`.
2. Aprobar los modulos y reglas comerciales.
3. Crear MongoDB y credenciales exclusivas.
4. Crear un sitio Netlify separado usando este mismo repositorio.
5. Configurar las variables desde las plantillas.
6. Validar que la conexion resuelva exclusivamente `vitra_renacer`.
7. Instalar una suite de Renacer revisada.
8. Crear el administrador inicial.
9. Importar datos primero en modo simulacion.
10. Validar inventario, saldos, ventas, permisos y reportes.
11. Habilitar produccion.

## Archivos

- `instance.json`: manifiesto no secreto de la instancia.
- `backend.env.template`: variables esperadas del backend.
- `frontend.env.template`: variables esperadas del frontend.
- `DISCOVERY.md`: preguntas de levantamiento.

Las plantillas no son cargadas automaticamente por la aplicacion y, por tanto, no
pueden cambiar el comportamiento de Perfumeland.
