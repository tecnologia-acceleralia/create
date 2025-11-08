import bcrypt from 'bcryptjs';

export async function up(queryInterface) {
  const passwordAdmin = await bcrypt.hash('Password123!', 10);
  const passwordParticipant = await bcrypt.hash('Participant123!', 10);
  const passwordMentor = await bcrypt.hash('Mentor123!', 10);
  await queryInterface.bulkInsert('tenants', [
    {
      slug: 'demo',
      name: 'Tenant Demo',
      subdomain: 'demo',
      status: 'active',
      plan_type: 'free',
      primary_color: '#0ea5e9',
      secondary_color: '#1f2937',
      accent_color: '#f97316',
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
      name: 'Mentor',
      scope: 'mentor',
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
  const [[mentorRole]] = await roleQuery('mentor');
  const [[teamCaptainRole]] = await roleQuery('team_captain');

  await queryInterface.bulkInsert('users', [
    {
      tenant_id: tenant.id,
      role_id: adminRole.id,
      email: 'admin@demo.com',
      password: passwordAdmin,
      first_name: 'Admin',
      last_name: 'Demo',
      language: 'es',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      tenant_id: tenant.id,
      role_id: teamCaptainRole.id,
      email: 'captain@demo.com',
      password: passwordParticipant,
      first_name: 'Carla',
      last_name: 'Capitán',
      language: 'es',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      tenant_id: tenant.id,
      role_id: participantRole.id,
      email: 'participant@demo.com',
      password: passwordParticipant,
      first_name: 'Pedro',
      last_name: 'Participante',
      language: 'es',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      tenant_id: tenant.id,
      role_id: mentorRole.id,
      email: 'mentor@demo.com',
      password: passwordMentor,
      first_name: 'Marta',
      last_name: 'Mentora',
      language: 'es',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const userQuery = email => queryInterface.sequelize.query(
    `SELECT id FROM users WHERE email = '${email}' LIMIT 1`
  );

  const [[adminUser]] = await userQuery('admin@demo.com');
  const [[captainUser]] = await userQuery('captain@demo.com');
  const [[participantUser]] = await userQuery('participant@demo.com');
  const [[mentorUser]] = await userQuery('mentor@demo.com');

  await queryInterface.bulkInsert('events', [
    {
      tenant_id: tenant.id,
      created_by: adminUser.id,
      name: 'Demo Event',
      description: 'Evento de demostración',
      start_date: new Date(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      min_team_size: 2,
      max_team_size: 6,
      status: 'draft',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const [[event]] = await queryInterface.sequelize.query(
    `SELECT id FROM events WHERE tenant_id = ${tenant.id} LIMIT 1`
  );

  await queryInterface.bulkInsert('phases', [
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Ideación',
      description: 'Fase inicial',
      order_index: 1,
      is_elimination: false,
      start_date: new Date(),
      end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  const [[phase]] = await queryInterface.sequelize.query(
    `SELECT id FROM phases WHERE event_id = ${event.id} LIMIT 1`
  );

  await queryInterface.bulkInsert('tasks', [
    {
      tenant_id: tenant.id,
      event_id: event.id,
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

  await queryInterface.bulkInsert('teams', [
    {
      tenant_id: tenant.id,
      event_id: event.id,
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
    `SELECT id FROM teams WHERE event_id = ${event.id} LIMIT 1`
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
      event_id: event.id,
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
      event_id: event.id,
      task_id: phase.id,
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
      reviewer_id: mentorUser.id,
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
      message: 'Tu entrega ha sido evaluada por un mentor.',
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
    await queryInterface.bulkDelete('users', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('roles', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('tenants', { id: tenant.id });
  }
}

