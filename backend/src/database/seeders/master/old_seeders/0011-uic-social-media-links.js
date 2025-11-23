/**
 * Seeder que actualiza los enlaces de redes sociales del tenant UIC.
 * 
 * Dependencias: requiere que el tenant 'uic' exista (0002-uic-tenant.js).
 */

export async function up(queryInterface) {
  // Buscar el tenant UIC
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id, slug FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    console.log('⚠ No se encontró el tenant UIC. Saltando actualización de enlaces de redes sociales.');
    return;
  }

  // Actualizar los enlaces de redes sociales
  await queryInterface.sequelize.query(
    `UPDATE tenants 
     SET website_url = :websiteUrl,
         linkedin_url = :linkedinUrl,
         twitter_url = :twitterUrl,
         facebook_url = :facebookUrl,
         instagram_url = :instagramUrl,
         updated_at = :updatedAt 
     WHERE id = :tenantId`,
    {
      replacements: {
        websiteUrl: 'https://www.uic.es/',
        linkedinUrl: 'https://www.linkedin.com/school/universitat-internacional-de-catalunya-uic/',
        twitterUrl: 'https://twitter.com/uicbarcelona?lang=es',
        facebookUrl: 'https://es-la.facebook.com/UICbarcelona/',
        instagramUrl: 'https://www.instagram.com/uicbarcelona/?hl=es',
        tenantId: tenant.id,
        updatedAt: new Date()
      }
    }
  );

  console.log(`✓ Enlaces de redes sociales actualizados para tenant UIC (ID: ${tenant.id})`);
}

export async function down(queryInterface) {
  // Buscar el tenant UIC
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id, slug FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  // Revertir los enlaces de redes sociales a null
  await queryInterface.sequelize.query(
    `UPDATE tenants 
     SET website_url = NULL,
         linkedin_url = NULL,
         twitter_url = NULL,
         facebook_url = NULL,
         instagram_url = NULL,
         updated_at = :updatedAt 
     WHERE id = :tenantId`,
    {
      replacements: {
        tenantId: tenant.id,
        updatedAt: new Date()
      }
    }
  );

  console.log(`✓ Enlaces de redes sociales revertidos para tenant UIC`);
}

