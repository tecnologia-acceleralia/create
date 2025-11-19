---
title: Índice de Mapas de Navegación
description: Índice general de todos los mapas de navegación disponibles para cada perfil de usuario en la plataforma CREATE
type: documentation
category: navigation
tags: [navegación, rutas, perfiles, usuarios]
last_updated: 2025-01-27
---

# Índice de Mapas de Navegación - Plataforma CREATE

Este documento es el índice general de todos los mapas de navegación disponibles para cada perfil de usuario en la plataforma CREATE.

## Mapas Disponibles

### 1. [Usuario Público](./mapa-navegacion-publico.md)
Rutas accesibles para usuarios **sin autenticación**:
- Páginas públicas de eventos
- Registro e inicio de sesión
- Páginas legales (privacidad, cookies, términos)
- Landing pages de tenants

**Roles**: Ninguno (público)

---

### 2. [Super Admin](./mapa-navegacion-superadmin.md)
Rutas accesibles para usuarios con rol **Super Admin**:
- Gestión global de tenants
- Gestión global de usuarios
- Acceso sin restricciones a todas las rutas de tenant
- Dashboard de super administración

**Roles**: `super_admin`

---

### 3. [Tenant Admin / Organizer](./mapa-navegacion-admin-organizer.md)
Rutas accesibles para administradores y organizadores de tenant:
- Gestión completa de eventos
- Configuración de fases y tareas
- Gestión de equipos y proyectos
- Evaluación de entregas
- Seguimiento de entregables
- Estadísticas y reportes

**Roles**: `tenant_admin`, `organizer`

---

### 4. [Evaluator](./mapa-navegacion-evaluator.md)
Rutas accesibles para evaluadores:
- Dashboard de evaluaciones
- Evaluación de entregas usando rúbricas
- Vista de eventos asignados
- Feedback y calificaciones
- Evaluación asistida por IA

**Roles**: `evaluator`

---

### 5. [Participant / Team Captain](./mapa-navegacion-participant.md)
Rutas accesibles para participantes y capitanes de equipo:
- Dashboard de participante
- Vista de eventos registrados
- Gestión de entregas de tareas
- Gestión de equipo (solo team captain)
- Gestión de proyectos (solo team captain)
- Perfil y notificaciones

**Roles**: `participant`, `team_captain`

---

## Estructura de Rutas

Todas las rutas siguen estos patrones:

### Rutas Públicas
- `/` - Hub global de eventos
- `/{tenantSlug}` - Landing page del tenant
- `/{tenantSlug}/events/:eventId` - Vista pública de evento
- `/{tenantSlug}/login` - Inicio de sesión
- `/{tenantSlug}/register` - Registro
- `/{tenantSlug}/legal/*` - Páginas legales

### Rutas de Super Admin
- `/superadmin` - Dashboard de super admin
- `/superadmin/tenants` - Gestión de tenants
- `/superadmin/users` - Gestión de usuarios

### Rutas de Dashboard (Requieren Autenticación)
- `/{tenantSlug}/dashboard` - Dashboard principal (redirige según rol)
- `/{tenantSlug}/dashboard/profile` - Perfil de usuario
- `/{tenantSlug}/dashboard/notifications` - Notificaciones
- `/{tenantSlug}/dashboard/events` - Lista de eventos (solo admin/organizer)
- `/{tenantSlug}/dashboard/events/:eventId` - Detalle de evento (admin/organizer)
- `/{tenantSlug}/dashboard/events/:eventId/home` - Vista principal del evento
- `/{tenantSlug}/dashboard/events/:eventId/view` - Vista de fases
- `/{tenantSlug}/dashboard/events/:eventId/team` - Gestión de equipo
- `/{tenantSlug}/dashboard/events/:eventId/projects` - Gestión de proyectos
- `/{tenantSlug}/dashboard/events/:eventId/tasks/:taskId` - Detalle de tarea
- `/{tenantSlug}/dashboard/events/:eventId/deliverables-tracking` - Seguimiento (solo admin/organizer)

## Jerarquía de Permisos

```
Super Admin
  └─ Acceso total (todas las rutas)
     │
     ├─ Tenant Admin / Organizer
     │  └─ Gestión completa de eventos y tenant
     │     │
     │     ├─ Evaluator
     │     │  └─ Evaluación de entregas
     │     │
     │     └─ Participant / Team Captain
     │        └─ Participación en eventos
     │
     └─ Usuario Público
        └─ Solo rutas públicas
```

## Convenciones de Nomenclatura

- **Rutas con `:eventId`**: Requieren ID numérico del evento
- **Rutas con `:taskId`**: Requieren ID numérico de la tarea
- **Rutas con `{tenantSlug}`**: Requieren slug del tenant en la URL
- **Rutas protegidas**: Requieren autenticación y scopes específicos

## Notas Importantes

1. **Multi-tenant**: Todas las rutas (excepto super admin) requieren un `tenantSlug` en la URL
2. **Autenticación**: Las rutas de dashboard requieren sesión activa
3. **Scopes**: Muchas rutas requieren scopes específicos (`tenant_admin`, `organizer`, `evaluator`, `participant`, `team_captain`)
4. **Membresía**: Los usuarios deben tener membresía activa en el tenant para acceder a rutas protegidas
5. **Redirecciones**: El sistema redirige automáticamente según el rol del usuario

## Actualización de Documentación

Estos mapas de navegación se actualizan cuando:
- Se añaden nuevas rutas al sistema
- Se modifican permisos de acceso
- Se cambian los flujos de navegación
- Se añaden nuevos roles o scopes

**Última actualización**: 2025-01-27

