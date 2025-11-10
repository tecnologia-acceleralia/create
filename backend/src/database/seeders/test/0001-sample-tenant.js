import bcrypt from 'bcryptjs';

export async function up(queryInterface) {
  const passwordAdmin = await bcrypt.hash('Password123!', 10);
  const passwordParticipant = await bcrypt.hash('Participant123!', 10);
  const passwordEvaluator = await bcrypt.hash('Evaluator123!', 10);
  await queryInterface.bulkInsert('tenants', [
    {
      slug: 'demo',
      name: 'Tenant Demo',
      subdomain: 'demo',
      status: 'active',
      plan_type: 'free',
      primary_color: '#9333ea',
      secondary_color: '#16a34a',
      accent_color: '#f97316',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '2099-12-31',
      tenant_css: `@theme inline {
  --radius: 0.75rem;
      --background: 270 48% 97%;
      --foreground: 230 35% 15%;
      --card: 270 40% 99%;
      --card-foreground: 230 35% 15%;
      --primary: 271 81% 56%;
      --primary-foreground: 0 0% 100%;
      --secondary: 142 76% 36%;
      --secondary-foreground: 0 0% 100%;
      --accent: 14 100% 63%;
      --accent-foreground: 230 35% 15%;
      --muted: 268 30% 92%;
      --muted-foreground: 230 20% 35%;
      --border: 268 25% 85%;
      --input: 268 25% 85%;
      --ring: 271 81% 56%;
}`,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1"
  );

  await queryInterface.bulkInsert('roles', [
    {
      tenant_id: tenant.id,
      name: 'Administrador de Cliente',
      scope: 'tenant_admin',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      tenant_id: tenant.id,
      name: 'Organizador',
      scope: 'organizer',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      tenant_id: tenant.id,
      name: 'Evaluador',
      scope: 'evaluator',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      tenant_id: tenant.id,
      name: 'Participante',
      scope: 'participant',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      tenant_id: tenant.id,
      name: 'Capitán de equipo',
      scope: 'team_captain',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const roleQuery = scope => queryInterface.sequelize.query(
    `SELECT id FROM roles WHERE tenant_id = ${tenant.id} AND scope = '${scope}' LIMIT 1`
  );

  const [[adminRole]] = await roleQuery('tenant_admin');
  const [[participantRole]] = await roleQuery('participant');
  const [[evaluatorRole]] = await roleQuery('evaluator');
  const [[teamCaptainRole]] = await roleQuery('team_captain');

  const now = new Date();

  await queryInterface.bulkInsert('users', [
    {
      email: 'admin@demo.com',
      password: passwordAdmin,
      first_name: 'Admin',
      last_name: 'Demo',
      language: 'es',
      status: 'active',
      profile_image_url: null,
      is_super_admin: false,
      created_at: now,
      updated_at: now
    },
    {
      email: 'captain@demo.com',
      password: passwordParticipant,
      first_name: 'Carla',
      last_name: 'Capitán',
      language: 'es',
      status: 'active',
      profile_image_url: null,
      is_super_admin: false,
      created_at: now,
      updated_at: now
    },
    {
      email: 'participant@demo.com',
      password: passwordParticipant,
      first_name: 'Pedro',
      last_name: 'Participante',
      language: 'es',
      status: 'active',
      profile_image_url: null,
      is_super_admin: false,
      created_at: now,
      updated_at: now
    },
    {
      email: 'evaluator@demo.com',
      password: passwordEvaluator,
      first_name: 'Elena',
      last_name: 'Evaluadora',
      language: 'es',
      status: 'active',
      profile_image_url: null,
      is_super_admin: false,
      created_at: now,
      updated_at: now
    }
  ]);

  const userQuery = email => queryInterface.sequelize.query(
    `SELECT id FROM users WHERE email = '${email}' LIMIT 1`
  );

  const [[adminUser]] = await userQuery('admin@demo.com');
  const [[captainUser]] = await userQuery('captain@demo.com');
  const [[participantUser]] = await userQuery('participant@demo.com');
  const [[evaluatorUser]] = await userQuery('evaluator@demo.com');

  await queryInterface.bulkInsert('user_tenants', [
    {
      user_id: adminUser.id,
      tenant_id: tenant.id,
      status: 'active',
      created_at: now,
      updated_at: now
    },
    {
      user_id: captainUser.id,
      tenant_id: tenant.id,
      status: 'active',
      created_at: now,
      updated_at: now
    },
    {
      user_id: participantUser.id,
      tenant_id: tenant.id,
      status: 'active',
      created_at: now,
      updated_at: now
    },
    {
      user_id: evaluatorUser.id,
      tenant_id: tenant.id,
      status: 'active',
      created_at: now,
      updated_at: now
    }
  ]);

  const membershipQuery = userId => queryInterface.sequelize.query(
    `SELECT id FROM user_tenants WHERE user_id = ${userId} AND tenant_id = ${tenant.id} LIMIT 1`
  );

  const [[adminMembership]] = await membershipQuery(adminUser.id);
  const [[captainMembership]] = await membershipQuery(captainUser.id);
  const [[participantMembership]] = await membershipQuery(participantUser.id);
  const [[evaluatorMembership]] = await membershipQuery(evaluatorUser.id);

  await queryInterface.bulkInsert('user_tenant_roles', [
    {
      tenant_id: tenant.id,
      user_tenant_id: adminMembership.id,
      role_id: adminRole.id,
      created_at: now,
      updated_at: now
    },
    {
      tenant_id: tenant.id,
      user_tenant_id: captainMembership.id,
      role_id: teamCaptainRole.id,
      created_at: now,
      updated_at: now
    },
    {
      tenant_id: tenant.id,
      user_tenant_id: participantMembership.id,
      role_id: participantRole.id,
      created_at: now,
      updated_at: now
    },
    {
      tenant_id: tenant.id,
      user_tenant_id: evaluatorMembership.id,
      role_id: evaluatorRole.id,
      created_at: now,
      updated_at: now
    }
  ]);

  const eventStart = new Date();
  const eventEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await queryInterface.bulkInsert('events', [
    {
      tenant_id: tenant.id,
      created_by: adminUser.id,
      name: 'Demo Event',
      description: 'Evento de demostración',
      start_date: eventStart,
      end_date: eventEnd,
      min_team_size: 2,
      max_team_size: 6,
      status: 'published',
      is_public: true,
      allow_open_registration: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      tenant_id: tenant.id,
      created_by: adminUser.id,
      name: 'Demo Public Launch',
      description: 'Evento público de lanzamiento para experimentar CREATE.',
      start_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      end_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      min_team_size: 1,
      max_team_size: 10,
      status: 'published',
      is_public: true,
      allow_open_registration: true,
      publish_start_at: new Date(),
      publish_end_at: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const [[eventRecord]] = await queryInterface.sequelize.query(
    `SELECT id, start_date, end_date FROM events WHERE tenant_id = ${tenant.id} AND name = 'Demo Event' LIMIT 1`
  );

  const eventStartDate = eventRecord?.start_date ? new Date(eventRecord.start_date) : eventStart;
  const eventEndDate = eventRecord?.end_date ? new Date(eventRecord.end_date) : eventEnd;

  await queryInterface.bulkInsert('phases', [
    {
      tenant_id: tenant.id,
      event_id: eventRecord.id,
      name: 'Ideación',
      description: 'Fase inicial',
      order_index: 1,
      is_elimination: false,
      start_date: new Date(),
      end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const [[phase]] = await queryInterface.sequelize.query(
    `SELECT id FROM phases WHERE event_id = ${eventRecord.id} LIMIT 1`
  );

  await queryInterface.bulkInsert('tasks', [
    {
      tenant_id: tenant.id,
      event_id: eventRecord.id,
      phase_id: phase.id,
      title: 'Presentación preliminar',
      description: 'Sube una presentación de tu idea',
      delivery_type: 'file',
      is_required: true,
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'draft',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const [[task]] = await queryInterface.sequelize.query(
    `SELECT id FROM tasks WHERE event_id = ${eventRecord.id} LIMIT 1`
  );

  await queryInterface.bulkInsert('teams', [
    {
      tenant_id: tenant.id,
      event_id: eventRecord.id,
      captain_id: captainUser.id,
      name: 'Equipo Demo',
      description: 'Equipo de prueba',
      requirements: 'Buscamos perfiles UX',
      status: 'open',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const [[team]] = await queryInterface.sequelize.query(
    `SELECT id FROM teams WHERE event_id = ${eventRecord.id} LIMIT 1`
  );

  await queryInterface.bulkInsert('team_members', [
    {
      tenant_id: tenant.id,
      team_id: team.id,
      user_id: captainUser.id,
      role: 'captain',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      tenant_id: tenant.id,
      team_id: team.id,
      user_id: participantUser.id,
      role: 'member',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  await queryInterface.bulkInsert('projects', [
    {
      tenant_id: tenant.id,
      event_id: eventRecord.id,
      team_id: team.id,
      name: 'Proyecto Demo',
      summary: 'Proyecto demostrativo para tests',
      problem: 'Necesidad de colaboración',
      solution: 'Plataforma CREATE',
      status: 'draft',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  await queryInterface.bulkInsert('submissions', [
    {
      tenant_id: tenant.id,
      event_id: eventRecord.id,
      task_id: task.id,
      team_id: team.id,
      submitted_by: captainUser.id,
      status: 'final',
      type: 'final',
      content: 'Entrega inicial del proyecto demo',
      attachment_url: null,
      submitted_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const [[submission]] = await queryInterface.sequelize.query(
    `SELECT id FROM submissions WHERE team_id = ${team.id} LIMIT 1`
  );

  await queryInterface.bulkInsert('evaluations', [
    {
      tenant_id: tenant.id,
      submission_id: submission.id,
      reviewer_id: evaluatorUser.id,
      score: 8.5,
      comment: 'Buen acercamiento, añade métricas de impacto.',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  await queryInterface.bulkInsert('notifications', [
    {
      tenant_id: tenant.id,
      user_id: captainUser.id,
      title: 'Nueva evaluación disponible',
      message: 'Tu entrega ha sido evaluada por un evaluador.',
      type: 'evaluation',
      is_read: false,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1"
  );

  if (tenant) {
    await queryInterface.bulkDelete('notifications', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('evaluations', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('submissions', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('projects', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('team_members', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('teams', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('tasks', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('phases', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('events', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('user_tenant_roles', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('user_tenants', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('users', {
      email: ['admin@demo.com', 'captain@demo.com', 'participant@demo.com', 'evaluator@demo.com']
    });
    await queryInterface.bulkDelete('roles', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('tenants', { id: tenant.id });
  }
}

