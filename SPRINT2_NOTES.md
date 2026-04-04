# Sprint 2 aplicado

## Cambios principales

- Se creó `backend/src/services/recordValidationService.js`
- Se centralizó create/update en `saveRecord()` dentro de `backend/src/services/customRecordService.js`
- `customRecordController` ahora usa el pipeline central para create/update

## Qué hace el nuevo pipeline

1. Carga metadata del objeto.
2. Valida si el objeto existe.
3. Bloquea escritura en campos reservados (`_id`, `createdAt`, `updatedAt`, `__v`).
4. Bloquea escritura directa en campos `formula` y `rollup`.
5. Rechaza campos que no estén definidos en metadata.
6. Hace casteo por tipo (`number`, `boolean`, `date`, etc.).
7. Valida `required`, `select`, `email`, `url` y `lookup`.
8. Aplica fórmulas antes de persistir.
9. Recalcula rollups padre afectados.

## Respuesta nueva de create/update

Las rutas de create/update ahora responden:

```json
{
  "record": { "...": "..." },
  "blockedFields": ["campoFormula"]
}
```

Si hay error de validación, la API responde `400` con `details`.
