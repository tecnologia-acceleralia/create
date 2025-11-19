---
title: Mapa de Navegación - Super Admin
description: Rutas accesibles para usuarios con rol Super Admin en la plataforma CREATE
type: documentation
category: navigation
tags: [navegación, rutas, super-admin, administración-global]
roles: [super_admin]
last_updated: 2025-01-27
---

# Mapa de Navegación - Super Admin

Este documento describe todas las rutas accesibles para usuarios con rol **Super Admin** en la plataforma CREATE.

## Rutas de Super Admin

Las rutas de super admin están bajo el prefijo `/superadmin` y **NO requieren tenant**.

### Dashboard Principal
- **Ruta**: `/superadmin`
- **Descripción**: Dashboard principal del super admin. Vista general de la plataforma, estadísticas globales y acceso rápido a funciones principales.

### Gestión de Tenants
- **Ruta**: `/superadmin/tenants`
- **Descripción**: Gestión completa de tenants (clientes). Permite:
  - Crear nuevos tenants
  - Editar tenants existentes
  - Configurar planes y límites
  - Gestionar branding (logo, colores)
  - Ver estadísticas por tenant
  - Activar/suspender tenants

### Gestión de Usuarios
- **Ruta**: `/superadmin/users`
- **Descripción**: Gestión global de usuarios. Permite:
  - Ver todos los usuarios de la plataforma
  - Crear usuarios
  - Editar usuarios
  - Asignar roles globales
  - Activar/desactivar usuarios

## Acceso a Rutas de Tenant

El super admin **puede acceder a todas las rutas de tenant** sin restricciones, incluyendo:

### Rutas de Administración de Tenant
- `/{tenantSlug}/dashboard` → Dashboard del tenant (AdminDashboardPage)
- `/{tenantSlug}/dashboard/events` → Lista de eventos (requiere `tenant_admin` u `organizer`)
- `/{tenantSlug}/dashboard/events/:eventId` → Detalle de evento (requiere `tenant_admin` u `organizer`)
- `/{tenantSlug}/dashboard/events/:eventId/deliverables-tracking` → Seguimiento de entregables

### Rutas de Participante
- `/{tenantSlug}/dashboard/events/:eventId/home` → Vista principal del evento
- `/{tenantSlug}/dashboard/events/:eventId/view` → Vista de fases del evento
- `/{tenantSlug}/dashboard/events/:eventId/team` → Gestión de equipo
- `/{tenantSlug}/dashboard/events/:eventId/projects` → Gestión de proyectos
- `/{tenantSlug}/dashboard/events/:eventId/tasks/:taskId` → Detalle de tarea

### Rutas Comunes
- `/{tenantSlug}/dashboard/profile` → Perfil de usuario
- `/{tenantSlug}/dashboard/notifications` → Notificaciones

## Rutas Públicas

El super admin también puede acceder a todas las rutas públicas:
- `/{tenantSlug}` → Landing page del tenant
- `/{tenantSlug}/events/:eventId` → Vista pública del evento
- `/{tenantSlug}/login` → Login del tenant
- `/{tenantSlug}/register` → Registro del tenant

## Autenticación

- **Ruta de login**: `/superadmin`
- **Método**: Token especial (`x-super-admin-token`) o sesión de super admin
- **Persistencia**: Sesión independiente del sistema de autenticación normal

## Flujos de Navegación Comunes

### Flujo de Gestión de Tenant
1. Super admin accede a `/superadmin/tenants`
2. Selecciona o crea un tenant
3. Configura branding, plan y límites
4. Puede navegar al tenant: `/{tenantSlug}/dashboard` para ver el contexto

### Flujo de Supervisión de Evento
1. Super admin accede a `/{tenantSlug}/dashboard/events`
2. Selecciona un evento
3. Puede ver todas las vistas:
   - Vista de administración: `/{tenantSlug}/dashboard/events/:eventId`
   - Vista de participante: `/{tenantSlug}/dashboard/events/:eventId/home`
   - Seguimiento: `/{tenantSlug}/dashboard/events/:eventId/deliverables-tracking`

## Permisos Especiales

- **Acceso sin validación de tenant**: Puede acceder a rutas de tenant incluso si el tenant no existe o está inactivo
- **Acceso sin validación de accessWindow**: Puede acceder a rutas públicas incluso fuera de ventanas de tiempo
- **Acceso a todas las rutas protegidas**: Puede acceder a rutas que requieren scopes específicos sin tener esos scopes asignados

## Notas Técnicas

- El super admin tiene una sesión independiente gestionada por `SuperAdminContext`
- Puede alternar entre vista de super admin y vista de tenant
- Las rutas de super admin no requieren tenant slug en la URL
- El super admin puede crear y gestionar tenants sin restricciones

