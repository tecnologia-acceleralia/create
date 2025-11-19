---
title: Mapa de Navegación - Evaluator
description: Rutas accesibles para usuarios con rol Evaluator en la plataforma CREATE
type: documentation
category: navigation
tags: [navegación, rutas, evaluator, evaluación]
roles: [evaluator]
last_updated: 2025-01-27
---

# Mapa de Navegación - Evaluator

Este documento describe todas las rutas accesibles para usuarios con rol **Evaluator** en la plataforma CREATE.

## Rol Incluido

- **evaluator**: Evaluador de entregas y proyectos

## Rutas Requeridas

Todas las rutas requieren autenticación y pertenencia activa al tenant. El formato es: `/{tenantSlug}/ruta`

## Dashboard Principal

- **Ruta**: `/{tenantSlug}/dashboard`
- **Descripción**: Dashboard del evaluador. Muestra:
  - Eventos asignados para evaluación
  - Tareas pendientes de evaluación
  - Estadísticas de evaluaciones realizadas
  - Accesos rápidos a evaluaciones pendientes

## Gestión de Evaluaciones

### Detalle de Tarea (Evaluación)
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/tasks/:taskId`
- **Descripción**: Vista principal para evaluar entregas. Permite:
  - Ver todas las entregas de la tarea
  - Evaluar cada entrega usando rúbricas
  - Proporcionar feedback detallado
  - Ver evaluaciones previas
  - Calificar entregas
  - Usar evaluación asistida por IA (si está disponible)

## Vista de Eventos

### Vista Principal del Evento
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/home`
- **Descripción**: Vista principal del evento. Muestra:
  - Descripción del evento
  - Timeline de fases
  - Información general del evento
  - Acceso a tareas asignadas

### Vista de Fases
- **Ruta**: `/{tenantSlug}/dashboard/events/:eventId/view`
- **Descripción**: Vista de fases del evento. Permite:
  - Ver todas las fases del evento
  - Ver tareas por fase
  - Acceder a tareas para evaluación
  - Ver progreso del evento

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
  - Ver notificaciones sobre nuevas entregas
  - Ver recordatorios de evaluaciones pendientes
  - Marcar como leídas
  - Filtrar por tipo

## Rutas Públicas Accesibles

Los evaluadores también pueden acceder a las rutas públicas del tenant:

- `/{tenantSlug}` → Landing page del tenant
- `/{tenantSlug}/events/:eventId` → Vista pública del evento

## Flujos de Navegación Comunes

### Flujo de Evaluación de Entrega
1. Evaluator accede a `/{tenantSlug}/dashboard`
2. Ve tareas pendientes de evaluación
3. Selecciona una tarea: `/{tenantSlug}/dashboard/events/:eventId/tasks/:taskId`
4. Revisa entregas de equipos
5. Evalúa cada entrega usando la rúbrica
6. Proporciona feedback y calificación
7. Guarda la evaluación

### Flujo de Revisión de Evento
1. Evaluator accede a `/{tenantSlug}/dashboard/events/:eventId/home`
2. Revisa información del evento
3. Navega a `/{tenantSlug}/dashboard/events/:eventId/view` para ver fases
4. Selecciona una fase para ver tareas
5. Accede a tareas específicas para evaluación

## Permisos y Restricciones

### Permisos
- ✅ Ver eventos asignados
- ✅ Ver todas las entregas de tareas asignadas
- ✅ Evaluar entregas usando rúbricas
- ✅ Proporcionar feedback detallado
- ✅ Calificar entregas
- ✅ Ver historial de evaluaciones
- ✅ Usar evaluación asistida por IA (si está disponible)
- ✅ Ver información de equipos y proyectos (solo lectura)

### Restricciones
- ❌ No pueden crear, editar o eliminar eventos
- ❌ No pueden gestionar fases o tareas
- ❌ No pueden gestionar equipos o proyectos
- ❌ No pueden configurar rúbricas
- ❌ No pueden acceder a rutas de administración (`/dashboard/events` sin `:eventId`)
- ❌ No pueden acceder a rutas de super admin
- ❌ Deben tener membresía activa en el tenant

## Notas Técnicas

- Las rutas de evaluación requieren el scope `evaluator`
- El acceso está limitado al tenant al que pertenece el usuario
- Las rutas de tareas permiten acceso a evaluators: `requiredScopes={['participant', 'tenant_admin', 'organizer', 'evaluator']}`
- El usuario debe tener una membresía activa (`status: 'active'`) en el tenant
- Los evaluadores pueden ver información de equipos y proyectos pero no modificarla

