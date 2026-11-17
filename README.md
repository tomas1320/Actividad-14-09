# Actividad 14-09 — Coworking XP API

Backend REST para consultar salas y administrar reservas de un espacio de coworking. La actividad aplica historias de usuario, BDD con Cucumber y prácticas de Extreme Programming (XP).

## Funcionalidades

- Registro de usuarios con contraseñas almacenadas mediante bcrypt.
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
npm run dev
```

La API queda disponible en `http://localhost:3000`. Para compilar y ejecutar la versión compilada:

```bash
npm run build
npm start
```

El puerto se puede cambiar con la variable de entorno `PORT`.

## Swagger

Con el servidor iniciado, abre `http://localhost:3000/api-docs` para explorar y probar interactivamente los endpoints. La especificación OpenAPI está disponible en `http://localhost:3000/api-docs.json` y se mantiene en [src/docs/openapi.ts](./src/docs/openapi.ts).

Swagger documenta los parámetros, cuerpos de solicitud, respuestas y códigos de error de todas las rutas de la API. En la UI se puede seleccionar **Try it out** para enviar solicitudes al servidor local.

## Endpoints

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/rooms` | Listar las salas |
| `GET` | `/rooms?date=2026-10-15&startTime=10:00&endTime=11:00` | Consultar disponibilidad |
| `POST` | `/users` | Registrar usuario (`name`, `email`, `password`) |
| `POST` | `/bookings` | Reservar (`userId`, `roomId`, `date`, `startTime`, `endTime`) |
| `POST` | `/bookings/:id/cancel` | Cancelar reserva (`userId`) |
| `GET` | `/users/:userId/bookings` | Listar las reservas de un usuario |

Ejemplo de registro:

```json
{
  "name": "Ana",
  "email": "ana@example.com",
  "password": "secret123"
}
```

Las contraseñas y sus hashes nunca se incluyen en las respuestas. Los errores usan JSON con `error` y `message`; los intervalos superpuestos responden `409`.

## Pruebas y calidad

```bash
npm run test:unit
npm run test:e2e
npm test
npm run lint
npm run build
```

- `tests/unit/`: pruebas directas de las reglas de negocio del servicio.
- `tests/integration/`: verificación HTTP de la especificación OpenAPI y Swagger UI.
- `features/`: seis historias funcionales en Gherkin, con escenarios felices y casos de error/límite.
- `tests/step_definitions/`: implementación TypeScript de los pasos Cucumber.
- `npm test`: ejecuta las pruebas unitarias/de integración y luego los escenarios BDD.

Se siguió el ciclo TDD/BDD: escribir las pruebas, observar RED antes de implementar el comportamiento y confirmar GREEN después. Actualmente `npm test` pasa 5 pruebas unitarias/de integración y 17 escenarios Cucumber (61 pasos).

## Integración continua

El workflow [.github/workflows/main.yml](./.github/workflows/main.yml) se ejecuta en cada push y pull request. Instala dependencias con `npm ci` y ejecuta ESLint, compilación TypeScript y ambas suites de pruebas.

## Decisiones y límites del alcance

- La persistencia en memoria simplifica la actividad y se reinicia al reiniciar el proceso.
- Las salas de demostración se cargan al iniciar la aplicación.
- Los endpoints reciben `userId` directamente; no sustituyen un sistema de autenticación/autorización para producción.
- Se priorizó el diseño simple y el alcance académico: no se incorporaron base de datos ni servicios externos.
