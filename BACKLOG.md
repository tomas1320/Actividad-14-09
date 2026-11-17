# Backlog del producto: Coworking XP API

## Historias funcionales

### HU-01 — Registrar usuario
Como visitante, quiero crear una cuenta para poder reservar salas.

Criterios de aceptación:
1. Con nombre, email válido y contraseña, la API crea la cuenta y devuelve `201` con los datos públicos.
2. La contraseña se almacena con bcrypt y nunca aparece en la respuesta.
3. Un email ya registrado devuelve `409` sin crear otra cuenta.

### HU-02 — Consultar disponibilidad
Como usuario, quiero consultar las salas disponibles en una fecha y horario para elegir dónde trabajar.

Criterios de aceptación:
1. Una consulta válida devuelve las salas sin reservas confirmadas que se solapen con el horario.
2. Una sala ocupada durante el intervalo solicitado queda excluida.
3. Fechas u horarios inválidos devuelven `400`.

### HU-03 — Crear una reserva
Como usuario registrado, quiero reservar una sala disponible para asegurar un espacio de trabajo.

Criterios de aceptación:
1. Una reserva válida de una sala libre se crea como `CONFIRMED` y devuelve `201`.
2. Una reserva para un usuario o sala inexistente devuelve `404`.
3. El intervalo debe tener fecha y horas válidas, y la hora final debe ser posterior a la inicial; de lo contrario devuelve `400`.

### HU-04 — Evitar reservas superpuestas
Como usuario, quiero que el sistema impida reservas simultáneas de la misma sala para evitar conflictos.

Criterios de aceptación:
1. Una reserva que se solapa con otra confirmada de la misma sala y fecha devuelve `409`.
2. Las reservas en salas distintas no se bloquean entre sí.
3. Los intervalos contiguos (por ejemplo, 10:00–11:00 y 11:00–12:00) se permiten.

### HU-05 — Cancelar una reserva
Como titular de una reserva, quiero cancelarla para liberar la sala si ya no la necesito.

Criterios de aceptación:
1. El titular puede cancelar una reserva confirmada y recibe el estado `CANCELLED`.
2. Una reserva cancelada deja de bloquear disponibilidad.
3. Una reserva inexistente o perteneciente a otra persona devuelve `404`.

### HU-06 — Consultar mis reservas
Como usuario registrado, quiero ver mis reservas para organizar mi agenda.

Criterios de aceptación:
1. La API devuelve las reservas del usuario solicitado, incluidas sus fechas, sala y estado.
2. Un usuario sin reservas recibe una lista vacía.
3. Un usuario inexistente devuelve `404`.

## Historias técnicas / requisitos no funcionales

### HT-01 — Proteger credenciales
Como auditor de seguridad, quiero que las contraseñas se almacenen con bcrypt y que las respuestas públicas no expongan secretos para reducir el impacto de una filtración.

Criterios de aceptación:
1. Las contraseñas se hashean con bcrypt y costo 12; ninguna se persiste en texto plano.
2. Ninguna respuesta de la API incluye la contraseña ni su hash.
3. La validación rechaza campos requeridos inválidos con errores controlados, sin filtrar detalles internos.

### HT-02 — Mantener arquitectura y calidad
Como equipo de desarrollo, quiero capas separadas y validaciones automáticas para poder modificar el sistema con bajo riesgo.

Criterios de aceptación:
1. Rutas/controladores, lógica de negocio y acceso a datos se mantienen separados.
2. TypeScript se compila en modo estricto.
3. Cada push y pull request ejecuta lint, compilación y escenarios Cucumber en CI.

### HT-03 — Autenticar y autorizar solicitudes
Como usuario, quiero autenticarme con tokens de vida limitada y permisos por rol para que solo las personas autorizadas puedan acceder a mis reservas.

Criterios de aceptación:
1. El login valida la contraseña bcrypt y entrega un access JWT HS256 de 15 minutos y un refresh token aleatorio válido por siete días; solo se guarda el hash del refresh token.
2. Renovar consume el refresh token anterior y entrega uno nuevo; cerrar sesión lo revoca, y un token consumido, revocado o expirado se rechaza.
3. Las rutas privadas rechazan tokens faltantes, inválidos o expirados; los errores de login no revelan si el email está registrado.
4. El registro siempre asigna `USER`; `USER` accede a sus reservas, `EDITOR` puede leer reservas globales y `ADMIN` puede operar globalmente.

### HT-04 — Endurecer el perímetro de la API
Como responsable de seguridad, quiero limitar intentos de login y restringir los orígenes web permitidos para reducir abuso y exposición de credenciales.

Criterios de aceptación:
1. El login permite como máximo cinco intentos fallidos por IP en 15 minutos y luego responde `429`; los logins exitosos no incrementan el límite.
2. CORS permite solo orígenes explícitos, rechaza `*`, y en producción exige una lista de orígenes HTTPS.
3. La suite HTTP demuestra rechazo de tokens expirados y acceso de un usuario a reservas ajenas; el smoke test cURL cubre este último caso.

## Decisiones de alcance

- La persistencia es en memoria y se reinicia al reiniciar el proceso; sirve para el alcance académico y puede reemplazarse por un repositorio persistente.
- Las salas de demostración se cargan al iniciar la aplicación.
- La identidad de las operaciones privadas proviene del JWT, no de un `userId` proporcionado en el cuerpo.
- El almacenamiento en memoria del limiter y refresh tokens es para la actividad; un despliegue multi-instancia requiere stores compartidos.
- El registro público siempre crea `USER`; la asignación de `EDITOR`/`ADMIN` requiere aprovisionamiento confiable fuera de la API pública.
- Se aplica TDD/BDD: escenarios primero, confirmación de RED, implementación mínima y ejecución en GREEN.
