---
title: Mapa de Navegación - Usuario Público
description: Rutas accesibles para usuarios sin autenticación en la plataforma CREATE
type: documentation
category: navigation
tags: [navegación, rutas, público, sin-autenticación]
roles: []
last_updated: 2025-01-27
---

# Mapa de Navegación - Usuario Público

Este documento describe todas las rutas accesibles para usuarios **sin autenticación** en la plataforma CREATE.

## Rutas Públicas Globales

### Página Principal
- **Ruta**: `/`
- **Descripción**: Hub público de eventos. Lista todos los eventos públicos disponibles en la plataforma.

### Páginas Legales
- **Ruta**: `/{tenantSlug}/legal/privacy`
- **Descripción**: Política de privacidad del tenant.

- **Ruta**: `/{tenantSlug}/legal/cookies`
- **Descripción**: Política de cookies del tenant.

- **Ruta**: `/{tenantSlug}/legal/terms`
- **Descripción**: Términos y condiciones del tenant.

## Rutas por Tenant

Todas las rutas públicas de tenant siguen el patrón: `/{tenantSlug}/ruta`

### Landing Page del Tenant
- **Ruta**: `/{tenantSlug}`
- **Descripción**: Página de inicio del tenant con branding personalizado. Muestra eventos públicos del tenant.

### Detalle de Evento Público
- **Ruta**: `/{tenantSlug}/events/:eventId`
- **Descripción**: Página pública de detalle de un evento. Muestra información del evento, video, descripción y opciones para registrarse o iniciar sesión.

### Autenticación
- **Ruta**: `/{tenantSlug}/login`
- **Descripción**: Página de inicio de sesión. Permite autenticarse con credenciales.

- **Ruta**: `/{tenantSlug}/register`
- **Descripción**: Página de registro de nuevo usuario. Permite crear una cuenta en el tenant.

- **Ruta**: `/{tenantSlug}/password-reset`
- **Descripción**: Página para solicitar restablecimiento de contraseña.

## Flujos de Navegación Comunes

### Flujo de Registro en Evento
1. Usuario visita `/` o `/{tenantSlug}`
2. Selecciona un evento público
3. Navega a `/{tenantSlug}/events/:eventId`
4. Puede:
   - Registrarse: `/{tenantSlug}/register?eventId=:eventId`
   - Iniciar sesión: `/{tenantSlug}/login` (con state para redirigir al evento)

### Flujo de Acceso a Información Legal
1. Usuario accede desde footer o enlaces legales
2. Navega a cualquiera de las páginas legales:
   - `/{tenantSlug}/legal/privacy`
   - `/{tenantSlug}/legal/cookies`
   - `/{tenantSlug}/legal/terms`

## Restricciones

- Los usuarios públicos **NO** pueden acceder a rutas bajo `/dashboard`
- Los usuarios públicos **NO** pueden acceder a rutas de administración
- El acceso a eventos puede estar restringido por ventanas de tiempo (`accessWindow`)
- Si el tenant no existe o está inactivo, se redirige a `/`

## Notas Técnicas

- Todas las rutas públicas respetan el branding del tenant (colores, logo, etc.)
- Las rutas de tenant requieren que el tenant exista y esté activo
- El acceso puede estar limitado por ventanas de tiempo configuradas en el tenant

