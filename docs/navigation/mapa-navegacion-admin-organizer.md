---
title: Mapa de Navegación - Tenant Admin / Organizer
description: Rutas accesibles para usuarios con roles Tenant Admin u Organizer en la plataforma CREATE
type: documentation
category: navigation
tags: [navegación, rutas, tenant-admin, organizer, administración]
roles: [tenant_admin, organizer]
last_updated: 2025-01-27
---

# Mapa de Navegación - Tenant Admin / Organizer

Este documento describe todas las rutas accesibles para usuarios con roles **Tenant Admin** u **Organizer** en la plataforma CREATE.

## Roles Incluidos

- **tenant_admin**: Administrador del tenant (cliente)
- **organizer**: Organizador de eventos

Ambos roles comparten las mismas rutas y permisos en el sistema.

## Rutas Requeridas

Todas las rutas requieren autenticación y pertenencia activa al tenant. El formato es: `/{tenantSlug}/ruta`

## Dashboard Principal

- **Ruta**: `/{tenantSlug}/dashboard`
- **Descripción**: Dashboard de administración. Muestra:
  - Resumen de eventos activos
  - Estadísticas generales
  - Accesos rápidos a funciones principales
  - Notificaciones importantes

## Gestión de Eventos

### Lista de Eventos
- **Ruta**: `/{tenantSlug}/dashboard/events`
- **Descripción**: Lista completa de eventos del tenant. Permite:
  - Ver todos los eventos (activos, finalizados, borradores)
  - Crear nuevos eventos
  - Filtrar y buscar eventos
  - Acceder a la gestión de cada evento

### Detalle y Gestión de Evento
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId`
- **Descripción**: Panel completo de administración del evento. Incluye:
  - **Pestaña General**: Información básica del evento, fechas, descripción
  - **Pestaña Fases**: Gestión de fases (crear, editar, eliminar, reordenar)
  - **Pestaña Tareas**: Gestión de tareas por fase
  - **Pestaña Rúbricas**: Configuración de rúbricas de evaluación
  - **Pestaña Equipos**: Gestión de equipos y miembros
  - **Pestaña Estadísticas**: Métricas y analíticas del evento
  - **Pestaña Assets**: Gestión de recursos multimedia del evento

### Seguimiento de Entregables
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/deliverables-tracking`
- **Descripción**: Vista de seguimiento de todas las entregas del evento. Permite:
  - Ver estado de todas las tareas por equipo
  - Filtrar por fase, equipo o estado
  - Acceder directamente a evaluaciones
  - Exportar reportes

## Gestión de Equipos y Proyectos

### Gestión de Equipo
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/team`
- **Descripción**: Gestión completa de equipos del evento. Permite:
  - Ver todos los equipos
  - Crear equipos manualmente
  - Gestionar miembros de equipos
  - Abrir/cerrar equipos para nuevas incorporaciones
  - Ver detalles de cada equipo

### Gestión de Proyectos
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/projects`
- **Descripción**: Vista de todos los proyectos del evento. Permite:
  - Ver proyectos de todos los equipos
  - Filtrar y buscar proyectos
  - Ver detalles completos de cada proyecto
  - Gestionar proyectos

### Detalle de Tarea
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/tasks/:taskId`
- **Descripción**: Vista detallada de una tarea específica. Permite:
  - Ver todas las entregas de la tarea
  - Evaluar entregas
  - Ver feedback y evaluaciones previas
  - Gestionar entregas

## Vista de Participante (Solo Lectura)

Los admins/organizers también pueden acceder a las vistas de participante para revisar la experiencia del usuario:

### Vista Principal del Evento
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/home`
- **Descripción**: Vista principal del evento para participantes. Muestra:
  - Descripción del evento
  - Timeline de fases
  - Información general

### Vista de Fases
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/view`
- **Descripción**: Vista de fases del evento. Muestra:
  - Lista de fases activas
  - Tareas por fase
  - Progreso del evento

## Perfil y Configuración

### Perfil de Usuario
- **Ruta**: `/{tenantSlug}/dashboard/profile`
- **Descripción**: Gestión del perfil personal. Permite:
  - Editar información personal
  - Cambiar contraseña
  - Actualizar foto de perfil
  - Configurar preferencias

### Notificaciones
- **Ruta**: `/{tenantSlug}/dashboard/notifications`
- **Descripción**: Centro de notificaciones. Permite:
  - Ver todas las notificaciones
  - Marcar como leídas
  - Filtrar por tipo
  - Gestionar preferencias de notificaciones

## Rutas Públicas Accesibles

Los admins/organizers también pueden acceder a las rutas públicas del tenant:

- `/{tenantSlug}` → Landing page del tenant
- `/{tenantSlug}/events/:eventId` → Vista pública del evento

## Flujos de Navegación Comunes

### Flujo de Creación de Evento
1. Admin accede a `/{tenantSlug}/dashboard/events`
2. Crea nuevo evento
3. Configura información básica
4. Crea fases en `/{tenantSlug}/dashboard/events/:eventId` (pestaña Fases)
5. Asigna tareas a cada fase (pestaña Tareas)
6. Configura rúbricas (pestaña Rúbricas)
7. Publica el evento

### Flujo de Seguimiento de Evento
1. Admin accede a `/{tenantSlug}/dashboard/events/:eventId`
2. Revisa estadísticas en pestaña Estadísticas
3. Monitorea entregas en `/{tenantSlug}/dashboard/events/:eventId/deliverables-tracking`
4. Evalúa entregas específicas en `/{tenantSlug}/dashboard/events/:eventId/tasks/:taskId`

### Flujo de Gestión de Equipos
1. Admin accede a `/{tenantSlug}/dashboard/events/:eventId/team`
2. Ve equipos existentes
3. Puede crear equipos manualmente o gestionar miembros
4. Abre/cierra equipos según necesidad

## Permisos y Restricciones

### Permisos
- ✅ Crear, editar y eliminar eventos
- ✅ Gestionar fases y tareas
- ✅ Configurar rúbricas de evaluación
- ✅ Gestionar equipos y proyectos
- ✅ Evaluar entregas
- ✅ Ver estadísticas y reportes
- ✅ Gestionar assets del evento
- ✅ Enviar notificaciones

### Restricciones
- ❌ No pueden acceder a rutas de super admin (`/superadmin/*`)
- ❌ No pueden gestionar otros tenants
- ❌ No pueden modificar configuración global del tenant (solo super admin)
- ❌ Deben tener membresía activa en el tenant

## Notas Técnicas

- Las rutas requieren el scope `tenant_admin` o `organizer`
- El acceso está limitado al tenant al que pertenece el usuario
- Todas las rutas están protegidas por `ProtectedRoute` con `requiredScopes`
- El usuario debe tener una membresía activa (`status: 'active'`) en el tenant

