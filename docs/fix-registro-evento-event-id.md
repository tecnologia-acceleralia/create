# Fix: Enrolamiento en evento al registrarse desde el landing

**Fecha:** 2025  
**Ámbito:** Registro de usuarios desde el landing de un evento (CREATE Platform)

---

## 1. Contexto

En la plataforma CREATE, los usuarios pueden registrarse de dos maneras:

- **Registro genérico:** desde `/register` (sin evento). Solo crean cuenta y membresía en el tenant.
- **Registro desde evento:** desde el landing de un evento (p. ej. `/uic/events/1`), haciendo clic en "Registrarse". La URL lleva a `/uic/register?eventId=1`.

Cuando el registro es **desde un evento**, el backend espera recibir `event_id` en el payload. Si lo recibe, además de crear usuario y membresía, crea un **`EventRegistration`** que enrola al usuario en ese evento. Las estadísticas del evento (pestaña *Statistics*) combinan usuarios con `EventRegistration` y usuarios en equipos (`TeamMember`).

---

## 2. Problema

Los usuarios que pulsaban "Registrarse" en el landing del evento (p. ej. UIC) **no aparecían en la pestaña de estadísticas** del evento (`/uic/dashboard/events/1?tab=statistics`) **a menos que tuvieran equipo**. Quienes solo se habían registrado (sin crear o unirse a un equipo) no figuraban en la lista, dando la impresión de que "no se estaban enrolando bien en el evento".

---

## 3. Causa raíz

La página de registro (`RegisterPage`) **no leía** el parámetro `eventId` de la URL (`?eventId=...`) ni **enviaba** `event_id` en la petición al API.

- El **landing del evento** enlazaba correctamente a `/register?eventId=1`.
- El **frontend** ignoraba `eventId` y enviaba solo `first_name`, `last_name`, `email`, `password`, `language` y `registration_answers`.
- El **backend** solo crea `EventRegistration` cuando recibe `event_id`. Al no recibirlo, esos usuarios nunca quedaban enrolados en el evento.

En estadísticas, solo aparecían quienes tenían equipo (vía `TeamMember`). Los que solo se habían registrado sin equipo no tenían `EventRegistration` y por tanto no se listaban.

---

## 4. Solución implementada

Se modificó **`frontend/src/pages/public/RegisterPage.tsx`** para:

1. **Leer `eventId` de la URL**  
   Uso de `useSearchParams` para obtener `?eventId=...`. Se parsea y se valida que sea un número entero positivo (`validEventId`).

2. **Enviar `event_id` al registrar**  
   Si existe `validEventId`, se incluye en el payload de `registerUser`:
   ```ts
   ...(validEventId != null && { event_id: validEventId })
   ```
   El backend crea `EventRegistration` y enrola al usuario en el evento.

3. **Redirigir al evento tras el registro**  
   Si el registro se hizo con evento, tras el registro se redirige a:
   ```
   dashboard/events/{eventId}/home
   ```
   En caso contrario se mantiene la redirección a `dashboard`.

---

## 5. Cambios técnicos concretos

| Ubicación | Cambio |
|-----------|--------|
| Import de `react-router` | Añadido `useSearchParams`. |
| Inicio del componente | `const [searchParams] = useSearchParams();` y cálculo de `eventId` / `validEventId` desde `searchParams.get('eventId')`. |
| Payload de `registerUser` | Inclusión condicional de `event_id` cuando hay `validEventId`. |
| Tras `hydrateSession` | Redirección a `dashboard/events/{eventId}/home` si hay evento, o a `dashboard` si no. |

---

## 6. Comportamiento antes y después

| Caso | Antes | Después |
|------|--------|---------|
| Registro desde landing con `?eventId=1` | No se enviaba `event_id`. No se creaba `EventRegistration`. No aparecía en estadísticas sin equipo. | Se envía `event_id`, se crea `EventRegistration`, aparece en estadísticas y se redirige al home del evento. |
| Registro desde `/register` sin `eventId` | Igual que ahora. | Sin cambios. |

---

## 7. Diferencia entre Superadmin (Usuarios) y estadísticas del evento

| Vista | Qué muestra | Origen de los datos |
|-------|-------------|---------------------|
| **Superadmin → Usuarios** (filtro por tenant) | Todos los usuarios con membresía en el tenant (p. ej. UIC). | `user_tenants`: usuario vinculado al tenant. |
| **Evento → Estadísticas → Tots els Usuaris** | Solo usuarios **enrolados en ese evento**: con `EventRegistration` o en un equipo del evento. | `event_registrations` + `team_members` (equipos del evento). |

Por eso puede ocurrir que **veas usuarios en Superadmin** (Alejandro, Martina, Marta Boher…) **pero no en las estadísticas del evento** (p. ej. SPP 2026). Esos usuarios están en el tenant UIC, pero **no tienen inscripción en el evento** (`EventRegistration`) ni pertenecen a ningún equipo del evento. Quien sí aparece (p. ej. Marta Arisa) suele tener equipo en el evento ("En equip").

**Conclusión:** estar en el tenant ≠ estar enrolado en un evento concreto. Las estadísticas del evento solo listan a quienes están inscritos en el evento (por registro con `event_id` o por formar parte de un equipo).

---

## 8. Usuarios ya registrados antes del fix

Los usuarios que se registraron **antes** de este cambio siguen sin `EventRegistration` para el evento. El fix solo aplica a **nuevos** registros desde el landing con `?eventId=...`.

Para que esos usuarios históricos figuren también en estadísticas, se puede ejecutar el **script de fix** descrito en la sección siguiente.

---

## 9. Script de fix: `enroll-tenant-users-in-event`

El script **`backend/src/scripts/enroll-tenant-users-in-event.js`** enrolla en un evento a **todos los usuarios activos del tenant** que aún no tengan `EventRegistration` para ese evento. Sirve para recuperar usuarios históricos (p. ej. UIC) que ves en Superadmin pero no en Estadísticas del evento.

### Requisitos

- Base de datos accesible (mismo `.env` / `DATABASE_URL` que el backend).
- **Local:** ejecutar desde la raíz del backend (`cd backend`).
- **Docker:** contenedor `backend` en marcha (p. ej. `docker compose up -d`); ejecutar desde la **raíz del proyecto** (donde está `docker-compose.yml`).

### Opciones

| Opción | Descripción |
|--------|-------------|
| `--tenant-slug=SLUG` | Tenant (por defecto: `uic`). |
| `--event-id=ID` | Evento concreto. Si no se indica, se usa el **primer evento** del tenant. |
| `--dry-run`, `-d` | Solo lista los usuarios que se enrolarían, **sin crear** inscripciones. |
| `--help`, `-h` | Muestra la ayuda. |

### Uso en local

Desde el directorio `backend/`:

```bash
node src/scripts/enroll-tenant-users-in-event.js [opciones]
# o:
pnpm run enroll-tenant-users -- [opciones]
```

### Uso dentro del contenedor Docker

Desde la **raíz del proyecto** (donde está `docker-compose.yml`), con el servicio `backend` en marcha:

```bash
docker compose exec backend node src/scripts/enroll-tenant-users-in-event.js [opciones]
# o:
docker compose exec backend pnpm run enroll-tenant-users -- [opciones]
```

Si usas el perfil `dev` (p. ej. `start-development`):

```bash
docker compose --profile dev exec backend node src/scripts/enroll-tenant-users-in-event.js [opciones]
```

En producción (`--profile prod`):

```bash
docker compose --profile prod exec backend node src/scripts/enroll-tenant-users-in-event.js [opciones]
```

### Ejemplos

**En local (desde `backend/`):**

```bash
# Dry run: ver qué usuarios se enrolarían
node src/scripts/enroll-tenant-users-in-event.js --tenant-slug=uic --event-id=1 --dry-run

# Enrollar usuarios UIC en evento 1
node src/scripts/enroll-tenant-users-in-event.js --tenant-slug=uic --event-id=1
```

**Dentro del contenedor Docker (desde la raíz del proyecto):**

```bash
# Dry run
docker compose exec backend node src/scripts/enroll-tenant-users-in-event.js --tenant-slug=uic --event-id=1 --dry-run

# Enrollar usuarios UIC en evento 1
docker compose exec backend node src/scripts/enroll-tenant-users-in-event.js --tenant-slug=uic --event-id=1
```

Tras ejecutarlo sin `--dry-run`, los usuarios creados aparecerán en **Estadísticas → Tots els Usuaris** (y en **Usuaris sense Equips** si no tienen equipo).

---

## 10. Archivos modificados

- `frontend/src/pages/public/RegisterPage.tsx`
- `backend/src/scripts/enroll-tenant-users-in-event.js` (nuevo)

No se modificaron rutas ni modelos del backend. El backend ya soportaba `event_id` en el registro; solo faltaba que el frontend lo enviara.
