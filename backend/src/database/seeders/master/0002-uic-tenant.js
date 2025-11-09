import bcrypt from 'bcryptjs';

// Seeder maestro para registrar el tenant UIC junto con su evento SPP 2026.
// Dependencias: ninguna.

export async function up(queryInterface) {
  await queryInterface.bulkInsert('tenants', [
    {
      slug: 'uic',
      name: 'UIC Universitat Internacional de Catalunya',
      subdomain: 'uic',
      custom_domain: null,
      logo_url: null,
      primary_color: '#00AEEF',
      secondary_color: '#003A70',
      accent_color: '#F9A01B',
      hero_content: JSON.stringify({
        es: {
          title: 'Transforma ideas en impacto real',
          subtitle: 'Únete a los programas de innovación de la UIC y lleva tu proyecto al siguiente nivel.'
        },
        en: {
          title: 'Turn ideas into real-world impact',
          subtitle: 'Join UIC innovation programs and take your project to the next level.'
        }
      }),
      plan_type: 'enterprise',
      max_evaluators: null,
      max_participants: null,
      max_appointments_per_month: null,
      status: 'active',
      start_date: '2025-09-01',
      end_date: '2026-06-30',
      tenant_css: `@theme inline {
  --radius: 0.85rem;
  --background: 199 100% 97%;
  --foreground: 207 100% 20%;
  --card: 199 90% 98%;
  --card-foreground: 207 100% 20%;
  --primary: 197 100% 45%;
  --primary-foreground: 0 0% 100%;
  --secondary: 207 100% 22%;
  --secondary-foreground: 0 0% 100%;
  --accent: 36 95% 54%;
  --accent-foreground: 207 100% 20%;
  --muted: 199 60% 92%;
  --muted-foreground: 207 30% 32%;
  --border: 199 40% 85%;
  --input: 199 40% 85%;
  --ring: 197 100% 45%;
}`,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    throw new Error('No se pudo recuperar el tenant UIC después de insertarlo.');
  }

  const passwordHash = await bcrypt.hash('UICAdmin2025!', 10);
  const now = new Date();

  await queryInterface.bulkInsert('roles', [
    {
      tenant_id: tenant.id,
      name: 'Administrador UIC',
      scope: 'tenant_admin',
      created_at: now,
      updated_at: now
    }
  ]);

  const [[adminRole]] = await queryInterface.sequelize.query(
    `SELECT id FROM roles WHERE tenant_id = ${tenant.id} AND scope = 'tenant_admin' LIMIT 1`
  );

  if (!adminRole) {
    throw new Error('No se pudo recuperar el rol administrador del tenant UIC.');
  }

  const ensureUserWithRole = async (email, firstName, lastName, passwordHashValue, roleId) => {
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

    return { userId, userTenantId };
  };

  const { userId: adminUserId } = await ensureUserWithRole(
    'admin@uic.cat',
    'Equipo',
    'UIC',
    passwordHash,
    adminRole.id
  );

  const eventStart = new Date('2025-09-22T00:00:00.000Z');
  const eventEnd = new Date('2026-05-22T23:59:59.000Z');

  await queryInterface.bulkInsert('events', [
    {
      tenant_id: tenant.id,
      created_by: adminUserId,
      name: 'SPP 2026',
      description: 'Programa SPP 2026 para proyectos colaborativos.',
      start_date: eventStart,
      end_date: eventEnd,
      min_team_size: 2,
      max_team_size: 8,
      status: 'published',
      video_url: 'https://youtu.be/lVJ8-tPSNzA',
      is_public: true,
      allow_open_registration: true,
      publish_start_at: new Date('2025-07-01T00:00:00.000Z'),
      publish_end_at: eventEnd,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const [[event]] = await queryInterface.sequelize.query(
    `SELECT id, start_date, end_date FROM events WHERE tenant_id = ${tenant.id} AND name = 'SPP 2026' LIMIT 1`
  );

  if (!event) {
    throw new Error('No se pudo recuperar el evento SPP 2026 del tenant UIC.');
  }

  const phaseNow = new Date();

  const eventStartDate = event.start_date ? new Date(event.start_date) : eventStart;
  const eventEndDate = event.end_date ? new Date(event.end_date) : eventEnd;

  await queryInterface.bulkInsert('phases', [
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Inscripción Fase 0 y Comité Científico',
      description: 'Inscripción Fase 0 y Comité Científico',
      order_index: 1,
      is_elimination: false,
      start_date: new Date('2025-09-22T00:00:00.000Z'),
      end_date: new Date('2025-09-26T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Fase 1',
      description: 'Fase 1',
      order_index: 2,
      is_elimination: false,
      start_date: new Date('2025-10-20T00:00:00.000Z'),
      end_date: new Date('2025-10-31T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Fase 2',
      description: 'Fase 2',
      order_index: 3,
      is_elimination: false,
      start_date: new Date('2025-11-17T00:00:00.000Z'),
      end_date: new Date('2025-11-28T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Feedback por parte de tutores',
      description: 'Feedback por parte de tutores',
      order_index: 4,
      is_elimination: false,
      start_date: new Date('2026-01-19T00:00:00.000Z'),
      end_date: new Date('2026-01-23T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Fase 3 y Fase 4',
      description: 'Fase 3 y Fase 4 ',
      order_index: 5,
      is_elimination: false,
      start_date: new Date('2026-02-23T00:00:00.000Z'),
      end_date: new Date('2026-02-27T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Entrega Final y Decisión Finalistas',
      description: 'Entrega Final y Decisión Finalistas',
      order_index: 6,
      is_elimination: false,
      start_date: new Date('2026-03-23T00:00:00.000Z'),
      end_date: new Date('2026-03-27T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Gran Final',
      description: 'Gran Final',
      order_index: 7,
      is_elimination: false,
      start_date: new Date('2026-05-18T00:00:00.000Z'),
      end_date: new Date('2026-05-22T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    }
  ]);
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  const [[event]] = await queryInterface.sequelize.query(
    `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND name = 'SPP 2026' LIMIT 1`
  );

  if (event) {
    await queryInterface.bulkDelete('phases', { tenant_id: tenant.id, event_id: event.id });
    await queryInterface.bulkDelete('events', { tenant_id: tenant.id, id: event.id });
  }

  const [[adminUser]] = await queryInterface.sequelize.query(
    "SELECT id FROM users WHERE email = 'admin@uic.cat' LIMIT 1"
  );

  if (adminUser) {
    const [[userTenant]] = await queryInterface.sequelize.query(
      `SELECT id FROM user_tenants WHERE user_id = ${adminUser.id} AND tenant_id = ${tenant.id} LIMIT 1`
    );

    if (userTenant) {
      await queryInterface.bulkDelete('user_tenant_roles', { user_tenant_id: userTenant.id });
      await queryInterface.bulkDelete('user_tenants', { id: userTenant.id });
    }
  }

  await queryInterface.bulkDelete('users', { email: 'admin@uic.cat' });
  await queryInterface.bulkDelete('roles', { tenant_id: tenant.id, scope: 'tenant_admin' });
  await queryInterface.bulkDelete('tenants', { id: tenant.id });
}


