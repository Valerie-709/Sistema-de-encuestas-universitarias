# Survey System API

Backend inicial para un sistema de encuestas con Express, SQLite y control de acceso por roles.

## Ejecutar en desarrollo

Requiere Node.js 20 o superior.

```powershell
Copy-Item .env.example .env
```

Edita `.env` y cambia `ADMIN_PASSWORD` por una contraseña propia de al menos 12 caracteres. Luego ejecuta:

```powershell
npm install
npm run dev
```

El servidor queda disponible en `http://localhost:3000`. Comprueba que está activo en `http://localhost:3000/api/health`.
La base de datos se crea automáticamente en `data/surveys.sqlite`. El primer administrador se inicializa con
`ADMIN_USERNAME` y `ADMIN_PASSWORD`; cambiar esos valores después no modifica la cuenta ya creada.

## Ejecutar el frontend

En una segunda terminal, desde la carpeta del proyecto:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Abre la dirección que Vite muestra en la terminal, normalmente `http://localhost:5173`. Mantén en ejecución el backend en la primera terminal. El administrador inicia sesión para gestionar encuestas y respuestas; el estudiante abre el enlace individual de la encuesta y responde sin crear una cuenta. Para apuntar a otro backend, cambia `VITE_API_URL` en `frontend/.env`.

## Acceso a encuestas y privacidad

- El administrador inicia sesión con usuario y contraseña; solo él puede crear/publicar encuestas y consultar respuestas.
- Cada encuesta tiene un código y un enlace directo. El administrador publica la encuesta y comparte el enlace; no hace falta crear una cuenta de estudiante.
- El estudiante abre el enlace, ingresa su correo y responde. El correo se guarda para mostrarlo al administrador.
- Se permite una respuesta por correo y por encuesta. La misma dirección puede responder encuestas diferentes.
- Los envíos públicos están limitados a 30 intentos por dirección IP cada 15 minutos.
- Los códigos identifican encuestas publicadas; no son autenticación ni verifican la identidad real del estudiante.

## Rutas principales

| Método | Ruta | Acceso | Uso |
|---|---|---|---|
| `POST` | `/api/auth/admin/login` | Público | Iniciar sesión de administrador (`username`, `password`) |
| `DELETE` | `/api/auth/session` | Autenticado | Cerrar sesión |
| `POST` | `/api/surveys` | Administrador | Crear encuesta en borrador |
| `PATCH` | `/api/surveys/:surveyId/status` | Administrador | Cambiar estado a `published` o `draft` |
| `GET` | `/api/surveys` | Administrador | Listar encuestas y sus códigos para compartir |
| `GET` | `/api/public-surveys/:code` | Público | Ver una encuesta publicada |
| `POST` | `/api/public-surveys/:code/responses` | Público | Enviar correo y respuestas; rechaza correo duplicado para esa encuesta |
| `GET` | `/api/admin/responses` | Administrador | Consultar todas las respuestas |

Las rutas protegidas requieren el encabezado `Authorization: Bearer <token>`. El enlace de encuesta tiene el formato `http://localhost:5173/?encuesta=CODIGO`.

### Crear una encuesta

`POST /api/surveys` acepta preguntas `text`, `single_choice` y `multiple_choice`. Las preguntas son obligatorias por defecto; se puede indicar `"required": false`.

```json
{
  "title": "Encuesta de ejemplo",
  "description": "Cuéntanos qué opinas",
  "questions": [
    { "text": "¿Qué te pareció el servicio?", "type": "text" },
    {
      "text": "¿Lo recomendarías?",
      "type": "single_choice",
      "options": ["Sí", "No"]
    }
  ]
}
```

La respuesta de creación incluye los IDs de las preguntas y un código único. Al publicar la encuesta, copia el enlace desde el panel del administrador y compártelo con los estudiantes. El formulario público recibe el correo y las respuestas:

```json
{
  "email": "estudiante@universidad.edu",
  "answers": {
    "ID_DE_PREGUNTA_TEXTO": "Muy bueno",
    "ID_DE_PREGUNTA_OPCION": "Sí"
  }
}
```
