/**
 * Seeder que configura el esquema de registro del tenant UIC.
 * 
 * Dependencias: requiere que el tenant 'uic' exista (0002-uic-tenant.js).
 */

export async function up(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    throw new Error('No se encontró el tenant UIC. Ejecuta primero el seeder 0002-uic-tenant.js');
  }

  const registrationSchema = {
    grade: {
      label: {
        es: 'Grado',
        ca: 'Grau',
        en: 'Degree'
      },
      required: true,
      options: [
        {
          value: 'ade',
          label: {
            es: 'Grado en Administración y Dirección de Empresas',
            ca: "Grau en Administració i Direcció d'Empreses",
            en: 'Degree in Business Administration and Management'
          }
        },
        {
          value: 'arquitectura',
          label: {
            es: 'Grado en Arquitectura',
            ca: 'Grau en Arquitectura',
            en: 'Degree in Architecture'
          }
        },
        {
          value: 'bioenginyeria',
          label: {
            es: 'Grado en Bioingeniería',
            ca: 'Grau en Bioenginyeria',
            en: 'Degree in Bioengineering'
          }
        },
        {
          value: 'ciencies_biomediques',
          label: {
            es: 'Grado en Ciencias Biomédicas',
            ca: 'Grau en Ciències Biomèdiques',
            en: 'Degree in Biomedical Sciences'
          }
        },
        {
          value: 'dret',
          label: {
            es: 'Grado en Derecho',
            ca: 'Grau en Dret',
            en: 'Degree in Law'
          }
        },
        {
          value: 'fisioterapia',
          label: {
            es: 'Grado en Fisioterapia',
            ca: 'Grau en Fisioteràpia',
            en: 'Degree in Physiotherapy'
          }
        },
        {
          value: 'humanitats',
          label: {
            es: 'Grado en Humanidades y Estudios Culturales',
            ca: 'Grau en Humanitats i Estudis Culturals',
            en: 'Degree in Humanities and Cultural Studies'
          }
        },
        {
          value: 'medicina',
          label: {
            es: 'Grado en Medicina',
            ca: 'Grau en Medicina',
            en: 'Degree in Medicine'
          }
        },
        {
          value: 'odontologia',
          label: {
            es: 'Grado en Odontología',
            ca: 'Grau en Odontologia',
            en: 'Degree in Dentistry'
          }
        },
        {
          value: 'publicitat',
          label: {
            es: 'Grado en Publicidad y Relaciones Públicas',
            ca: 'Grau en Publicitat i Relacions Públiques',
            en: 'Degree in Advertising and Public Relations'
          }
        }
      ]
    },
    additionalFields: []
  };

  await queryInterface.sequelize.query(
    `UPDATE tenants SET registration_schema = :schema, updated_at = NOW() WHERE id = :tenantId`,
    {
      replacements: {
        schema: JSON.stringify(registrationSchema),
        tenantId: tenant.id
      }
    }
  );
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  await queryInterface.sequelize.query(
    `UPDATE tenants SET registration_schema = NULL, updated_at = NOW() WHERE id = :tenantId`,
    {
      replacements: {
        tenantId: tenant.id
      }
    }
  );
}

