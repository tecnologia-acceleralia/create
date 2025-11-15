import bcrypt from 'bcryptjs';

const ADMIN_PASSWORD = 'Ll4=u2D$S0>s';
const EVALUATOR_PASSWORDS = {
  'agironza@uic.es': 'fJ(wvc7OrMOw99',
  'marisam@uic.es': 'fJ(wvc7OrMOw5a',
  'margemi@uic.es': 'fJ(wvc7OrMOw9r',
  'fdyck@uic.es': 'fJ(wvc7OrMOw8f',
  'nnogales@uic.es': 'fJ(wvc7OrMOw7o'
};

// Seeder maestro para registrar el equipo de evaluadores de la UIC.
// Dependencias: requiere que el tenant 'uic' y su rol de administrador ya existan (0002-uic-tenant.js).

const evaluatorSeedData = [
  { firstName: 'Alfonso', lastName: 'Gironza', email: 'agironza@uic.es' },
  { firstName: 'Marta', lastName: 'Arisa', email: 'marisam@uic.es' },
  { firstName: 'Mónica', lastName: 'Argemí', email: 'margemi@uic.es' },
  { firstName: 'Frederic', lastName: 'Dyck Salrach', email: 'fdyck@uic.es' },
  { firstName: 'Noelia', lastName: 'Nogales', email: 'nnogales@uic.es' }
];

const adminEvaluatorSeed = {
  firstName: 'Marta',
  lastName: 'Graells',
  email: 'mgraells@uic.es'
};

export async function up(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    throw new Error('No se encontró el tenant UIC. Ejecuta primero el seeder 0002-uic-tenant.js');
  }

  const ensureRole = async (scope, name) => {
    const [[existingRole]] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE tenant_id = ${tenant.id} AND scope = '${scope}' LIMIT 1`
    );

    if (existingRole) {
      return existingRole.id;
    }

    await queryInterface.bulkInsert('roles', [
      {
        tenant_id: tenant.id,
        name,
        scope,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    const [[createdRole]] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE tenant_id = ${tenant.id} AND scope = '${scope}' LIMIT 1`
    );

    if (!createdRole) {
      throw new Error(`No se pudo crear el rol ${scope} para el tenant UIC.`);
    }

    return createdRole.id;
  };

  const evaluatorRoleId = await ensureRole('evaluator', 'Evaluador UIC');
  const tenantAdminRoleId = await ensureRole('tenant_admin', 'Administrador UIC');

  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const now = new Date();

  const ensureUserWithRole = async ({ email, firstName, lastName, passwordHashValue, roleId }) => {
    const [[existingUser]] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = '${email}' LIMIT 1`
    );

    let userId = existingUser ? existingUser.id : null;

    if (!userId) {
      await queryInterface.bulkInsert('users', [
        {
          email,
          password: passwordHashValue,
          first_name: firstName,
          last_name: lastName,
          language: 'ca',
          status: 'active',
          profile_image_url: null,
          is_super_admin: false,
          created_at: now,
          updated_at: now
        }
      ]);

      const [[createdUser]] = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email = '${email}' LIMIT 1`
      );

      if (!createdUser) {
        throw new Error(`No se pudo crear el usuario ${email}`);
      }

      userId = createdUser.id;
    }

    await queryInterface.bulkUpdate(
      'users',
      { language: 'ca', updated_at: now },
      { id: userId }
    );

    const [[existingUserTenant]] = await queryInterface.sequelize.query(
      `SELECT id FROM user_tenants WHERE user_id = ${userId} AND tenant_id = ${tenant.id} LIMIT 1`
    );

    let userTenantId = existingUserTenant ? existingUserTenant.id : null;

    if (!userTenantId) {
      await queryInterface.bulkInsert('user_tenants', [
        {
          user_id: userId,
          tenant_id: tenant.id,
          status: 'active',
          created_at: now,
          updated_at: now
        }
      ]);

      const [[createdUserTenant]] = await queryInterface.sequelize.query(
        `SELECT id FROM user_tenants WHERE user_id = ${userId} AND tenant_id = ${tenant.id} LIMIT 1`
      );

      if (!createdUserTenant) {
        throw new Error(`No se pudo vincular el usuario ${email} al tenant ${tenant.slug}`);
      }

      userTenantId = createdUserTenant.id;
    }

    const [[existingAssignment]] = await queryInterface.sequelize.query(
      `SELECT id FROM user_tenant_roles WHERE user_tenant_id = ${userTenantId} AND role_id = ${roleId} LIMIT 1`
    );

    if (!existingAssignment) {
      await queryInterface.bulkInsert('user_tenant_roles', [
        {
          tenant_id: tenant.id,
          user_tenant_id: userTenantId,
          role_id: roleId,
          created_at: now,
          updated_at: now
        }
      ]);
    }
  };

  for (const evaluator of evaluatorSeedData) {
    const evaluatorPassword = EVALUATOR_PASSWORDS[evaluator.email];
    if (!evaluatorPassword) {
      throw new Error(`No se encontró contraseña para el evaluador ${evaluator.email}`);
    }
    const evaluatorPasswordHash = await bcrypt.hash(evaluatorPassword, 10);
    await ensureUserWithRole({
      email: evaluator.email,
      firstName: evaluator.firstName,
      lastName: evaluator.lastName,
      passwordHashValue: evaluatorPasswordHash,
      roleId: evaluatorRoleId
    });
  }

  await ensureUserWithRole({
    email: adminEvaluatorSeed.email,
    firstName: adminEvaluatorSeed.firstName,
    lastName: adminEvaluatorSeed.lastName,
    passwordHashValue: adminPasswordHash,
    roleId: tenantAdminRoleId
  });
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  const targetEmails = [
    ...evaluatorSeedData.map(user => user.email),
    adminEvaluatorSeed.email
  ];

  for (const email of targetEmails) {
    const [[user]] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = '${email}' LIMIT 1`
    );

    if (!user) {
      continue;
    }

    const [[userTenant]] = await queryInterface.sequelize.query(
      `SELECT id FROM user_tenants WHERE user_id = ${user.id} AND tenant_id = ${tenant.id} LIMIT 1`
    );

    if (userTenant) {
      await queryInterface.bulkDelete('user_tenant_roles', { user_tenant_id: userTenant.id });
      await queryInterface.bulkDelete('user_tenants', { id: userTenant.id });
    }

    const [[remainingTenants]] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) as total FROM user_tenants WHERE user_id = ${user.id}`
    );

    if (!Number(remainingTenants.total)) {
      await queryInterface.bulkDelete('users', { id: user.id });
    }
  }

  const [[evaluatorRole]] = await queryInterface.sequelize.query(
    `SELECT id FROM roles WHERE tenant_id = ${tenant.id} AND name = 'Evaluador UIC' LIMIT 1`
  );

  if (evaluatorRole) {
    const [[usage]] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) as total FROM user_tenant_roles WHERE role_id = ${evaluatorRole.id}`
    );

    if (!Number(usage.total)) {
      await queryInterface.bulkDelete('roles', { id: evaluatorRole.id });
    }
  }
}


