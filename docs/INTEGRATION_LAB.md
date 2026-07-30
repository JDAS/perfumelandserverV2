# Vitra Integration Lab

API temporal para probar integraciones donde Salesforce actua como cliente HTTP.
El laboratorio esta deshabilitado por defecto y no utiliza objetos dinamicos ni
colecciones operativas de Perfumeland.

## Seguridad y ciclo de vida

- Activar solamente con `INTEGRATION_LAB_ENABLED=true`.
- Usar secretos temporales distintos a JWT, usuarios y credenciales de Vitra.
- Los escenarios y sus intentos viven en colecciones dedicadas:
  `integration_lab_scenarios` e `integration_lab_attempts`.
- Todos los registros tienen vencimiento TTL. El valor predeterminado es 7 dias.
- Solo se conservan headers no sensibles; nunca se persisten Authorization,
  API keys, firmas ni secretos.
- Al terminar las pruebas, establecer `INTEGRATION_LAB_ENABLED=false`.

## Flujo de una prueba de reintentos

1. Un administrador crea un escenario con `failFirst: 2`.
2. Salesforce hace el primer callout y recibe, por ejemplo, HTTP 503.
3. El framework de integracion de Salesforce agenda el reproceso.
4. El segundo intento vuelve a recibir HTTP 503.
5. El tercer intento recibe HTTP 200.
6. Se consulta el historial para validar tres llamadas, sus IDs y sus estados.

El laboratorio no reintenta nada por Salesforce. Solo produce respuestas
deterministas y registra los intentos. El mecanismo de retry debe pertenecer al
framework de Salesforce que se esta validando.

## Variables requeridas

Ver `backend/.env.example`. Como minimo:

```text
INTEGRATION_LAB_ENABLED=true
INTEGRATION_LAB_ADMIN_KEY=...
INTEGRATION_LAB_BASIC_USER=...
INTEGRATION_LAB_BASIC_PASSWORD=...
INTEGRATION_LAB_BEARER_TOKEN=...
INTEGRATION_LAB_API_KEY=...
INTEGRATION_LAB_OAUTH_CLIENT_ID=...
INTEGRATION_LAB_OAUTH_CLIENT_SECRET=...
INTEGRATION_LAB_OAUTH_JWT_SECRET=...
INTEGRATION_LAB_HMAC_SECRET=...
```

Si el secreto de un modo no esta configurado, ese modo nunca autentica.

## Endpoints administrativos

Todos requieren `X-Lab-Admin-Key`.

### Crear o reemplazar escenario

```http
PUT /api/integration-lab/scenarios/retry-503
X-Lab-Admin-Key: <admin-key>
Content-Type: application/json

{
  "description": "Falla dos veces y luego acepta",
  "acceptedMethods": ["POST", "GET"],
  "failFirst": 2,
  "failureStatus": 503,
  "successStatus": 200,
  "ttlHours": 24,
  "responseBody": {
    "externalId": "accepted-by-vitra"
  }
}
```

Actualizar la configuracion no reinicia el contador. Para reiniciarlo:

```http
POST /api/integration-lab/scenarios/retry-503/reset
X-Lab-Admin-Key: <admin-key>
```

Consultar escenarios e intentos:

```http
GET /api/integration-lab/scenarios
GET /api/integration-lab/scenarios/retry-503/attempts
X-Lab-Admin-Key: <admin-key>
```

## Endpoint de ejercicio

Acepta `GET`, `POST`, `PUT`, `PATCH` y `DELETE`:

```text
/api/integration-lab/auth/{modo}/exercise/{scenarioKey}
```

Modos soportados:

### Basic

```http
POST /api/integration-lab/auth/basic/exercise/retry-503
Authorization: Basic base64(usuario:password)
X-Request-Id: SF-0001
```

### Bearer estatico

```http
POST /api/integration-lab/auth/bearer/exercise/retry-503
Authorization: Bearer <INTEGRATION_LAB_BEARER_TOKEN>
X-Request-Id: SF-0001
```

### API Key

```http
GET /api/integration-lab/auth/api-key/exercise/retry-503?id=001
X-API-Key: <INTEGRATION_LAB_API_KEY>
X-Request-Id: SF-0001
```

### OAuth 2.0 Client Credentials

Solicitar token:

```http
POST /api/integration-lab/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&
client_id=<client-id>&
client_secret=<client-secret>
```

Tambien se acepta el client ID y secret mediante HTTP Basic. El access token dura
10 minutos.

Usar token:

```http
PATCH /api/integration-lab/auth/oauth2/exercise/retry-503
Authorization: Bearer <access_token>
X-Request-Id: SF-0001
Content-Type: application/json

{"salesforceId":"001...","status":"Ready"}
```

### HMAC SHA-256

Headers:

```text
X-Timestamp: milisegundos Unix
X-Signature: sha256=<hex>
```

Cadena exacta a firmar:

```text
timestamp.METHOD./api/integration-lab/auth/hmac/exercise/{key}.JSON_BODY
```

La ventana permitida es de 5 minutos. Para GET sin body, `JSON_BODY` es `null`.

## Respuesta de fallo intencional

```json
{
  "ok": false,
  "intentionalFailure": true,
  "scenario": "retry-503",
  "requestId": "SF-0001",
  "attempt": 1,
  "failFirst": 2,
  "error": "Fallo intencional 1/2"
}
```

La respuesta exitosa incluye `ok: true`, el numero de intento y el payload
recibido. Se recomienda que Salesforce envie el mismo `X-Request-Id` o
`X-Correlation-Id` durante todos los reprocesos.

## Configuracion sugerida en Salesforce

Usar Named Credentials y External Credentials actuales, no Legacy Named
Credentials. Crear una Named Credential distinta por modo de autenticacion o
utilizar custom headers donde corresponda.

La URL base es:

```text
https://<sitio>/api/integration-lab
```

Para comprobar retries, el codigo de Salesforce debe tratar los estados
configurados como recuperables, incrementar su propio contador, aplicar backoff y
conservar el mismo identificador de correlacion.

## Fuera del alcance inicial

- Mutual TLS, porque se configura en la capa TLS/proxy y no en Express.
- AWS Signature v4.
- OAuth JWT Bearer con certificados de cliente.
- SOAP.

Estos modos se pueden agregar si forman parte de los criterios concretos de la
prueba.
