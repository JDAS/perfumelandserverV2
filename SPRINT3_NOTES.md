# Sprint 3 - Formula Engine v2

## Incluye
- Parser seguro de fórmulas sin `new Function`
- Evaluador controlado con funciones permitidas
- Detección de dependencias entre campos fórmula
- Detección de ciclos
- Validación de referencias a campos inexistentes
- Integración de validación de fórmulas al crear/editar objetos
- Aplicación de fórmulas en orden topológico

## Funciones soportadas
- IF
- AND
- OR
- NOT
- ISBLANK
- ROUND
- TEXT
- VALUE
- CONCAT
- TODAY
- NOW

## Operadores soportados
- `+ - * /`
- `= == != > < >= <=`
- `AND OR`
- `&& ||`
- paréntesis

## Archivos nuevos
- `backend/src/services/formulaParser.js`
- `backend/src/services/formulaEvaluator.js`
- `backend/src/services/formulaValidator.js`
- `backend/src/services/dependencyService.js`
- `backend/src/services/formulaEngine.js`

## Archivos actualizados
- `backend/src/utils/formulaEngine.js`
- `backend/src/utils/objectMetadata.js`

## Notas
- La evaluación ya no ejecuta código arbitrario.
- Si una fórmula tiene error en metadata, ahora se bloquea al guardar el objeto.
- Si una fórmula falla en tiempo de cálculo, el campo queda en `null`.
