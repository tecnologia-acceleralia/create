import bcrypt from 'bcryptjs';

// Contraseñas para usuarios de prueba UIC
const UIC_TEST_PASSWORDS = {
  'usuario1@uic.es': 'uIc!pAsS1@uic',
  'usuario2@uic.es': 'uIc!pAsS2@uic',
  'usuario3@uic.es': 'uIc!pAsS3@uic',
  'usuario4@uic.es': 'uIc!pAsS4@uic',
  'usuario5@uic.es': 'uIc!pAsS5@uic',
  'usuario6@uic.es': 'uIc!pAsS6@uic',
  'usuario7@uic.es': 'uIc!pAsS7@uic',
  'usuario8@uic.es': 'uIc!pAsS8@uic',
  'usuario9@uic.es': 'uIc!pAsS9@uic',
  'usuario10@uic.es': 'uIc!pAsS10@uic',
  'usuario11@uic.es': 'uIc!pAsS11@uic',
  'usuario12@uic.es': 'uIc!pAsS12@uic'
};

// Seeder para crear 12 usuarios de prueba de UIC: 10 usuarios con 5 proyectos (2 usuarios por proyecto) y 2 usuarios sin equipo
// Dependencias: requiere que el tenant 'uic' y su evento 'SPP 2026' ya existan (0002-uic-tenant.js)

// Usar los valores del registration_schema (no los labels completos)
// Valores válidos según el esquema: ade, arquitectura, bioenginyeria, ciencies_biomediques, dret, fisioterapia, humanitats, medicina, odontologia, publicitat
const testUsersData = [
  { firstName: 'Usuario', lastName: 'Uno', email: 'usuario1@uic.es', projectNum: 1, isCaptain: true, grade: 'ade' },
  { firstName: 'Usuario', lastName: 'Dos', email: 'usuario2@uic.es', projectNum: 1, isCaptain: false, grade: 'arquitectura' },
  { firstName: 'Usuario', lastName: 'Tres', email: 'usuario3@uic.es', projectNum: 2, isCaptain: true, grade: 'bioenginyeria' },
  { firstName: 'Usuario', lastName: 'Cuatro', email: 'usuario4@uic.es', projectNum: 2, isCaptain: false, grade: 'ciencies_biomediques' },
  { firstName: 'Usuario', lastName: 'Cinco', email: 'usuario5@uic.es', projectNum: 3, isCaptain: true, grade: 'dret' },
  { firstName: 'Usuario', lastName: 'Seis', email: 'usuario6@uic.es', projectNum: 3, isCaptain: false, grade: 'fisioterapia' },
  { firstName: 'Usuario', lastName: 'Siete', email: 'usuario7@uic.es', projectNum: 4, isCaptain: true, grade: 'medicina' },
  { firstName: 'Usuario', lastName: 'Ocho', email: 'usuario8@uic.es', projectNum: 4, isCaptain: false, grade: 'humanitats' },
  { firstName: 'Usuario', lastName: 'Nueve', email: 'usuario9@uic.es', projectNum: 5, isCaptain: true, grade: 'odontologia' },
  { firstName: 'Usuario', lastName: 'Diez', email: 'usuario10@uic.es', projectNum: 5, isCaptain: false, grade: 'publicitat' },
  // Usuarios sin equipo
  { firstName: 'Usuario', lastName: 'Once', email: 'usuario11@uic.es', projectNum: null, isCaptain: false, grade: 'ade' },
  { firstName: 'Usuario', lastName: 'Doce', email: 'usuario12@uic.es', projectNum: null, isCaptain: false, grade: 'arquitectura' }
];

export async function up(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    throw new Error('No se encontró el tenant UIC. Ejecuta primero el seeder 0002-uic-tenant.js');
  }

  const [[event]] = await queryInterface.sequelize.query(
    `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND name = 'SPP 2026' LIMIT 1`
  );

  if (!event) {
    throw new Error('No se encontró el evento SPP 2026. Ejecuta primero el seeder 0002-uic-tenant.js');
  }

  // Obtener roles necesarios
  const roleQuery = async (scope) => {
    const [[role]] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE tenant_id = ${tenant.id} AND scope = '${scope}' LIMIT 1`
    );
    return role ? role.id : null;
  };

  const participantRoleId = await roleQuery('participant');
  const teamCaptainRoleId = await roleQuery('team_captain');

  if (!participantRoleId) {
    throw new Error('No se encontró el rol participant para UIC');
  }

  if (!teamCaptainRoleId) {
    throw new Error('No se encontró el rol team_captain para UIC');
  }

  const now = new Date();
  const createdUsers = [];
  const createdUserTenants = [];

  // Crear usuarios y sus membresías
  for (const userData of testUsersData) {
    const password = UIC_TEST_PASSWORDS[userData.email];
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
      // Actualizar contraseña y grado si existe
      await queryInterface.bulkUpdate(
        'users',
        { password: passwordHash, grade: userData.grade || null, updated_at: now },
        { id: userId }
      );
    } else {
      await queryInterface.bulkInsert('users', [
        {
          email: userData.email,
          password: passwordHash,
          first_name: userData.firstName,
          last_name: userData.lastName,
          grade: userData.grade || null,
          language: 'ca',
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

    // Asignar roles: todos deben tener participant, y los capitanes también team_captain
    // Primero asegurar participant para todos
    const [[existingParticipantRole]] = await queryInterface.sequelize.query(
      `SELECT id FROM user_tenant_roles WHERE user_tenant_id = ${userTenantId} AND role_id = ${participantRoleId} LIMIT 1`
    );

    if (!existingParticipantRole) {
      await queryInterface.bulkInsert('user_tenant_roles', [
        {
          tenant_id: tenant.id,
          user_tenant_id: userTenantId,
          role_id: participantRoleId,
          created_at: now,
          updated_at: now
        }
      ]);
    }

    // Si es capitán, también asignar team_captain
    if (userData.isCaptain) {
      const [[existingCaptainRole]] = await queryInterface.sequelize.query(
        `SELECT id FROM user_tenant_roles WHERE user_tenant_id = ${userTenantId} AND role_id = ${teamCaptainRoleId} LIMIT 1`
      );

      if (!existingCaptainRole) {
        await queryInterface.bulkInsert('user_tenant_roles', [
          {
            tenant_id: tenant.id,
            user_tenant_id: userTenantId,
            role_id: teamCaptainRoleId,
            created_at: now,
            updated_at: now
          }
        ]);
      }
    }

    // Registrar usuario en el evento con el grado
    const [[existingRegistration]] = await queryInterface.sequelize.query(
      `SELECT id FROM event_registrations WHERE user_id = ${userId} AND event_id = ${event.id} LIMIT 1`
    );

    if (!existingRegistration) {
      await queryInterface.bulkInsert('event_registrations', [
        {
          tenant_id: tenant.id,
          event_id: event.id,
          user_id: userId,
          status: 'registered',
          grade: userData.grade || null,
          answers: JSON.stringify({}),
          created_at: now,
          updated_at: now
        }
      ]);
    } else {
      // Actualizar el grado si ya existe el registro
      await queryInterface.bulkUpdate(
        'event_registrations',
        { grade: userData.grade || null, updated_at: now },
        { id: existingRegistration.id }
      );
    }

    createdUsers.push({ ...userData, userId, userTenantId });
    createdUserTenants.push({ userId, userTenantId });
  }

  // Crear equipos y proyectos (5 proyectos, 2 usuarios cada uno)
  const projectsData = [
    { name: 'Proyecto UIC 1', summary: 'Proyecto de prueba número 1', problem: 'Problema del proyecto 1', solution: 'Solución del proyecto 1' },
    { name: 'Proyecto UIC 2', summary: 'Proyecto de prueba número 2', problem: 'Problema del proyecto 2', solution: 'Solución del proyecto 2' },
    { name: 'Proyecto UIC 3', summary: 'Proyecto de prueba número 3', problem: 'Problema del proyecto 3', solution: 'Solución del proyecto 3' },
    { name: 'Proyecto UIC 4', summary: 'Proyecto de prueba número 4', problem: 'Problema del proyecto 4', solution: 'Solución del proyecto 4' },
    { name: 'Proyecto UIC 5', summary: 'Proyecto de prueba número 5', problem: 'Problema del proyecto 5', solution: 'Solución del proyecto 5' }
  ];

  const createdTeams = [];

  for (let i = 0; i < 5; i++) {
    const projectData = projectsData[i];
    const captainData = createdUsers.find(u => u.projectNum === i + 1 && u.isCaptain);
    const memberData = createdUsers.find(u => u.projectNum === i + 1 && !u.isCaptain);

    if (!captainData || !memberData) {
      throw new Error(`No se encontraron usuarios para el proyecto ${i + 1}`);
    }

    // Crear equipo
    await queryInterface.bulkInsert('teams', [
      {
        tenant_id: tenant.id,
        event_id: event.id,
        captain_id: captainData.userId,
        name: `Equipo UIC ${i + 1}`,
        description: `Equipo de prueba para el proyecto ${i + 1}`,
        requirements: 'Buscamos perfiles complementarios',
        status: 'open',
        created_at: now,
        updated_at: now
      }
    ]);

    const [[team]] = await queryInterface.sequelize.query(
      `SELECT id FROM teams WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND captain_id = ${captainData.userId} ORDER BY id DESC LIMIT 1`
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
        event_id: event.id,
        team_id: teamId,
        name: projectData.name,
        summary: projectData.summary,
        problem: projectData.problem,
        solution: projectData.solution,
        status: i === 4 ? 'inactive' : 'active', // Proyecto UIC 5 inactivo
        created_at: now,
        updated_at: now
      }
    ]);

    createdTeams.push({ teamId, projectData, captainData, memberData });
  }
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  const testUserEmails = testUsersData.map(u => u.email);

  // Eliminar proyectos, equipos y miembros
  const [[event]] = await queryInterface.sequelize.query(
    `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND name = 'SPP 2026' LIMIT 1`
  );

  if (event) {
    // Obtener equipos creados por estos usuarios
    const [teams] = await queryInterface.sequelize.query(
      `SELECT t.id FROM teams t 
       INNER JOIN users u ON t.captain_id = u.id 
       WHERE t.tenant_id = ${tenant.id} AND t.event_id = ${event.id} 
       AND u.email IN (${testUserEmails.map(e => `'${e}'`).join(', ')})`
    );

    const teamIds = teams.map(t => t.id);

    if (teamIds.length > 0) {
      await queryInterface.bulkDelete('projects', {
        tenant_id: tenant.id,
        team_id: teamIds
      });
      await queryInterface.bulkDelete('team_members', {
        tenant_id: tenant.id,
        team_id: teamIds
      });
      await queryInterface.bulkDelete('teams', {
        tenant_id: tenant.id,
        id: teamIds
      });
    }
  }

  // Eliminar roles y membresías
  const [userTenants] = await queryInterface.sequelize.query(
    `SELECT ut.id FROM user_tenants ut 
     INNER JOIN users u ON ut.user_id = u.id 
     WHERE ut.tenant_id = ${tenant.id} 
     AND u.email IN (${testUserEmails.map(e => `'${e}'`).join(', ')})`
  );

  const userTenantIds = userTenants.map(ut => ut.id);

  if (userTenantIds.length > 0) {
    await queryInterface.bulkDelete('user_tenant_roles', {
      tenant_id: tenant.id,
      user_tenant_id: userTenantIds
    });
    await queryInterface.bulkDelete('user_tenants', {
      tenant_id: tenant.id,
      id: userTenantIds
    });
  }

  // Eliminar usuarios
  await queryInterface.bulkDelete('users', {
    email: testUserEmails
  });
}

