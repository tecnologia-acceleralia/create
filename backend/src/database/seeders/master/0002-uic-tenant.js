import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeFileName,
  listEventAssetsFromS3,
  getMimeTypeFromFileName,
  buildPublicUrl
} from '../../../utils/s3-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_PASSWORD = 'UdS*r2ZD5?;O';

// Seeder maestro para registrar el tenant UIC junto con su evento SPP 2026.
// Dependencias: ninguna.
// IMPORTANTE: Este seeder es idempotente y maneja tanto columnas STRING como JSON (multiidioma).

/**
 * Normaliza un nombre de archivo para usar en marcadores (sin acentos)
 */
function normalizeAssetName(fileName) {
  return normalizeFileName(fileName);
}

export async function up(queryInterface) {
  // Verificar tipos de columnas para manejar formato JSON o STRING
  const eventsTableDesc = await queryInterface.describeTable('events').catch(() => ({}));
  const phasesTableDesc = await queryInterface.describeTable('phases').catch(() => ({}));
  const tasksTableDesc = await queryInterface.describeTable('tasks').catch(() => ({}));

  const isEventsNameJSON = eventsTableDesc.name && (eventsTableDesc.name.type === 'json' || eventsTableDesc.name.type?.includes('json') || eventsTableDesc.name.type === 'JSON');
  const isEventsDescriptionJSON = eventsTableDesc.description && (eventsTableDesc.description.type === 'text' || eventsTableDesc.description.type?.includes('text'));
  const isEventsDescriptionHtmlJSON = eventsTableDesc.description_html && (eventsTableDesc.description_html.type === 'text' || eventsTableDesc.description_html.type?.includes('text'));
  
  const isPhasesNameJSON = phasesTableDesc.name && (phasesTableDesc.name.type === 'json' || phasesTableDesc.name.type?.includes('json') || phasesTableDesc.name.type === 'JSON');
  const isPhasesDescriptionJSON = phasesTableDesc.description && (phasesTableDesc.description.type === 'text' || phasesTableDesc.description.type?.includes('text'));
  const isPhasesIntroHtmlJSON = phasesTableDesc.intro_html && (phasesTableDesc.intro_html.type === 'text' || phasesTableDesc.intro_html.type?.includes('text'));
  
  const isTasksTitleJSON = tasksTableDesc.title && (tasksTableDesc.title.type === 'json' || tasksTableDesc.title.type?.includes('json') || tasksTableDesc.title.type === 'JSON');
  const isTasksDescriptionJSON = tasksTableDesc.description && (tasksTableDesc.description.type === 'text' || tasksTableDesc.description.type?.includes('text'));
  const isTasksIntroHtmlJSON = tasksTableDesc.intro_html && (tasksTableDesc.intro_html.type === 'text' || tasksTableDesc.intro_html.type?.includes('text'));

  // Helper para convertir valores a JSON si es necesario
  const toJSONField = (value, isJSON) => {
    if (!isJSON) return value;
    if (value === null || value === undefined) return null;
    return JSON.stringify({ es: value, ca: value, en: value });
  };

  // Verificar si el tenant ya existe para hacer el seeder idempotente
  const [[existingTenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!existingTenant) {
    await queryInterface.bulkInsert('tenants', [
      {
        slug: 'uic',
        name: 'UIC Universitat Internacional de Catalunya',
        subdomain: 'uic',
        custom_domain: 'uicbarcelona.acceleralia.com',
        logo_url: 'https://acc-create-test.fra1.digitaloceanspaces.com/tenants/uic/branding/logo-1763364706619-26ef4de4-3091-4e9b-a154-20a1d4f42706.svg',
        primary_color: '#00416b',
        secondary_color: '#007bff',
        accent_color: '#007bff',
        hero_content: JSON.stringify({
          es: {
            title: 'Bienvenid@ al Startup Pioneer Program (SPP)',
            subtitle: 'Únete a los programas de innovación de la UIC y lleva tu proyecto al siguiente nivel.'
          },
          ca: {
            title: 'Benvingut/da al Startup Pioneer Program (SPP)',
            subtitle: 'Uneix-te als programes d\'innovació de la UIC i porta el teu projecte al següent nivell.'
          },
          en: {
            title: 'Welcome to the Startup Pioneer Program (SPP)',
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
      registration_schema: null,
      tenant_css: `:root {
  --radius: 0.85rem;
  --background: 204 100% 97%;
  --foreground: 210 28% 18%;
  --card: 204 100% 97%;
  --card-foreground: 210 28% 18%;
  --primary: 204 100% 21%;
  --primary-foreground: 0 0% 100%;
  --secondary: 211 100% 50%;
  --secondary-foreground: 0 0% 100%;
  --accent: 211 100% 50%;
  --accent-foreground: 0 0% 100%;
  --muted: 204 100% 97%;
  --muted-foreground: 210 20% 32%;
  --border: 204 35% 82%;
  --input: 204 35% 82%;
  --ring: 204 100% 21%;
}

.bg-gradient-to-r,
.bg-gradient-to-br,
.bg-gradient-to-b {
  background-image: none !important;
}

.backdrop-blur,
.backdrop-blur-sm,
.backdrop-blur-md,
.backdrop-blur-lg,
.backdrop-blur-xl,
.backdrop-blur-2xl,
.backdrop-blur-3xl {
  backdrop-filter: none !important;
}

.blur,
.blur-sm,
.blur-md,
.blur-lg,
.blur-xl,
.blur-2xl,
.blur-3xl {
  filter: none !important;
}
`,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  }

  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    throw new Error('No se pudo recuperar el tenant UIC después de insertarlo.');
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const now = new Date();

  await queryInterface.bulkInsert('roles', [
    {
      tenant_id: tenant.id,
      name: 'Administrador UIC',
      scope: 'tenant_admin',
      created_at: now,
      updated_at: now
    },
    {
      tenant_id: tenant.id,
      name: 'Participante',
      scope: 'participant',
      created_at: now,
      updated_at: now
    },
    {
      tenant_id: tenant.id,
      name: 'Capitán de equipo',
      scope: 'team_captain',
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
    'admin@uic.es',
    'Admin',
    'UIC',
    passwordHash,
    adminRole.id
  );

  // Crear fechas válidas para el evento
  const eventStart = new Date('2025-11-01T00:00:00.000Z');
  const eventEnd = new Date('2026-04-16T23:59:59.000Z');
  
  // Validar que las fechas sean válidas
  if (Number.isNaN(eventStart.getTime())) {
    throw new Error('Fecha de inicio del evento inválida');
  }
  if (Number.isNaN(eventEnd.getTime())) {
    throw new Error('Fecha de fin del evento inválida');
  }

  const phaseIntroStyles = `
<style>
  .uic-phase {
    background: linear-gradient(135deg, rgba(0, 65, 107, 0.08), rgba(0, 123, 255, 0.05));
    border: 1px solid rgba(0, 65, 107, 0.15);
    border-radius: 20px;
    padding: 2rem;
    margin: 0;
    box-shadow: 0 20px 40px -20px rgba(0, 65, 107, 0.5);
  }

  .uic-phase header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .uic-phase h2 {
    margin: 0;
    font-size: 1.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #00416b;
  }

  .uic-phase .phase-lead {
    font-size: 1.15rem;
    font-weight: 600;
    color: #002c45;
    margin: 0.5rem 0 1rem;
    line-height: 1.6;
  }

  .uic-phase h3 {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: #005a99;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .uic-phase h3::before {
    content: '✷';
    font-size: 0.9rem;
    color: #00a3ff;
  }

  .uic-phase p {
    margin: 0.6rem 0;
    line-height: 1.7;
  }

  .uic-phase ul,
  .uic-phase ol {
    list-style: none;
    padding: 0;
    margin: 1rem 0 0.5rem;
    display: grid;
    gap: 0.6rem;
  }

  .uic-phase li {
    position: relative;
    padding-left: 1.85rem;
    border-left: 2px solid rgba(0, 65, 107, 0.15);
    padding-top: 0.4rem;
    padding-bottom: 0.4rem;
  }

  .uic-phase ul li::before {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: -6px;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(135deg, #007bff, #00c2ff);
  }

  .uic-phase ol {
    counter-reset: uic-phase-counter;
  }

  .uic-phase ol li {
    counter-increment: uic-phase-counter;
    padding-left: 2.2rem;
  }

  .uic-phase ol li::before {
    content: counter(uic-phase-counter) '.';
    position: absolute;
    left: -0.4rem;
    top: 0.3rem;
    font-weight: 700;
    color: #00416b;
  }

  .uic-phase .phase-tasks {
    background: rgba(0, 65, 107, 0.05);
    border-left: 4px solid rgba(0, 65, 107, 0.5);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-top: 1rem;
  }

  .uic-phase .phase-tasks strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 0.6rem;
    color: #00416b;
  }

  .uic-phase .phase-note {
    background: rgba(0, 65, 107, 0.07);
    border-left: 4px solid rgba(0, 65, 107, 0.5);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-top: 1.25rem;
  }

  .uic-phase .phase-note strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 0.6rem;
    color: #00416b;
  }
</style>
`;

  const eventDescriptionHtml = `${phaseIntroStyles}<section class="uic-phase">
  <header>
  <h2>Programa SPP 2026</h2>
    <p class="phase-lead">El Startup Pioneer Program (SPP) es una actividad estratégica y transversal a todas facultades de UIC Barcelona, promovida y gestionada por el departamento de Desarrollo Personal y Cultura Institucional, la Facultad de Ciencias Económicas y Sociales, el HUB de Innovación con Impacto Social y Alumni que pretende impulsar la cultura emprendedora en UIC Barcelona.</p>
    <p class="phase-lead">El SPP busca fomentar el emprendimiento entre estudiantes de UIC Barcelona con la posibilidad de lanzar su idea de proyecto empresarial o de impacto social.</p>
    <p class="phase-lead">Alumnos de diferentes grados y másters, trabajan en equipo en proyectos de emprendimiento o de impacto social a través de la plataforma online, familiarizándose con el proceso creativo de desarrollar una idea de negocio.</p
  </header>

  <h3>Beneficios del SPP</h3>
  <ul>
    <li>Fomentar la mentalidad emprendedora entre el alumnado de la universidad, canalizando sus inquietudes emprendedoras y sociales.</li>
    <li>Desarrollar iniciativas que conecten con el ecosistema emprendedor barcelonés y catalán.</li>
    <li>Canalizar el potente flujo de innovación existente en el seno de la universidad.</li>
    <li>Posicionar a UIC Barcelona en su apuesta por el emprendimiento a través de proyectos de innovación e impacto social</li>
  </ul>

  <h3>¿Cómo participar?</h3>
  <p>Si has llegado hasta esta página seguramente ya estás inscrito en el concurso pero, por si acaso, aquí tienes las instrucciones para participar:</p>

  <ul>
    <li>Primero, inscríbete y/o crea un grupo, de un mínimo de 3 miembros y un máximo de 5.</li>
    <li>¿Tienes una idea? Pues descríbela brevemente en el formulario online. Puede ser un negocio o una iniciativa social.</li>
    <li>¿No tienes idea o grupo? No hay problema, apúntate a un proyecto ya creado.</li>
  </ul>

  <h3>Funcionamiento del concurso</h3>
  <p>El programa se divide en varias fases, cada una con objetivos específicos y entregables:</p>
  
  <div class="phase-note">
    <strong>Fase 0: Inscripción y descripción de la idea</strong>
    <ul>
      <li><strong>Inscripción:</strong> Los interesados presentan sus ideas de negocio y equipos. Deben proporcionar detalles sobre el concepto de su empresa, el mercado objetivo y el modelo de negocio.</li>
      <li><strong>Evaluación Inicial:</strong> El profesorado responsable de cada asignatura revisa las propuestas para garantizar la calidad de las mismas, según criterios de innovación, viabilidad, impacto social/económico y presentación.</li>
      <li><strong>Feedback:</strong> Los equipos reciben comentarios constructivos para mejorar sus propuestas.</li>
    </ul>
  </div>
  
  <div class="phase-note">
    <strong>Fase 1: Análisis de contexto del mercado</strong>
    <p>Aquí se evaluarán algunos aspectos clave del entorno y la actualidad para tener en cuenta en el éxito de los proyectos, tales como:</p>
    <ul>
      <li>Tamaño del mercado</li>
      <li>Valor del mercado</li>
      <li>Segmentación de cliente</li>
      <li>Competencia</li>
      <li>Entorno económico</li>
      <li>Tendencias actuales</li>
      <li>Regulaciones legales y culturales</li>
    </ul>
    <p><strong>Entregables:</strong> PORTER, PESTEL y el DAFO</p>
  </div>
  
  <div class="phase-note">
    <strong>Fase 2: Cuantificación de Mercado</strong>
    <p>Se explorará en los procesos que se utiliza en la investigación de mercado para entender cuántas personas compran un producto o servicio, o mantienen una cierta visión, y qué tan a menudo hacen esto.</p>
    <p><strong>Entregables:</strong> Cuantificación del mercado</p>
  </div>
  
  <div class="phase-note">
    <strong>Fase 3: La propuesta de valor</strong>
    <ul>
      <li>Entender cómo pueden aportar valor a sus clientes, cómo pueden aliviar sus frustraciones y qué productos o servicios se pueden ofrecer.</li>
      <li>Aprender a destacar en qué es mejor un negocio y cómo va a beneficiar eso a las personas que utilicen esos servicios o productos y no los de la competencia.</li>
    </ul>
    <p><strong>Entregables:</strong> Propuesta de valor</p>
  </div>
  
  <div class="phase-note">
    <strong>Fase 4: El Modelo de negocio</strong>
    <ul>
      <li>Comenzarás a describir de manera lógica la creación de tu emprendimiento describiendo cómo aporta valor en términos económicos, sociales, culturales u otros.</li>
      <li>En esta fase se definirán, la estrategia que deben emplearse en la búsqueda de los objetivos del negocio.</li>
      <li>Se distinguirá cuál es el valor de un producto, qué se necesita para insertarlo en el mercado y a qué tipo de clientes se dirigirá.</li>
    </ul>
    <p><strong>Entregables:</strong> Modelo de negocio</p>
  </div>
  
  <div class="phase-note">
    <strong>Fase 5: Presentación del proyecto</strong>
    <ul>
      <li><strong>Pitch:</strong> Los equipos acompañarán su proyecto de un video (pitch) de máximo 3' en que presentan su iniciativa.</li>
      <li><strong>Selección de proyectos por parte del Jurado:</strong> Un jurado compuesto por académicos y expertos del mundo del emprendimiento selecciona los proyectos finalistas en base a la calidad y originalidad de la idea.</li>
    </ul>
    <p><strong>Entregables:</strong> Presenta tu proyecto</p>
    <p>Posteriormente, el jurado seleccionará los proyectos finalistas.</p>
  </div>
  
  <div class="phase-note">
    <strong>Fase 6: Seguimiento y Apoyo Post-Concurso</strong>
    <ul>
      <li><strong>Mentoría Continua:</strong> Los equipos ganadores reciben mentoría a través de INCUIC y el Innovation Hub para ayudarlos a desarrollar su negocio.</li>
      <li>Se incluirá ayuda para validar el modelo de negocio, así como a iniciar el proceso de creación el MVP y la planificación del proyecto de llevar el negocio a la realidad.</li>
    </ul>
  </div>
  
  <div class="phase-tasks">
    <strong>Contacto</strong>
    <p>Para cualquier duda o ayuda que necesites sobre esta plataforma, contáctanos en <a href="mailto:support+create@acceleralia.com">support+create@acceleralia.com</a></p>
  </div>
</section>`;

  // Preparar valores según el tipo de columna
  const eventName = isEventsNameJSON
    ? JSON.stringify({ es: 'SPP 2026', ca: 'SPP 2026', en: 'SPP 2026' })
    : 'SPP 2026';
  const eventDescription = isEventsDescriptionJSON
    ? JSON.stringify({
        es: 'Bienvenid@ al Startup Pioneer Program (SPP)',
        ca: 'Benvingut/da al Startup Pioneer Program (SPP)',
        en: 'Welcome to the Startup Pioneer Program (SPP)'
      })
    : 'Bienvenid@ al Startup Pioneer Program (SPP)';
  const eventDescriptionHtmlValue = toJSONField(eventDescriptionHtml, isEventsDescriptionHtmlJSON);

  // Crear y validar fecha de publicación
  const publishStartAt = new Date('2025-07-01T00:00:00.000Z');
  if (Number.isNaN(publishStartAt.getTime())) {
    throw new Error('Fecha de inicio de publicación inválida');
  }

  await queryInterface.bulkInsert('events', [
    {
      tenant_id: tenant.id,
      created_by: adminUserId,
      name: eventName,
      description: eventDescription,
      description_html: eventDescriptionHtmlValue,
      start_date: eventStart,
      end_date: eventEnd,
      min_team_size: 2,
      max_team_size: 5,
      status: 'published',
      video_url: 'https://youtu.be/lVJ8-tPSNzA',
      is_public: true,
      allow_open_registration: true,
      publish_start_at: publishStartAt,
      publish_end_at: eventEnd,
      registration_schema: null,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  // Buscar el evento según el tipo de columna
  const eventQuery = isEventsNameJSON
    ? `SELECT id, start_date, end_date FROM events WHERE tenant_id = ${tenant.id} AND JSON_EXTRACT(name, '$.es') = 'SPP 2026' LIMIT 1`
    : `SELECT id, start_date, end_date FROM events WHERE tenant_id = ${tenant.id} AND name = 'SPP 2026' LIMIT 1`;
  
  const [[event]] = await queryInterface.sequelize.query(eventQuery);

  if (!event) {
    throw new Error('No se pudo recuperar el evento SPP 2026 del tenant UIC.');
  }

  const phaseNow = new Date();

  // Helper para convertir fechas a string 'YYYY-MM-DD' para campos DATEONLY
  const toDateOnlyString = (dateValue) => {
    if (!dateValue) return null;
    
    // Si ya es un string en formato 'YYYY-MM-DD', devolverlo
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    
    // Si es un string con formato MySQL datetime, extraer solo la fecha
    if (typeof dateValue === 'string') {
      const mysqlDateTimeMatch = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
      if (mysqlDateTimeMatch) {
        return mysqlDateTimeMatch[1];
      }
      
      // Intentar parsear como fecha
      const date = new Date(dateValue);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
    
    // Si es un objeto Date, convertirlo a string
    if (dateValue instanceof Date) {
      if (Number.isNaN(dateValue.getTime())) {
        return null;
      }
      return dateValue.toISOString().slice(0, 10);
    }
    
    return null;
  };
  
  // Helper para validar y crear fechas válidas como objetos Date para campos DATETIME
  const createValidDate = (dateValue, fallback = null) => {
    if (!dateValue) {
      if (fallback instanceof Date && !Number.isNaN(fallback.getTime())) {
        return fallback;
      }
      return fallback;
    }
    
    // Normalizar el formato de fecha: convertir "YYYY-MM-DD HH:MM:SS" a formato ISO
    let normalizedValue = dateValue;
    if (typeof dateValue === 'string') {
      const mysqlDateTimeMatch = dateValue.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
      if (mysqlDateTimeMatch) {
        normalizedValue = `${mysqlDateTimeMatch[1]}T${mysqlDateTimeMatch[2]}Z`;
      }
    }
    
    const date = new Date(normalizedValue);
    
    if (Number.isNaN(date.getTime())) {
      if (fallback instanceof Date && !Number.isNaN(fallback.getTime())) {
        return fallback;
      }
      return fallback;
    }
    
    return date;
  };

  const eventStartDate = event.start_date ? createValidDate(event.start_date, eventStart) : eventStart;
  const eventEndDate = event.end_date ? createValidDate(event.end_date, eventEnd) : eventEnd;
  
  // Asegurar que las fechas del evento sean válidas
  if (!eventStartDate || !(eventStartDate instanceof Date) || Number.isNaN(eventStartDate.getTime())) {
    throw new Error(`Fecha de inicio del evento inválida: ${event.start_date}`);
  }
  if (!eventEndDate || !(eventEndDate instanceof Date) || Number.isNaN(eventEndDate.getTime())) {
    throw new Error(`Fecha de fin del evento inválida: ${event.end_date}`);
  }

  // Cargar datos del JSON exportado
  // El archivo está en la misma carpeta que este seeder
  const jsonPath = path.join(__dirname, 'uic-phases-tasks-export-2025-11-23T12-30-13.json');
  let exportedData;
  try {
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    exportedData = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`Error al cargar el archivo JSON de fases y tareas: ${error.message}. Asegúrate de que el archivo existe en: ${jsonPath}`);
  }

  // Mapear fases del JSON exportado
  const phaseDefinitions = exportedData.phases.map((phase) => {
    // Convertir fechas DATETIME a objetos Date (todas las fechas de phases son DATETIME)
    const startDate = createValidDate(phase.start_date, null);
    const endDate = createValidDate(phase.end_date, null);
    const viewStartDate = createValidDate(phase.view_start_date, eventStartDate);
    const viewEndDate = createValidDate(phase.view_end_date, eventEndDate);
    
    // Validar que las fechas requeridas sean válidas
    if (!startDate || !(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
      throw new Error(`Fecha de inicio inválida para fase "${phase.name || phase.id}": ${phase.start_date}`);
    }
    if (!endDate || !(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
      throw new Error(`Fecha de fin inválida para fase "${phase.name || phase.id}": ${phase.end_date}`);
    }

    return {
      tenant_id: tenant.id,
      event_id: event.id,
      name: toJSONField(phase.name, isPhasesNameJSON),
      description: toJSONField(phase.description, isPhasesDescriptionJSON),
      intro_html: toJSONField(phase.intro_html || null, isPhasesIntroHtmlJSON),
      order_index: phase.order_index,
      is_elimination: phase.is_elimination || false,
      start_date: startDate,
      end_date: endDate,
      view_start_date: viewStartDate,
      view_end_date: viewEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    };
  });

  // phaseIntroHtml ya no se usa, se carga desde el JSON

  await queryInterface.bulkInsert('phases', phaseDefinitions);

  // Buscar fases según el tipo de columna
  const phaseQuery = isPhasesNameJSON
    ? `SELECT id, JSON_EXTRACT(name, '$.es') as name, end_date, order_index FROM phases WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} ORDER BY order_index`
    : `SELECT id, name, end_date, order_index FROM phases WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} ORDER BY order_index`;
  
  const [phaseRows] = await queryInterface.sequelize.query(phaseQuery);

  // Mapa de fases por order_index para relacionar con las tareas del JSON
  const phasesByOrderIndex = new Map(
    phaseRows.map((phase) => {
      return [phase.order_index, { id: phase.id, endDate: phase.end_date ? new Date(phase.end_date) : null }];
    })
  );

  const taskNow = new Date();

  // Mapear tareas del JSON exportado
  // Primero necesitamos crear un mapa de phase_id del JSON a order_index de las fases
  const phaseIdToOrderIndex = new Map();
  exportedData.phases.forEach((phase) => {
    phaseIdToOrderIndex.set(phase.id, phase.order_index);
  });

  const tasksToInsert = exportedData.tasks.map((task) => {
    // Obtener el order_index de la fase desde el JSON
    const phaseOrderIndex = phaseIdToOrderIndex.get(task.phase_id);
    if (!phaseOrderIndex) {
      throw new Error(`No se encontró la fase con id ${task.phase_id} en los datos exportados`);
    }

    // Obtener la fase insertada usando el order_index
    const phaseMeta = phasesByOrderIndex.get(phaseOrderIndex);
    if (!phaseMeta) {
      throw new Error(`No se encontró la fase con order_index ${phaseOrderIndex} después de insertarla`);
    }

    // Convertir fechas con validación
    const dueDate = createValidDate(task.due_date, phaseMeta.endDate);

    return {
      tenant_id: tenant.id,
      event_id: event.id,
      phase_id: phaseMeta.id,
      title: toJSONField(task.title, isTasksTitleJSON),
      description: toJSONField(task.description || null, isTasksDescriptionJSON),
      intro_html: toJSONField(task.intro_html || null, isTasksIntroHtmlJSON),
      delivery_type: task.delivery_type || 'file',
      is_required: task.is_required || false,
      due_date: dueDate,
      status: task.status || 'active',
      phase_rubric_id: null,
      max_files: task.max_files || 1,
      max_file_size_mb: task.max_file_size_mb || null,
      allowed_mime_types: task.allowed_mime_types || null,
      order_index: task.order_index || 1,
      created_at: taskNow,
      updated_at: taskNow
    };
  });

  // taskIntroHtml ya no se usa, se carga desde el JSON

  await queryInterface.bulkInsert('tasks', tasksToInsert);

  // ============================================================================
  // CONSOLIDACIÓN DE SEEDERS 0005-0014
  // ============================================================================

  // 1. Actualizar tenant con registration_schema, logo_url con ID, y enlaces sociales
  // (Consolidado de 0008, 0009, 0011)
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

  // Actualizar logo_url para usar ID del tenant en lugar de slug
  const [[tenantForUpdate]] = await queryInterface.sequelize.query(
    "SELECT id, slug, logo_url FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (tenantForUpdate && tenantForUpdate.logo_url) {
    const urlWithTenantId = `/tenants/${tenantForUpdate.id}/branding/`;
    if (!tenantForUpdate.logo_url.includes(urlWithTenantId)) {
      const logoFileName = tenantForUpdate.logo_url.split('/').pop();
      const baseUrl = tenantForUpdate.logo_url.substring(0, tenantForUpdate.logo_url.indexOf('/tenants/'));
      const updatedLogoUrl = `${baseUrl}/tenants/${tenantForUpdate.id}/branding/${logoFileName}`;

      await queryInterface.sequelize.query(
        `UPDATE tenants SET 
          registration_schema = :schema,
          logo_url = :logoUrl,
          website_url = :websiteUrl,
          linkedin_url = :linkedinUrl,
          twitter_url = :twitterUrl,
          facebook_url = :facebookUrl,
          instagram_url = :instagramUrl,
          updated_at = NOW() 
        WHERE id = :tenantId`,
        {
          replacements: {
            schema: JSON.stringify(registrationSchema),
            logoUrl: updatedLogoUrl,
            websiteUrl: 'https://www.uic.es/',
            linkedinUrl: 'https://www.linkedin.com/school/universitat-internacional-de-catalunya-uic/',
            twitterUrl: 'https://twitter.com/uicbarcelona?lang=es',
            facebookUrl: 'https://es-la.facebook.com/UICbarcelona/',
            instagramUrl: 'https://www.instagram.com/uicbarcelona/?hl=es',
            tenantId: tenantForUpdate.id
          }
        }
      );
    } else {
      // Solo actualizar registration_schema y enlaces sociales si logo_url ya está correcto
      await queryInterface.sequelize.query(
        `UPDATE tenants SET 
          registration_schema = :schema,
          website_url = :websiteUrl,
          linkedin_url = :linkedinUrl,
          twitter_url = :twitterUrl,
          facebook_url = :facebookUrl,
          instagram_url = :instagramUrl,
          updated_at = NOW() 
        WHERE id = :tenantId`,
        {
          replacements: {
            schema: JSON.stringify(registrationSchema),
            websiteUrl: 'https://www.uic.es/',
            linkedinUrl: 'https://www.linkedin.com/school/universitat-internacional-de-catalunya-uic/',
            twitterUrl: 'https://twitter.com/uicbarcelona?lang=es',
            facebookUrl: 'https://es-la.facebook.com/UICbarcelona/',
            instagramUrl: 'https://www.instagram.com/uicbarcelona/?hl=es',
            tenantId: tenantForUpdate.id
          }
        }
      );
    }
  }

  // Configurar prompt de IA y parámetros OpenAI (Consolidado de 0013)
  const tableDescription = await queryInterface.describeTable('events').catch(() => ({}));
  const hasAIPrompt = tableDescription.ai_evaluation_prompt !== undefined;
  const hasOpenAIColumns = tableDescription.ai_evaluation_model !== undefined;

  if (hasAIPrompt) {
    const defaultPrompt = `Eres un asistente evaluador de proyectos de emprendimiento para alumnado de formación.

Tu tarea es **evaluar proyectos entregados por el alumnado** siguiendo EXCLUSIVAMENTE la rúbrica proporcionada.

INSTRUCCIONES DE EVALUACIÓN
---------------------------

1. Lee atentamente la información del proyecto que te proporcione el usuario. Puede incluir:
   - Descripción general del proyecto.
   - Modelo de negocio.
   - Impacto social.
   - Documentación entregada (memoria, presentaciones, etc.).
   - Información sobre el equipo.

2. Recorre TODOS los criterios definidos en la rúbrica. Para cada criterio:
   - Ten en cuenta su descripción para entender qué aspecto del proyecto evalúa.
   - Compara el contenido del proyecto con los niveles posibles de ese criterio.
   - Selecciona un score dentro del rango permitido (según scaleMin, scaleMax o maxScore del criterio), eligiendo el nivel que mejor se ajuste al proyecto.
   - Identifica, de forma breve:
       - 1–3 fortalezas relacionadas con ese criterio (si las hay).
       - 1–3 aspectos de mejora concretos (si procede).

3. Cálculo de la nota global:
   - La nota global se calcula como la **media ponderada** de los criterios:
       - \`nota_global = SUMATORIO(score_criterio * peso_porcentaje/100)\`.
   - Las puntuaciones deben respetar el rango definido por la rúbrica (scaleMin, scaleMax o maxScore por criterio si está presente).
   - No redondees hasta el final. Al mostrar las notas, puedes usar 2 decimales.

4. Manejo de información insuficiente:
   - Si para algún criterio la información del proyecto es claramente insuficiente:
       - Asigna el nivel que mejor se ajuste, pero deja claro en la justificación que la información es limitada.
       - Si realmente no puedes evaluar, indica \`score: null\` y explícalo en la justificación.
   - Nunca inventes datos que el proyecto no proporcione.

5. Tono y estilo:
   - Usa un tono **pedagógico, claro y constructivo**.
   - Dirígete al profesorado, no al alumnado directamente (por ejemplo: "El proyecto presenta…", "Se observa que…").
   - Sé concreto: evita frases vacías tipo "podría mejorar en algunos aspectos" sin decir cuáles.

FORMATO DE RESPUESTA
--------------------

Responde SIEMPRE **solo** con un JSON válido (sin texto adicional fuera del JSON), con esta estructura:

{
  "resumen": {
    "nombre_rubrica": "<texto>",
    "nota_global": <número>,
    "comentario_global": "<comentario general de máximo 8-10 líneas, resumiendo puntos fuertes y principales áreas de mejora del proyecto>"
  },
  "criterios": [
    {
      "criterionId": <número, id del criterio>,
      "nombre": "<nombre legible del criterio>",
      "peso_porcentaje": <número>,
      "score": <número dentro del rango permitido o null si no se puede evaluar>,
      "justificacion": "<explicación breve de por qué has asignado ese nivel, máximo 4-6 líneas>",
      "fortalezas": [
        "<fortaleza 1 relacionada con este criterio>",
        "<fortaleza 2 (opcional)>",
        "<fortaleza 3 (opcional)>"
      ],
      "mejoras": [
        "<mejora concreta 1 relacionada con este criterio>",
        "<mejora concreta 2 (opcional)>",
        "<mejora concreta 3 (opcional)>"
      ]
    }
    // ... repetir un objeto por cada criterio de la rúbrica en el mismo orden en el que aparecen
  ]
}

REGLAS IMPORTANTES
------------------

- Usa SIEMPRE los criterios, pesos y niveles del archivo de rúbrica proporcionado.
- No modifiques ni inventes nuevos criterios o pesos.
- No des consejos genéricos que no estén vinculados al contenido concreto del proyecto.
- No salgas nunca del formato JSON especificado.
- Si el usuario no proporciona ningún contenido de proyecto, responde con \`nota_global = null\` y justifica en cada criterio que no hay información suficiente para evaluar.
- Idioma requerido para la respuesta: español.`;

    const [events] = await queryInterface.sequelize.query(
      `SELECT id, name FROM events WHERE tenant_id = ${tenant.id}`
    );

    for (const eventItem of events) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT ai_evaluation_prompt FROM events WHERE id = ${eventItem.id} LIMIT 1`
      );

      const hasPrompt = existing && existing[0] && existing[0].ai_evaluation_prompt && 
                        existing[0].ai_evaluation_prompt.trim().length > 0;

      if (!hasPrompt) {
        const updateFields = ['ai_evaluation_prompt = :prompt'];
        const replacements = { prompt: defaultPrompt, eventId: eventItem.id };

        if (hasOpenAIColumns) {
          updateFields.push('ai_evaluation_model = :model');
          updateFields.push('ai_evaluation_temperature = :temperature');
          updateFields.push('ai_evaluation_max_tokens = :maxTokens');
          updateFields.push('ai_evaluation_top_p = :topP');
          updateFields.push('ai_evaluation_frequency_penalty = :frequencyPenalty');
          updateFields.push('ai_evaluation_presence_penalty = :presencePenalty');
          replacements.model = 'gpt-4o-mini';
          replacements.temperature = 0.2;
          replacements.maxTokens = 1200;
          replacements.topP = 1;
          replacements.frequencyPenalty = 0;
          replacements.presencePenalty = 0;
        }

        await queryInterface.sequelize.query(
          `UPDATE events SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = :eventId`,
          { replacements }
        );
      }
    }
  }

  // Crear assets desde S3 (Consolidado de 0005)
  const [[adminUserForAssets]] = await queryInterface.sequelize.query(
    "SELECT id FROM users WHERE email = 'admin@uic.es' LIMIT 1"
  );

  if (adminUserForAssets && event) {
    try {
      const s3Objects = await listEventAssetsFromS3(tenant.id, event.id);

      if (s3Objects.length > 0) {
        const mappedAssets = s3Objects.map(s3Object => {
          const normalizedName = normalizeFileName(s3Object.fileName);
          return {
            ...s3Object,
            assetName: normalizedName,
            originalFileName: normalizedName
          };
        });

        for (const asset of mappedAssets) {
          const [existingAssets] = await queryInterface.sequelize.query(
            `SELECT id FROM event_assets WHERE tenant_id = :tenantId AND event_id = :eventId AND name = :assetName LIMIT 1`,
            {
              replacements: {
                tenantId: tenant.id,
                eventId: event.id,
                assetName: asset.assetName
              }
            }
          );

          if (existingAssets.length === 0) {
            const s3Url = buildPublicUrl(asset.s3Key);
            if (s3Url) {
              const mimeType = getMimeTypeFromFileName(asset.originalFileName);
              const now = asset.lastModified || new Date();

              // Generar descripción basada en el nombre del archivo (Consolidado de 0012)
              let description = asset.originalFileName || asset.assetName || asset.fileName || '';
              if (!description) {
                description = 'Asset sin nombre';
              }
              const lastDotIndex = description.lastIndexOf('.');
              if (lastDotIndex > 0) {
                description = description.substring(0, lastDotIndex);
              }
              description = description.replace(/[_-]/g, ' ');
              description = description
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ')
                .trim();
              if (description.length > 500) {
                description = description.substring(0, 497) + '...';
              }

              await queryInterface.bulkInsert(
                'event_assets',
                [
                  {
                    tenant_id: tenant.id,
                    event_id: event.id,
                    name: asset.assetName,
                    original_filename: asset.originalFileName,
                    s3_key: asset.s3Key,
                    url: s3Url,
                    mime_type: mimeType,
                    file_size: asset.fileSize,
                    description: description,
                    uploaded_by: adminUserForAssets.id,
                    created_at: now,
                    updated_at: now
                  }
                ]
              );
            }
          }
        }
      }
    } catch (error) {
      console.log(`⚠ No se pudieron cargar assets desde S3: ${error.message}`);
    }
  }

  // 5. Crear rúbricas de fase (Consolidado de 0006)
  const [phasesForRubrics] = await queryInterface.sequelize.query(
    `SELECT id, name FROM phases WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} ORDER BY order_index`
  );

  const rubricsByPhase = {
    'Fase 0': {
      name: 'Rúbrica de evaluación - Fase 0: Inscripción y descripción de la idea',
      description: 'Criterios de evaluación para la fase inicial de inscripción y descripción del proyecto.',
      criteria: [
        {
          title: 'Claridad y definición de la idea',
          description: 'La idea de negocio está claramente definida y es comprensible. Se describe de manera concisa el concepto, el problema que resuelve y la solución propuesta.',
          weight: 1,
          max_score: 25,
          order_index: 1
        },
        {
          title: 'Identificación del mercado objetivo',
          description: 'Se identifica claramente el mercado objetivo, incluyendo segmentación de clientes y necesidades específicas que se pretenden satisfacer.',
          weight: 1,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Modelo de negocio inicial',
          description: 'Se presenta un modelo de negocio inicial coherente, aunque sea básico, que explique cómo se generará valor y se capturará ingresos.',
          weight: 1,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Composición y complementariedad del equipo',
          description: 'El equipo está formado correctamente (mínimo 3 miembros, máximo 5) y muestra complementariedad de perfiles y habilidades necesarias para el proyecto.',
          weight: 1,
          max_score: 25,
          order_index: 4
        }
      ]
    },
    'Fase 1': {
      name: 'Rúbrica de evaluación - Fase 1: Análisis de mercado y fuerzas de Porter',
      description: 'Criterios de evaluación para el análisis de mercado, fuerzas de Porter, PESTEL y DAFO.',
      criteria: [
        {
          title: 'Análisis de mercado y fuerzas de Porter',
          description: 'Análisis completo y riguroso de las cinco fuerzas de Porter (poder de clientes, proveedores, amenaza de sustitutivos, nuevos competidores y rivalidad). Identificación clara de oportunidades y amenazas competitivas.',
          weight: 1,
          max_score: 30,
          order_index: 1
        },
        {
          title: 'Análisis PESTEL',
          description: 'Evaluación exhaustiva de factores políticos, económicos, socioculturales, tecnológicos, ecológicos y legales relevantes para el proyecto. Identificación de impactos potenciales y acciones preventivas.',
          weight: 1,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Análisis DAFO',
          description: 'Identificación precisa de fortalezas, debilidades, oportunidades y amenazas. Priorización de hallazgos relevantes y definición de estrategias accionables basadas en el análisis.',
          weight: 1,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Integración y coherencia del análisis',
          description: 'Los diferentes análisis (Porter, PESTEL, DAFO) están integrados y muestran coherencia. Se identifican conexiones entre los diferentes elementos y se derivan conclusiones estratégicas claras.',
          weight: 1,
          max_score: 20,
          order_index: 4
        }
      ]
    },
    'Fase 2': {
      name: 'Rúbrica de evaluación - Fase 2: Cuantificación del mercado',
      description: 'Criterios de evaluación para la cuantificación del mercado (TAM, SAM, SOM).',
      criteria: [
        {
          title: 'Cálculo de TAM (Total Available Market)',
          description: 'Estimación precisa del mercado total disponible, con fuentes de datos confiables y metodología clara. Incluye análisis de barreras que limitan el acceso al mercado.',
          weight: 1,
          max_score: 30,
          order_index: 1
        },
        {
          title: 'Cálculo de SAM (Serviceable Available Market)',
          description: 'Identificación correcta del segmento de mercado que puede ser atendido con la propuesta actual. Justificación clara de las limitaciones que definen el SAM.',
          weight: 1,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Cálculo de SOM (Serviceable Obtainable Market)',
          description: 'Estimación realista de la participación de mercado alcanzable a corto plazo. Incluye análisis de capacidad operativa, recursos disponibles y estrategia de entrada.',
          weight: 1,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Metodología y fuentes de datos',
          description: 'Uso de metodologías apropiadas para la cuantificación. Fuentes de datos confiables y actualizadas. Documentación clara de los cálculos y supuestos utilizados.',
          weight: 1,
          max_score: 20,
          order_index: 4
        }
      ]
    },
    'Fase 3': {
      name: 'Rúbrica de evaluación - Fase 3: Propuesta de valor',
      description: 'Criterios de evaluación para la propuesta de valor y diferenciación competitiva.',
      criteria: [
        {
          title: 'Definición de la propuesta de valor',
          description: 'La propuesta de valor está claramente articulada, conectando el problema del cliente con la solución ofrecida. Se identifican beneficios funcionales, emocionales y sociales.',
          weight: 1,
          max_score: 30,
          order_index: 1
        },
        {
          title: 'Diferenciación competitiva',
          description: 'Se identifica claramente qué hace único al proyecto y cómo se diferencia de la competencia. La propuesta de valor es distintiva y difícil de replicar.',
          weight: 1,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Alineación con segmento de clientes',
          description: 'La propuesta de valor está perfectamente alineada con las necesidades, motivaciones y frustraciones del segmento de clientes identificado. Evidencia de investigación de mercado.',
          weight: 1,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Comunicación y claridad',
          description: 'La propuesta de valor se comunica de manera clara, concisa y memorable. Está conectada con la misión, visión y valores del proyecto.',
          weight: 1,
          max_score: 20,
          order_index: 4
        }
      ]
    },
    'Fase 4': {
      name: 'Rúbrica de evaluación - Fase 4: Modelo de negocio',
      description: 'Criterios de evaluación para el Business Model Canvas y la ventaja competitiva.',
      criteria: [
        {
          title: 'Completitud del Business Model Canvas',
          description: 'Todos los bloques del canvas están completados de manera coherente: segmentos de clientes, propuesta de valor, canales, relaciones, flujos de ingresos, recursos clave, actividades clave, alianzas y estructura de costes.',
          weight: 1,
          max_score: 35,
          order_index: 1
        },
        {
          title: 'Modelo de ingresos',
          description: 'Los flujos de ingresos están claramente definidos y son viables. Se explica cómo se captura valor y se generan ingresos de manera sostenible.',
          weight: 1,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Recursos y actividades clave',
          description: 'Identificación precisa de los recursos y actividades necesarios para entregar la propuesta de valor. Análisis de viabilidad operativa y de recursos disponibles.',
          weight: 1,
          max_score: 20,
          order_index: 3
        },
        {
          title: 'Ventaja competitiva sostenible',
          description: 'Identificación de ventajas competitivas internas y externas. Análisis de sostenibilidad y dificultad de réplica por parte de la competencia.',
          weight: 1,
          max_score: 20,
          order_index: 4
        }
      ]
    },
    'Fase 5': {
      name: 'Rúbrica de evaluación - Fase 5: Presenta tu proyecto',
      description: 'Criterios de evaluación para el pitch y presentación del proyecto.',
      criteria: [
        {
          title: 'Estructura y narrativa del pitch',
          description: 'El pitch tiene una estructura clara con principio, nudo y cierre. La narrativa es coherente, memorable y conecta problema, cliente y solución de manera efectiva.',
          weight: 1,
          max_score: 30,
          order_index: 1
        },
        {
          title: 'Comunicación visual y diseño',
          description: 'La presentación visual es profesional, con diseño claro y atractivo. Cumple con las mejores prácticas (máximo 6 palabras por diapositiva, tipografía legible, imágenes potentes).',
          weight: 1,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Contenido y argumentación',
          description: 'El contenido del pitch cubre los aspectos clave: problema, solución, mercado, modelo de negocio y propuesta de valor. Los argumentos están respaldados por los análisis previos.',
          weight: 1,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Calidad del vídeo y presentación',
          description: 'El vídeo del pitch es de calidad profesional, con buena producción audiovisual. La presentación es fluida, natural y demuestra dominio del proyecto. Duración adecuada (3-5 minutos).',
          weight: 1,
          max_score: 20,
          order_index: 4
        }
      ]
    },
    'Fase 6': {
      name: 'Rúbrica de evaluación - Fase 6: Validación, MVP y roadmap',
      description: 'Criterios de evaluación para la validación del modelo de negocio, MVP y planificación.',
      criteria: [
        {
          title: 'Validación del modelo de negocio',
          description: 'Evidencia de validación con clientes reales o potenciales. Incluye resultados de encuestas, entrevistas o pruebas piloto que confirmen problema, solución y modelo de ingresos.',
          weight: 1,
          max_score: 30,
          order_index: 1
        },
        {
          title: 'Diseño y planificación del MVP',
          description: 'Definición clara del producto mínimo viable, con identificación de funcionalidades esenciales. Planificación de experimentos para validar hipótesis críticas con recursos mínimos.',
          weight: 1,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Roadmap y planificación (Diagrama de Gantt)',
          description: 'Planificación detallada con diagrama de Gantt que incluye tareas, dependencias, responsables y fechas. Identificación de ruta crítica y gestión de recursos.',
          weight: 1,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Viabilidad y ejecución',
          description: 'El plan de validación y desarrollo del MVP es realista y ejecutable. Se identifican recursos necesarios, riesgos potenciales y estrategias de mitigación.',
          weight: 1,
          max_score: 20,
          order_index: 4
        }
      ]
    }
  };

  // Helper para obtener nombre de fase (puede ser JSON o string)
  const getPhaseName = (phase) => {
    if (isPhasesNameJSON) {
      try {
        const nameObj = typeof phase.name === 'string' ? JSON.parse(phase.name) : phase.name;
        return nameObj?.es || nameObj?.ca || nameObj?.en || phase.name;
      } catch {
        return phase.name;
      }
    }
    return phase.name;
  };

  for (const phase of phasesForRubrics) {
    const phaseName = getPhaseName(phase);
    const rubricDef = rubricsByPhase[phaseName];

    if (!rubricDef) {
      continue;
    }

    const [[existingRubric]] = await queryInterface.sequelize.query(
      `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND phase_id = ${phase.id} LIMIT 1`
    );

    if (!existingRubric) {
      await queryInterface.bulkInsert('phase_rubrics', [
        {
          tenant_id: tenant.id,
          event_id: event.id,
          phase_id: phase.id,
          rubric_scope: 'phase',
          name: rubricDef.name,
          description: rubricDef.description,
          scale_min: 0,
          scale_max: 100,
          model_preference: null,
          created_by: adminUserId,
          updated_by: adminUserId,
          created_at: now,
          updated_at: now
        }
      ]);

      const [[rubric]] = await queryInterface.sequelize.query(
        `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND phase_id = ${phase.id} ORDER BY created_at DESC LIMIT 1`
      );

      if (rubric) {
        const criteriaToInsert = rubricDef.criteria.map((criterion) => ({
          tenant_id: tenant.id,
          rubric_id: rubric.id,
          title: criterion.title,
          description: criterion.description,
          weight: criterion.weight,
          max_score: criterion.max_score,
          order_index: criterion.order_index,
          created_at: now,
          updated_at: now
        }));

        await queryInterface.bulkInsert('phase_rubric_criteria', criteriaToInsert);
      }
    }
  }

  // 6. Crear rúbrica final del proyecto (Consolidado de 0007)
  const [[existingFinalRubric]] = await queryInterface.sequelize.query(
    `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND rubric_scope = 'project' LIMIT 1`
  );

  if (!existingFinalRubric) {
    const finalRubric = {
      name: 'Rúbrica de evaluación de proyectos de emprendeduría',
      description: 'Rúbrica final para evaluar el proyecto completo y todas sus entregas. Escala de 1-5 puntos por criterio.',
      scale_min: 1,
      scale_max: 5,
      criteria: [
        {
          title: 'Impacto social',
          description: 'Evalúa en qué medida el proyecto responde a una necesidad real y la capacidad de generar beneficios sociales tangibles, sostenibles y de alcance significativo, así como su grado de relación y coherencia con el tema de la edición y la adaptación del proyecto a dicho enfoque.',
          weight: 20,
          max_score: 5,
          order_index: 1
        },
        {
          title: 'Originalidad de la idea',
          description: 'Valora el grado de innovación, creatividad y diferenciación de la propuesta respecto a lo existente en el mercado o en su ámbito de actuación. Analiza si la idea aporta una perspectiva nueva, una solución creativa o un enfoque alternativo frente a las opciones actuales, así como la capacidad del equipo para aprovechar tendencias, tecnologías o combinaciones originales de recursos que generen valor añadido.',
          weight: 15,
          max_score: 5,
          order_index: 2
        },
        {
          title: 'Potencial/Viabilidad / Factibilidad',
          description: 'Mide la viabilidad del modelo de negocio, su sostenibilidad económica y operativa, y las posibilidades de crecimiento o escalabilidad del proyecto. Evalúa la claridad del modelo de ingresos, la coherencia entre los recursos y los objetivos, y la capacidad del equipo para implementar el proyecto en el tiempo y contexto previstos.',
          weight: 25,
          max_score: 5,
          order_index: 3
        },
        {
          title: 'Calidad de los entregables',
          description: 'Examina la completitud, claridad, organización y presentación profesional de los materiales entregados (documentos, presentaciones, informes u otros). Evalúa tanto la forma (estructuración, formato, lenguaje y diseño) como el fondo (coherencia, rigor y capacidad de síntesis), reflejando el nivel de preparación y cuidado en la ejecución del trabajo.',
          weight: 10,
          max_score: 5,
          order_index: 4
        },
        {
          title: 'Presentación',
          description: 'Considera la preparación, claridad, estructura, lenguaje corporal y capacidad de comunicación para transmitir el proyecto de manera convincente y conectar con la audiencia. Evalúa la capacidad del equipo para sintetizar, argumentar y responder preguntas con seguridad y coherencia, así como el uso de recursos visuales o narrativos para reforzar el mensaje.',
          weight: 10,
          max_score: 5,
          order_index: 5
        },
        {
          title: 'Equipo emprendedor',
          description: 'Evalúa la organización, cohesión, motivación y complementariedad del equipo, así como la existencia de liderazgo, visión compartida y compromiso para llevar adelante el proyecto. Considera la distribución de roles, la colaboración efectiva y la capacidad de aprendizaje y adaptación del grupo.',
          weight: 20,
          max_score: 5,
          order_index: 6
        }
      ]
    };

    await queryInterface.bulkInsert('phase_rubrics', [
      {
        tenant_id: tenant.id,
        event_id: event.id,
        phase_id: null,
        rubric_scope: 'project',
        name: finalRubric.name,
        description: finalRubric.description,
        scale_min: finalRubric.scale_min,
        scale_max: finalRubric.scale_max,
        model_preference: null,
        created_by: adminUserId,
        updated_by: adminUserId,
        created_at: now,
        updated_at: now
      }
    ]);

    const [[rubric]] = await queryInterface.sequelize.query(
      `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND rubric_scope = 'project' ORDER BY created_at DESC LIMIT 1`
    );

    if (rubric) {
      const criteriaToInsert = finalRubric.criteria.map((criterion) => ({
        tenant_id: tenant.id,
        rubric_id: rubric.id,
        title: criterion.title,
        description: criterion.description,
        weight: criterion.weight,
        max_score: criterion.max_score,
        order_index: criterion.order_index,
        created_at: now,
        updated_at: now
      }));

      await queryInterface.bulkInsert('phase_rubric_criteria', criteriaToInsert);
    }
  }
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  // Verificar si la columna name es JSON (multiidioma) o STRING
  const eventsTableDesc = await queryInterface.describeTable('events').catch(() => ({}));
  const isEventsNameJSON = eventsTableDesc.name && (eventsTableDesc.name.type === 'json' || eventsTableDesc.name.type?.includes('json') || eventsTableDesc.name.type === 'JSON');

  // Buscar el evento según el tipo de columna
  const eventQuery = isEventsNameJSON
    ? `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND JSON_EXTRACT(name, '$.es') = 'SPP 2026' LIMIT 1`
    : `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND name = 'SPP 2026' LIMIT 1`;
  
  const [[event]] = await queryInterface.sequelize.query(eventQuery);

  if (event) {
    // Eliminar rúbricas y sus criterios
    const [rubrics] = await queryInterface.sequelize.query(
      `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id}`
    );

    if (rubrics && rubrics.length > 0) {
      const rubricIds = rubrics.map((r) => r.id).join(',');
      await queryInterface.sequelize.query(
        `DELETE FROM phase_rubric_criteria WHERE rubric_id IN (${rubricIds})`
      );
      await queryInterface.bulkDelete('phase_rubrics', {
        tenant_id: tenant.id,
        event_id: event.id
      });
    }

    // Eliminar assets
    await queryInterface.bulkDelete('event_assets', {
      tenant_id: tenant.id,
      event_id: event.id
    });

    // Eliminar tareas, fases y evento
    await queryInterface.bulkDelete('tasks', { tenant_id: tenant.id, event_id: event.id });
    await queryInterface.bulkDelete('phases', { tenant_id: tenant.id, event_id: event.id });
    await queryInterface.bulkDelete('events', { tenant_id: tenant.id, id: event.id });
  }

  const [[adminUser]] = await queryInterface.sequelize.query(
    "SELECT id FROM users WHERE email = 'admin@uic.es' LIMIT 1"
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

  await queryInterface.bulkDelete('users', { email: 'admin@uic.es' });
  await queryInterface.bulkDelete('roles', { tenant_id: tenant.id, scope: 'tenant_admin' });

  // Revertir cambios del tenant (registration_schema, logo_url, enlaces sociales)
  await queryInterface.sequelize.query(
    `UPDATE tenants SET 
      registration_schema = NULL,
      logo_url = NULL,
      website_url = NULL,
      linkedin_url = NULL,
      twitter_url = NULL,
      facebook_url = NULL,
      instagram_url = NULL,
      updated_at = NOW() 
    WHERE id = :tenantId`,
    {
      replacements: {
        tenantId: tenant.id
      }
    }
  );

  await queryInterface.bulkDelete('tenants', { id: tenant.id });
}
