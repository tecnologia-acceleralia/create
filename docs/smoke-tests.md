# Flujo de verificación rápida (smoke tests)

## Autenticación multi-tenant
- Verificar que un usuario con acceso activo a un tenant inicia sesión desde `/{slug}/login` y recibe acceso al dashboard correcto (roles de administrador, organizador, evaluador o participante).
- Confirmar que las sesiones almacenadas en localStorage incluyen roles, memberships y avatar generado cuando no hay imagen de perfil.
- Cambiar el slug a un tenant donde el usuario no tenga acceso y comprobar que la sesión anterior se invalida.

## Gestión de roles y perfiles
- Acceder a `/{slug}/dashboard/profile` y revisar que aparezcan el avatar, los roles del tenant actual y la lista de otros tenants con sus estados.
- Probar la creación/actualización de entregas (`TaskSubmissionPage`) con un usuario evaluador y uno participante, validando permisos según `roleScopes`.

## Super administrador
- Iniciar sesión en `/superadmin` con credenciales válidas y confirmar que se muestran los tenants actuales.
- Crear un tenant nuevo y verificar que el usuario administrador se registra con `user_tenants` y `user_tenant_roles`.
- Actualizar/eliminar logos de un tenant y comprobar que los cambios se reflejan.
- Cerrar sesión de superadmin y confirmar que los endpoints protegidos devuelven 401 hasta volver a autenticarse.

