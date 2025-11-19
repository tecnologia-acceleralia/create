---
title: Mapa de Navegación - Participant / Team Captain
description: Rutas accesibles para usuarios con roles Participant o Team Captain en la plataforma CREATE
type: documentation
category: navigation
tags: [navegación, rutas, participant, team-captain, participación]
roles: [participant, team_captain]
last_updated: 2025-01-27
---

# Mapa de Navegación - Participant / Team Captain

Este documento describe todas las rutas accesibles para usuarios con roles **Participant** o **Team Captain** en la plataforma CREATE.

## Roles Incluidos

- **participant**: Participante en eventos
- **team_captain**: Capitán de equipo (tiene permisos adicionales de gestión de equipo)

Ambos roles comparten las mismas rutas base, pero el `team_captain` tiene permisos adicionales para gestionar equipos.

## Rutas Requeridas

Todas las rutas requieren autenticación y pertenencia activa al tenant. El formato es: `/{tenantSlug}/ruta`

## Dashboard Principal

- **Ruta**: `/{tenantSlug}/dashboard`
- **Descripción**: Dashboard del participante. Muestra:
  - Eventos en los que está registrado
  - Eventos disponibles del tenant
  - Tareas pendientes
  - Progreso de proyectos
  - Notificaciones importantes
  - Accesos rápidos a eventos activos

**Nota**: Si solo hay un evento registrado, se redirige automáticamente a `/{tenantSlug}/dashboard/events/:eventId/home`

## Gestión de Eventos

### Vista Principal del Evento
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/home`
- **Descripción**: Vista principal del evento. Incluye:
  - **Pestaña Descripción**: Información detallada del evento, descripción HTML, recursos
  - **Pestaña Timeline**: Cronograma visual de fases y tareas con fechas
  - Información general del evento
  - Accesos rápidos a secciones principales

### Vista de Fases del Evento
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/view`
- **Descripción**: Vista detallada de fases y tareas. Permite:
  - Ver todas las fases del evento
  - Ver tareas por fase con estados
  - Ver deadlines y requisitos
  - Acceder a tareas específicas
  - Ver progreso del equipo

### Detalle de Tarea
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/tasks/:taskId`
- **Descripción**: Vista completa de una tarea. Permite:
  - Ver detalles de la tarea (descripción, requisitos, deadline)
  - Ver entregas del equipo
  - Crear nuevas entregas
  - Ver evaluaciones y feedback recibido
  - Gestionar archivos adjuntos
  - Ver historial de entregas

## Gestión de Equipo

### Mi Equipo
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/team`
- **Descripción**: Gestión del equipo del participante. Permite:

#### Para Todos los Participantes:
- Ver información del equipo
- Ver miembros del equipo
- Ver descripción y requisitos del equipo
- Ver estado del equipo (abierto/cerrado)

#### Para Team Captain (permisos adicionales):
- ✅ Crear equipo (si no tiene equipo)
- ✅ Editar descripción del equipo
- ✅ Editar requisitos del equipo
- ✅ Gestionar miembros (invitar, eliminar)
- ✅ Abrir/cerrar equipo para nuevas incorporaciones
- ✅ Ver solicitudes de unión al equipo
- ✅ Aceptar/rechazar solicitudes

## Gestión de Proyectos

### Proyectos del Evento
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/projects`
- **Descripción**: Vista de proyectos del evento. Permite:

#### Para Todos los Participantes:
- Ver proyectos de todos los equipos (públicos)
- Ver detalles de proyectos
- Buscar y filtrar proyectos
- Ver estadísticas de proyectos

#### Para Team Captain:
- ✅ Crear proyecto para su equipo
- ✅ Editar proyecto del equipo
- ✅ Gestionar logo y descripción del proyecto
- ✅ Ver estadísticas detalladas del proyecto

## Perfil y Configuración

### Perfil de Usuario
- **Ruta**: `/{tenantSlug}/dashboard/profile`
- **Descripción**: Gestión del perfil personal. Permite:
  - Editar información personal (nombre, apellidos, email)
  - Cambiar contraseña
  - Actualizar foto de perfil
  - Editar información de contacto
  - Configurar preferencias
  - Ver historial de actividad

### Notificaciones
- **Ruta**: `/{tenantSlug}/dashboard/notifications`
- **Descripción**: Centro de notificaciones. Permite:
  - Ver todas las notificaciones
  - Filtrar por tipo (tareas, evaluaciones, equipos, etc.)
  - Marcar como leídas/no leídas
  - Ver detalles de cada notificación
  - Gestionar preferencias de notificaciones

## Rutas Públicas Accesibles

Los participantes también pueden acceder a las rutas públicas del tenant:

- `/{tenantSlug}` → Landing page del tenant
- `/{tenantSlug}/events/:eventId` → Vista pública del evento (con botón "Acceder" si está registrado)

## Flujos de Navegación Comunes

### Flujo de Registro en Evento
1. Participante visita `/{tenantSlug}/events/:eventId` (página pública)
2. Si no está registrado, ve botones de registro/login
3. Tras registro/login, puede acceder a `/{tenantSlug}/dashboard/events/:eventId/home`
4. Si el evento requiere equipo, debe unirse o crear uno

### Flujo de Creación de Equipo (Team Captain)
1. Team Captain accede a `/{tenantSlug}/dashboard/events/:eventId/team`
2. Crea nuevo equipo
3. Configura descripción y requisitos
4. Invita miembros o abre el equipo para solicitudes
5. Gestiona solicitudes de unión

### Flujo de Creación de Proyecto (Team Captain)
1. Team Captain accede a `/{tenantSlug}/dashboard/events/:eventId/projects`
2. Crea nuevo proyecto para su equipo
3. Configura nombre, descripción y logo
4. El proyecto queda vinculado al equipo

### Flujo de Entrega de Tarea
1. Participante accede a `/{tenantSlug}/dashboard/events/:eventId/view`
2. Selecciona una fase y tarea
3. Navega a `/{tenantSlug}/dashboard/events/:eventId/tasks/:taskId`
4. Revisa requisitos y deadline
5. Crea nueva entrega con archivos adjuntos
6. Envía la entrega
7. Espera evaluación y revisa feedback

### Flujo de Seguimiento de Progreso
1. Participante accede a `/{tenantSlug}/dashboard`
2. Ve eventos registrados
3. Accede a `/{tenantSlug}/dashboard/events/:eventId/home`
4. Revisa timeline en pestaña Timeline
5. Ve progreso en `/{tenantSlug}/dashboard/events/:eventId/view`
6. Revisa entregas y evaluaciones en tareas específicas

## Permisos y Restricciones

### Permisos Comunes (Participant y Team Captain)
- ✅ Ver eventos del tenant
- ✅ Registrarse en eventos públicos
- ✅ Ver información de eventos registrados
- ✅ Ver fases y tareas de eventos
- ✅ Crear entregas de tareas
- ✅ Ver evaluaciones y feedback recibido
- ✅ Ver proyectos públicos de otros equipos
- ✅ Ver información de equipos (propio y otros)
- ✅ Gestionar perfil personal
- ✅ Ver notificaciones

### Permisos Adicionales (Solo Team Captain)
- ✅ Crear equipo
- ✅ Editar equipo propio
- ✅ Gestionar miembros del equipo
- ✅ Abrir/cerrar equipo
- ✅ Crear proyecto para su equipo
- ✅ Editar proyecto del equipo
- ✅ Gestionar solicitudes de unión al equipo

### Restricciones
- ❌ No pueden crear, editar o eliminar eventos
- ❌ No pueden gestionar fases o tareas (solo ver y entregar)
- ❌ No pueden evaluar entregas (solo recibir evaluaciones)
- ❌ No pueden gestionar equipos de otros participantes
- ❌ No pueden editar proyectos de otros equipos
- ❌ No pueden acceder a rutas de administración
- ❌ No pueden acceder a rutas de super admin
- ❌ Deben tener membresía activa en el tenant

## Notas Técnicas

- Los participantes pueden acceder a rutas protegidas si tienen membresía activa, incluso sin scope explícito asignado (ver `authorization.middleware.js`)
- Las rutas de equipo y proyectos requieren scope `participant` o `team_captain`
- El acceso está limitado al tenant al que pertenece el usuario
- Los participantes sin equipo pueden ver información del evento pero no crear entregas (depende de la configuración del evento)
- El sistema redirige automáticamente si solo hay un evento registrado

