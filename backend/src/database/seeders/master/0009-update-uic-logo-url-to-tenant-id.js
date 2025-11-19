/**
 * Seeder que actualiza la URL del logo del tenant UIC para usar el ID del tenant
 * en lugar del slug en la ruta de S3.
 * 
 * Dependencias: requiere que el tenant 'uic' exista (0002-uic-tenant.js).
 * 
 * Este seeder debe ejecutarse después de mover físicamente el archivo en S3
 * de tenants/uic/branding/ a tenants/{tenantId}/branding/
 */

export async function up(queryInterface) {
  // Buscar el tenant UIC
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id, slug, logo_url FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    console.log('⚠ No se encontró el tenant UIC. Saltando actualización del logo_url.');
    return;
  }

  if (!tenant.logo_url) {
    console.log('⚠ El tenant UIC no tiene logo_url configurado. Saltando actualización.');
    return;
  }

  // Verificar si la URL ya usa el ID del tenant
  const urlWithTenantId = `/tenants/${tenant.id}/branding/`;
  if (tenant.logo_url.includes(urlWithTenantId)) {
    console.log('✓ El logo_url del tenant UIC ya usa el ID del tenant. No se requiere actualización.');
    return;
  }

  // Extraer el nombre del archivo de la URL actual
  const logoFileName = tenant.logo_url.split('/').pop();
  
  // Construir la nueva URL reemplazando el slug por el ID del tenant
  // Formato esperado: https://...digitaloceanspaces.com/tenants/uic/branding/logo-...
  // Formato nuevo: https://...digitaloceanspaces.com/tenants/{tenantId}/branding/logo-...
  const baseUrl = tenant.logo_url.substring(0, tenant.logo_url.indexOf('/tenants/'));
  const updatedLogoUrl = `${baseUrl}/tenants/${tenant.id}/branding/${logoFileName}`;

  // Actualizar el logo_url
  await queryInterface.sequelize.query(
    `UPDATE tenants SET logo_url = :logoUrl, updated_at = :updatedAt WHERE id = :tenantId`,
    {
      replacements: {
        logoUrl: updatedLogoUrl,
        tenantId: tenant.id,
        updatedAt: new Date()
      }
    }
  );

  console.log(`✓ Logo URL actualizado para tenant UIC (ID: ${tenant.id}): ${updatedLogoUrl}`);
}

export async function down(queryInterface) {
  // Buscar el tenant UIC
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id, slug, logo_url FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant || !tenant.logo_url) {
    return;
  }

  // Verificar si la URL usa el ID del tenant
  const urlWithTenantId = `/tenants/${tenant.id}/branding/`;
  if (!tenant.logo_url.includes(urlWithTenantId)) {
    // Ya está usando el slug, no hay nada que revertir
    return;
  }

  // Revertir a usar el slug
  const logoFileName = tenant.logo_url.split('/').pop();
  const baseUrl = tenant.logo_url.substring(0, tenant.logo_url.indexOf('/tenants/'));
  const revertedLogoUrl = `${baseUrl}/tenants/${tenant.slug}/branding/${logoFileName}`;

  await queryInterface.sequelize.query(
    `UPDATE tenants SET logo_url = :logoUrl, updated_at = :updatedAt WHERE id = :tenantId`,
    {
      replacements: {
        logoUrl: revertedLogoUrl,
        tenantId: tenant.id,
        updatedAt: new Date()
      }
    }
  );

  console.log(`✓ Logo URL revertido para tenant UIC: ${revertedLogoUrl}`);
}

