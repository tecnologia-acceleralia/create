import bcrypt from 'bcryptjs';

const ADMIN_PASSWORD = 'k|Y]:Jl:k,9*';
const CAPTAIN_PASSWORD = '0v3y!pFQZl.q';
const PARTICIPANT_PASSWORD = '0v3y!pFQZl.q';
const EVALUATOR_PASSWORD = '(u3I}ti1]V(r';

// Contraseñas para usuarios de prueba demo
const DEMO_TEST_PASSWORDS = {
  'usuario1@demo.com': 'dEm!pAsS1@demo',
  'usuario2@demo.com': 'dEm!pAsS2@demo',
  'usuario3@demo.com': 'dEm!pAsS3@demo',
  'usuario4@demo.com': 'dEm!pAsS4@demo',
  'usuario5@demo.com': 'dEm!pAsS5@demo',
  'usuario6@demo.com': 'dEm!pAsS6@demo',
  'usuario7@demo.com': 'dEm!pAsS7@demo',
  'usuario8@demo.com': 'dEm!pAsS8@demo',
  'usuario9@demo.com': 'dEm!pAsS9@demo',
  'usuario10@demo.com': 'dEm!pAsS10@demo'
};

const demoTestUsersData = [
  { firstName: 'Usuario', lastName: 'Uno', email: 'usuario1@demo.com', projectNum: 1, isCaptain: true },
  { firstName: 'Usuario', lastName: 'Dos', email: 'usuario2@demo.com', projectNum: 1, isCaptain: false },
  { firstName: 'Usuario', lastName: 'Tres', email: 'usuario3@demo.com', projectNum: 2, isCaptain: true },
  { firstName: 'Usuario', lastName: 'Cuatro', email: 'usuario4@demo.com', projectNum: 2, isCaptain: false },
  { firstName: 'Usuario', lastName: 'Cinco', email: 'usuario5@demo.com', projectNum: 3, isCaptain: true },
  { firstName: 'Usuario', lastName: 'Seis', email: 'usuario6@demo.com', projectNum: 3, isCaptain: false },
  { firstName: 'Usuario', lastName: 'Siete', email: 'usuario7@demo.com', projectNum: 4, isCaptain: true },
  { firstName: 'Usuario', lastName: 'Ocho', email: 'usuario8@demo.com', projectNum: 4, isCaptain: false },
  { firstName: 'Usuario', lastName: 'Nueve', email: 'usuario9@demo.com', projectNum: 5, isCaptain: true },
  { firstName: 'Usuario', lastName: 'Diez', email: 'usuario10@demo.com', projectNum: 5, isCaptain: false }
];

export async function up(queryInterface) {
  const passwordAdmin = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const passwordCaptain = await bcrypt.hash(CAPTAIN_PASSWORD, 10);
  const passwordParticipant = await bcrypt.hash(PARTICIPANT_PASSWORD, 10);
  const passwordEvaluator = await bcrypt.hash(EVALUATOR_PASSWORD, 10);
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
      password: passwordCaptain,
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

  const demoPhaseIntroStyles = `
<style>
  .demo-phase {
    background: linear-gradient(135deg, rgba(147, 51, 234, 0.08), rgba(22, 163, 74, 0.05));
    border: 1px solid rgba(147, 51, 234, 0.15);
    border-radius: 20px;
    padding: 2rem;
    margin: 0;
    box-shadow: 0 20px 40px -20px rgba(147, 51, 234, 0.5);
  }

  .demo-phase header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .demo-phase h2 {
    margin: 0;
    font-size: 1.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9333ea;
  }

  .demo-phase .phase-lead {
    font-size: 1.15rem;
    font-weight: 600;
    color: #6b21a8;
    margin: 0.5rem 0 1rem;
    line-height: 1.6;
  }

  .demo-phase h3 {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: #a855f7;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .demo-phase h3::before {
    content: '✷';
    font-size: 0.9rem;
    color: #c084fc;
  }

  .demo-phase p {
    margin: 0.6rem 0;
    line-height: 1.7;
  }

  .demo-phase ul,
  .demo-phase ol {
    list-style: none;
    padding: 0;
    margin: 1rem 0 0.5rem;
    display: grid;
    gap: 0.6rem;
  }

  .demo-phase li {
    position: relative;
    padding-left: 1.85rem;
    border-left: 2px solid rgba(147, 51, 234, 0.15);
    padding-top: 0.4rem;
    padding-bottom: 0.4rem;
  }

  .demo-phase ul li::before {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: -6px;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(135deg, #9333ea, #c084fc);
  }

  .demo-phase ol {
    counter-reset: demo-phase-counter;
  }

  .demo-phase ol li {
    counter-increment: demo-phase-counter;
    padding-left: 2.2rem;
  }

  .demo-phase ol li::before {
    content: counter(demo-phase-counter) '.';
    position: absolute;
    left: -0.4rem;
    top: 0.3rem;
    font-weight: 700;
    color: #9333ea;
  }

  .demo-phase .phase-tasks {
    background: rgba(147, 51, 234, 0.05);
    border-left: 4px solid rgba(147, 51, 234, 0.5);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-top: 1rem;
  }

  .demo-phase .phase-tasks strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 0.6rem;
    color: #9333ea;
  }

  .demo-phase .phase-note {
    background: rgba(147, 51, 234, 0.07);
    border-left: 4px solid rgba(147, 51, 234, 0.5);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-top: 1.25rem;
  }

  .demo-phase .phase-note strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 0.6rem;
    color: #9333ea;
  }
</style>
`;

  const wrapDemoPhaseIntro = (content) => `${demoPhaseIntroStyles}${content}`;

  const demoPhaseIntroHtml = wrapDemoPhaseIntro(`<section class="demo-phase">
  <header>
    <h2>Ideación</h2>
    <p class="phase-lead">El primer paso de tu proyecto. Genera ideas, explora posibilidades y define la base de tu propuesta innovadora.</p>
  </header>

  <div class="phase-note">
    <strong>Objetivo de la fase</strong>
    <p>Esta fase inicial es el momento perfecto para explorar diferentes ideas y conceptos. Aquí desarrollarás tu propuesta preliminar, identificarás el problema que quieres resolver y comenzarás a dar forma a tu solución.</p>
  </div>

  <h3>Actividades principales</h3>
  <ul>
    <li><strong>Presentación preliminar:</strong> Sube una presentación de tu idea que incluya el problema que identificas, tu propuesta de solución y los primeros pasos que planeas dar. Esta actividad es obligatoria y te ayudará a estructurar tu pensamiento inicial.</li>
  </ul>

  <div class="phase-tasks">
    <strong>¿Qué debes incluir en tu presentación?</strong>
    <ul>
      <li>Descripción clara del problema o necesidad que identificas.</li>
      <li>Tu propuesta de solución o idea inicial.</li>
      <li>Público objetivo o usuarios potenciales.</li>
      <li>Primeros pasos o acciones que planeas realizar.</li>
    </ul>
  </div>

  <p>Esta fase te preparará para las siguientes etapas del evento, donde profundizarás en el desarrollo y validación de tu proyecto.</p>
</section>`);

  await queryInterface.bulkInsert('phases', [
    {
      tenant_id: tenant.id,
      event_id: eventRecord.id,
      name: 'Ideación',
      description: 'Fase inicial',
      intro_html: demoPhaseIntroHtml,
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
      status: 'active',
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

  // Crear 10 usuarios de prueba y 5 proyectos
  const createdTestUsers = [];
  const createdTestUserTenants = [];

  for (const userData of demoTestUsersData) {
    const password = DEMO_TEST_PASSWORDS[userData.email];
    if (!password) {
      throw new Error(`No se encontró contraseña para ${userData.email}`);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Verificar si el usuario ya existe
    const [[existingUser]] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = '${userData.email}' LIMIT 1`
    );

    let userId;
    if (existingUser) {
      userId = existingUser.id;
      // Actualizar contraseña si existe
      await queryInterface.bulkUpdate(
        'users',
        { password: passwordHash, updated_at: now },
        { id: userId }
      );
    } else {
      await queryInterface.bulkInsert('users', [
        {
          email: userData.email,
          password: passwordHash,
          first_name: userData.firstName,
          last_name: userData.lastName,
          language: 'es',
          status: 'active',
          profile_image_url: null,
          is_super_admin: false,
          created_at: now,
          updated_at: now
        }
      ]);

      const [[newUser]] = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email = '${userData.email}' LIMIT 1`
      );
      userId = newUser.id;
    }

    // Crear o actualizar user_tenant
    const [[existingUserTenant]] = await queryInterface.sequelize.query(
      `SELECT id FROM user_tenants WHERE user_id = ${userId} AND tenant_id = ${tenant.id} LIMIT 1`
    );

    let userTenantId;
    if (existingUserTenant) {
      userTenantId = existingUserTenant.id;
    } else {
      await queryInterface.bulkInsert('user_tenants', [
        {
          user_id: userId,
          tenant_id: tenant.id,
          status: 'active',
          created_at: now,
          updated_at: now
        }
      ]);

      const [[newUserTenant]] = await queryInterface.sequelize.query(
        `SELECT id FROM user_tenants WHERE user_id = ${userId} AND tenant_id = ${tenant.id} LIMIT 1`
      );
      userTenantId = newUserTenant.id;
    }

    // Asignar rol
    const roleId = userData.isCaptain ? teamCaptainRole.id : participantRole.id;
    const [[existingRoleAssignment]] = await queryInterface.sequelize.query(
      `SELECT id FROM user_tenant_roles WHERE user_tenant_id = ${userTenantId} AND role_id = ${roleId} LIMIT 1`
    );

    if (!existingRoleAssignment) {
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

    createdTestUsers.push({ ...userData, userId, userTenantId });
    createdTestUserTenants.push({ userId, userTenantId });
  }

  // Crear equipos y proyectos (5 proyectos, 2 usuarios cada uno)
  const projectsData = [
    { name: 'Proyecto Demo 1', summary: 'Proyecto de prueba número 1', problem: 'Problema del proyecto 1', solution: 'Solución del proyecto 1' },
    { name: 'Proyecto Demo 2', summary: 'Proyecto de prueba número 2', problem: 'Problema del proyecto 2', solution: 'Solución del proyecto 2' },
    { name: 'Proyecto Demo 3', summary: 'Proyecto de prueba número 3', problem: 'Problema del proyecto 3', solution: 'Solución del proyecto 3' },
    { name: 'Proyecto Demo 4', summary: 'Proyecto de prueba número 4', problem: 'Problema del proyecto 4', solution: 'Solución del proyecto 4' },
    { name: 'Proyecto Demo 5', summary: 'Proyecto de prueba número 5', problem: 'Problema del proyecto 5', solution: 'Solución del proyecto 5' }
  ];

  for (let i = 0; i < 5; i++) {
    const projectData = projectsData[i];
    const captainData = createdTestUsers.find(u => u.projectNum === i + 1 && u.isCaptain);
    const memberData = createdTestUsers.find(u => u.projectNum === i + 1 && !u.isCaptain);

    if (!captainData || !memberData) {
      throw new Error(`No se encontraron usuarios para el proyecto ${i + 1}`);
    }

    // Crear equipo
    await queryInterface.bulkInsert('teams', [
      {
        tenant_id: tenant.id,
        event_id: eventRecord.id,
        captain_id: captainData.userId,
        name: `Equipo Demo ${i + 1}`,
        description: `Equipo de prueba para el proyecto ${i + 1}`,
        requirements: 'Buscamos perfiles complementarios',
        status: 'open',
        created_at: now,
        updated_at: now
      }
    ]);

    const [[team]] = await queryInterface.sequelize.query(
      `SELECT id FROM teams WHERE tenant_id = ${tenant.id} AND event_id = ${eventRecord.id} AND captain_id = ${captainData.userId} ORDER BY id DESC LIMIT 1`
    );

    if (!team) {
      throw new Error(`No se pudo crear el equipo para el proyecto ${i + 1}`);
    }

    const teamId = team.id;

    // Agregar miembros al equipo
    await queryInterface.bulkInsert('team_members', [
      {
        tenant_id: tenant.id,
        team_id: teamId,
        user_id: captainData.userId,
        role: 'captain',
        status: 'active',
        created_at: now,
        updated_at: now
      },
      {
        tenant_id: tenant.id,
        team_id: teamId,
        user_id: memberData.userId,
        role: 'member',
        status: 'active',
        created_at: now,
        updated_at: now
      }
    ]);

    // Crear proyecto
    await queryInterface.bulkInsert('projects', [
      {
        tenant_id: tenant.id,
        event_id: eventRecord.id,
        team_id: teamId,
        name: projectData.name,
        summary: projectData.summary,
        problem: projectData.problem,
        solution: projectData.solution,
        status: 'active',
        created_at: now,
        updated_at: now
      }
    ]);
  }
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
    // Eliminar usuarios de prueba
    const testUserEmails = demoTestUsersData.map(u => u.email);
    
    // Obtener equipos creados por usuarios de prueba
    const [testTeams] = await queryInterface.sequelize.query(
      `SELECT t.id FROM teams t 
       INNER JOIN users u ON t.captain_id = u.id 
       WHERE t.tenant_id = ${tenant.id} 
       AND u.email IN (${testUserEmails.map(e => `'${e}'`).join(', ')})`
    );

    const testTeamIds = testTeams.map(t => t.id);

    if (testTeamIds.length > 0) {
      await queryInterface.bulkDelete('projects', {
        tenant_id: tenant.id,
        team_id: testTeamIds
      });
      await queryInterface.bulkDelete('team_members', {
        tenant_id: tenant.id,
        team_id: testTeamIds
      });
      await queryInterface.bulkDelete('teams', {
        tenant_id: tenant.id,
        id: testTeamIds
      });
    }

    // Eliminar roles y membresías de usuarios de prueba
    const [testUserTenants] = await queryInterface.sequelize.query(
      `SELECT ut.id FROM user_tenants ut 
       INNER JOIN users u ON ut.user_id = u.id 
       WHERE ut.tenant_id = ${tenant.id} 
       AND u.email IN (${testUserEmails.map(e => `'${e}'`).join(', ')})`
    );

    const testUserTenantIds = testUserTenants.map(ut => ut.id);

    if (testUserTenantIds.length > 0) {
      await queryInterface.bulkDelete('user_tenant_roles', {
        tenant_id: tenant.id,
        user_tenant_id: testUserTenantIds
      });
      await queryInterface.bulkDelete('user_tenants', {
        tenant_id: tenant.id,
        id: testUserTenantIds
      });
    }

    const allDemoUserEmails = ['admin@demo.com', 'captain@demo.com', 'participant@demo.com', 'evaluator@demo.com'].concat(testUserEmails);
    await queryInterface.bulkDelete('users', {
      email: allDemoUserEmails
    });
    await queryInterface.bulkDelete('roles', { tenant_id: tenant.id });
    await queryInterface.bulkDelete('tenants', { id: tenant.id });
  }
}

