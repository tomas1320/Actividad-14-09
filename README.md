# Actividad 14-09 — Coworking XP API

Backend REST para consultar salas y administrar reservas de un espacio de coworking. La actividad aplica historias de usuario, BDD con Cucumber y prácticas de Extreme Programming (XP).

## Funcionalidades

- Registro de usuarios con contraseñas almacenadas mediante bcrypt.
- Autenticación con access JWT de 15 minutos y refresh tokens opacos de un solo uso, rotados y revocables.
- Autorización por roles: `USER`, `EDITOR` y `ADMIN`.
- Endpoints de renovación y cierre de sesión; el servidor persiste únicamente hashes SHA-256 de refresh tokens.
- Límite de cinco intentos fallidos de login por IP cada 15 minutos.
- CORS mediante allowlist explícita; producción requiere orígenes HTTPS configurados.
- Consulta de salas y disponibilidad por fecha y horario.
- Creación de reservas con validación de intervalos y prevención de solapamientos.
- Cancelación de reservas y consulta de reservas por usuario.
- Errores HTTP controlados para datos inválidos, recursos inexistentes y conflictos.
- Documentación OpenAPI 3 y Swagger UI para explorar y probar los endpoints.

El backlog con historias funcionales, requisitos técnicos y criterios de aceptación está en [BACKLOG.md](./BACKLOG.md).

## Tecnologías y arquitectura

- Node.js 22+, TypeScript en modo estricto y Express.
- Cucumber para escenarios BDD, Node.js Test Runner y Supertest para pruebas unitarias/de integración.
- Swagger UI Express para documentación interactiva.
- Repositorio en memoria implementado detrás de una interfaz para separar acceso a datos.
- Rutas y controladores HTTP, lógica de negocio en servicios, y almacenamiento en repositorios.
- Resolución de módulos TypeScript `Node16`; al no declarar `"type": "module"`, la salida sigue siendo CommonJS.

## Requisitos

- Node.js 22 o superior
- npm

## Instalación y ejecución

```bash
npm ci
export JWT_SECRET="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))')"
npm run dev
```

En PowerShell, configura el secreto antes de iniciar la API:

```powershell
$env:JWT_SECRET = node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
npm run dev
```

`JWT_SECRET` debe tener al menos 32 bytes. No lo guardes en el repositorio ni lo compartas; la aplicación falla al iniciar si falta o es demasiado corto.

En desarrollo, CORS permite `http://localhost:3000` y `http://127.0.0.1:3000` por defecto. En producción, configura una lista separada por comas de orígenes HTTPS antes de iniciar:

```powershell
$env:NODE_ENV = "production"
$env:CORS_ALLOWED_ORIGINS = "https://app.example.com"
```

La API debe servirse detrás de HTTPS en producción (por ejemplo, mediante un proxy inverso). No uses `*` en la allowlist. La API queda disponible en `http://localhost:3000` durante el desarrollo local. Para compilar y ejecutar la versión compilada:

```bash
npm run build
npm start
```

El puerto se puede cambiar con la variable de entorno `PORT`.

## Swagger

Con el servidor iniciado, abre `http://localhost:3000/api-docs` para explorar y probar interactivamente los endpoints. Usa **Authorize** en Swagger UI para pegar el JWT como Bearer token. La especificación OpenAPI está disponible en `http://localhost:3000/api-docs.json` y se mantiene en [src/docs/openapi.ts](./src/docs/openapi.ts).

Swagger documenta los parámetros, cuerpos de solicitud, respuestas y códigos de error de todas las rutas de la API. En la UI se puede seleccionar **Try it out** para enviar solicitudes al servidor local.

## Pruebas con cURL

Con la API iniciada en una terminal, ejecuta desde otra:

```powershell
npm run test:api
```

El script `scripts/curl-smoke-test.ps1` usa `curl.exe` para probar registro, login, rotación y revocación de refresh tokens, perfil, RBAC, creación/listado/cancelación de reservas, liberación de disponibilidad y el rechazo de acceso a las reservas de otro usuario (IDOR). Usa emails aleatorios en cada ejecución. Si el servidor está en otra dirección, configura `API_BASE_URL`, por ejemplo `$env:API_BASE_URL = "http://localhost:3001"`.

## Endpoints

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/rooms` | Listar las salas |
| `GET` | `/rooms?date=2026-10-15&startTime=10:00&endTime=11:00` | Consultar disponibilidad |
| `POST` | `/users` | Registrar usuario (`name`, `email`, `password`); siempre crea rol `USER` |
| `POST` | `/auth/login` | Iniciar sesión y recibir `{ accessToken, refreshToken, tokenType, expiresIn, user }` |
| `POST` | `/auth/refresh` | Rotar refresh token y recibir un nuevo par de tokens |
| `POST` | `/auth/logout` | Revocar un refresh token |
| `GET` | `/auth/profile` | Ver perfil (JWT requerido) |
| `POST` | `/bookings` | Reservar (`roomId`, `date`, `startTime`, `endTime`); el titular se obtiene del JWT |
| `POST` | `/bookings/:id/cancel` | Cancelar reserva propia; `ADMIN` puede cancelar cualquiera |
| `GET` | `/users/:userId/bookings` | Listar propias reservas; `EDITOR` y `ADMIN` pueden consultar a otros |
| `GET` | `/management/bookings` | Listar todas las reservas (`EDITOR` o `ADMIN`) |

Ejemplo de registro:

```json
{
  "name": "Ana",
  "email": "ana@example.com",
  "password": "secret123"
}
```

Las contraseñas y sus hashes nunca se incluyen en las respuestas. Los errores usan JSON con `error` y `message`; los intervalos superpuestos responden `409`.

## Autenticación y autorización

Registro e inicio de sesión son públicos; también lo es la consulta de salas. Las demás rutas protegidas requieren `Authorization: Bearer <accessToken>`. El access token se firma con HS256 y expira en 15 minutos. El refresh token aleatorio expira en siete días, se almacena como hash SHA-256, solo puede utilizarse una vez y se revoca al rotarlo o cerrar sesión. Una contraseña incorrecta cuenta para el límite de cinco intentos de login por IP durante 15 minutos; los logins exitosos no cuentan. Los intentos excedentes reciben `429`.

La identidad para reservar y cancelar se obtiene del JWT, nunca de un `userId` enviado por el cliente. Un usuario que intente consultar las reservas de otra persona recibe `404`, evitando revelar si el recurso existe. JWT_SECRET debe ser secreto y tener al menos 32 bytes.

| Rol | Permisos |
| --- | --- |
| `USER` | Crear reservas y consultar/cancelar las propias |
| `EDITOR` | Permisos de usuario y lectura de reservas globales |
| `ADMIN` | Permisos globales, incluida la cancelación de reservas de otros usuarios |

El registro ignora cualquier rol enviado en el cuerpo y asigna `USER`. `EDITOR` y `ADMIN` deben otorgarse mediante un proceso de confianza (por ejemplo, una carga inicial o un mecanismo administrativo seguro); no existe un endpoint público para elevar privilegios. En esta versión en memoria, los roles elevados se aprovisionan en el repositorio y no persisten al reiniciar.

## Pruebas y calidad

```bash
npm run test:unit
npm run test:e2e
npm run test:api
npm test
npm run lint
npm run build
```

- `tests/unit/`: pruebas directas de las reglas de negocio del servicio.
- `tests/integration/`: verificación HTTP de JWT (incluida expiración), refresh/revocación, límite de login, CORS, RBAC, OpenAPI y Swagger UI.
- `features/`: historias funcionales y escenarios BDD de autenticación/autorización, con casos felices y de error/límite.
- `tests/step_definitions/`: implementación TypeScript de los pasos Cucumber.
- `npm test`: ejecuta las pruebas unitarias/de integración y luego los escenarios BDD.

Se sigue el ciclo TDD/BDD: escribir las pruebas, observar RED antes de implementar el comportamiento y confirmar GREEN después.

## Integración continua

El workflow [.github/workflows/main.yml](./.github/workflows/main.yml) se ejecuta en cada push y pull request. Instala dependencias con `npm ci` y ejecuta ESLint, compilación TypeScript y ambas suites de pruebas.

## Decisiones y límites del alcance

- La persistencia en memoria simplifica la actividad y se reinicia al reiniciar el proceso.
- Los refresh tokens y el limitador también son en memoria; en despliegues con varias instancias deben reemplazarse por almacenamiento compartido y un store distribuido.
- La aplicación valida orígenes CORS, pero el despliegue debe terminar TLS con HTTPS.
- Las salas de demostración se cargan al iniciar la aplicación.
- El registro público siempre crea `USER`; asignar `EDITOR` o `ADMIN` requiere aprovisionamiento de confianza.
- Se priorizó el diseño simple y el alcance académico: no se incorporaron base de datos ni servicios externos.
