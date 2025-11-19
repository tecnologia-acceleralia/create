import bcrypt from 'bcryptjs';
import { normalizeFileName } from '../../../utils/s3-utils.js';

const ADMIN_PASSWORD = 'UdS*r2ZD5?;O';

// Seeder maestro para registrar el tenant UIC junto con su evento SPP 2026.
// Dependencias: ninguna.

/**
 * Normaliza un nombre de archivo para usar en marcadores (sin acentos)
 */
function normalizeAssetName(fileName) {
  return normalizeFileName(fileName);
}

export async function up(queryInterface) {
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

  const eventStart = new Date('2025-11-01T00:00:00.000Z');
  const eventEnd = new Date('2026-04-16T23:59:59.000Z');

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

  await queryInterface.bulkInsert('events', [
    {
      tenant_id: tenant.id,
      created_by: adminUserId,
      name: 'SPP 2026',
      description: 'Bienvenid@ al Startup Pioneer Program (SPP)',
      description_html: eventDescriptionHtml,
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
      registration_schema: JSON.stringify({
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
      }),
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

  const wrapPhaseIntro = (content) => `${phaseIntroStyles}${content}`;

  const phaseIntroHtml = {
    'Fase 0': wrapPhaseIntro(`<section class="uic-phase">
  <header>
    <h2>Fase 0: Crea o únete a un proyecto</h2>
    <p class="phase-lead">El punto de partida de tu viaje emprendedor. Define tu idea, forma tu equipo y prepárate para transformar tu visión en realidad.</p>
  </header>

  <div class="phase-note">
    <strong>Objetivo de la fase</strong>
    <p>Esta fase inicial es fundamental para establecer las bases de tu proyecto. Aquí definirás tu idea de negocio, identificarás a tus compañeros de equipo y prepararás la documentación necesaria para comenzar el programa SPP.</p>
  </div>

  <h3>Actividades principales</h3>
  <ul>
    <li><strong>Inscripción y descripción de la idea:</strong> Presenta tu concepto de negocio, define tu mercado objetivo y describe tu modelo de negocio inicial. Esta actividad es obligatoria y constituye el primer paso formal del programa.</li>
  </ul>

  <div class="phase-tasks">
    <strong>¿Qué necesitas hacer?</strong>
    <ul>
      <li>Si tienes una idea: descríbela brevemente en el formulario online. Puede ser un negocio o una iniciativa social.</li>
      <li>Si no tienes idea o grupo: no hay problema, puedes unirte a un proyecto ya creado por otros participantes.</li>
      <li>Forma tu equipo: mínimo 3 miembros, máximo 5. Asegúrate de tener perfiles complementarios.</li>
    </ul>
  </div>

  <p>Una vez completada esta fase, estarás listo para comenzar el análisis estratégico de tu proyecto en las siguientes fases del programa.</p>
</section>`),
    'Fase 1': wrapPhaseIntro(`<section class="uic-phase">
  <header>
    <h2>Fase 1: Análisis de mercado y fuerzas de Porter</h2>
    <p class="phase-lead">Sumérgete en el ecosistema competitivo de tu proyecto. Comprende el mercado, identifica oportunidades y anticipa desafíos con herramientas estratégicas probadas.</p>
  </header>

  <div class="phase-note">
    <strong>Objetivo de la fase</strong>
    <p>En esta fase desarrollarás una comprensión profunda del entorno en el que operará tu proyecto. A través de análisis estructurados, identificarás las fuerzas que moldean tu industria, los factores externos que pueden impactar tu negocio y las fortalezas y debilidades de tu propuesta.</p>
  </div>

  <h3>Actividades principales</h3>
  <ul>
    <li><strong>Análisis de mercado y fuerzas de Porter:</strong> Explora el ecosistema competitivo para anticipar riesgos y encontrar oportunidades. Analiza las cinco fuerzas que determinan la rentabilidad de tu sector.</li>
    <li><strong>PESTEL:</strong> Evalúa el contexto externo (político, económico, sociocultural, tecnológico, ecológico y legal) para anticipar factores que pueden acelerar o frenar tu crecimiento.</li>
    <li><strong>Análisis DAFO:</strong> Identifica tus fortalezas, debilidades, oportunidades y amenazas para desarrollar estrategias efectivas.</li>
  </ul>

  <h3>Actividades opcionales</h3>
  <ul>
    <li><strong>El mercado y el cliente:</strong> Profundiza en el conocimiento de tu mercado objetivo y las necesidades de tus clientes potenciales.</li>
    <li><strong>Análisis de competidores:</strong> Estudia a fondo a tus competidores directos e indirectos para identificar ventajas competitivas.</li>
  </ul>

  <div class="phase-tasks">
    <strong>¿Por qué son importantes estas actividades?</strong>
    <p>Un análisis riguroso del mercado y del entorno competitivo te permitirá tomar decisiones estratégicas fundamentadas, identificar oportunidades de diferenciación y anticipar posibles amenazas antes de invertir recursos significativos en tu proyecto.</p>
  </div>

  <p>Al finalizar esta fase, tendrás una visión clara y documentada del entorno en el que competirá tu proyecto, lo que te preparará para las siguientes fases de cuantificación y propuesta de valor.</p>
</section>`),
    'Fase 2': wrapPhaseIntro(`<section class="uic-phase">
  <header>
    <h2>Fase 2: Cuantificación del mercado y ventana de oportunidad</h2>
    <p class="phase-lead">Transforma tu comprensión cualitativa del mercado en datos concretos. Cuantifica el tamaño de tu oportunidad y valida el momento adecuado para lanzar tu proyecto.</p>
  </header>

  <div class="phase-note">
    <strong>Objetivo de la fase</strong>
    <p>En esta fase pasarás del análisis cualitativo a la cuantificación. Aprenderás a medir el tamaño real de tu mercado, a estimar el potencial de ingresos y a identificar si existe una ventana de oportunidad temporal que favorezca el lanzamiento de tu proyecto.</p>
  </div>

  <h3>Actividades principales</h3>
  <ul>
    <li><strong>Cuantificación del mercado:</strong> Mide el tamaño total del mercado (TAM), el mercado accesible (SAM) y tu mercado objetivo real (SOM). Estima el potencial de ingresos y valida la viabilidad económica de tu proyecto.</li>
  </ul>

  <h3>Actividades opcionales</h3>
  <ul>
    <li><strong>Ventana de oportunidad:</strong> Analiza si existe un momento óptimo para lanzar tu proyecto. Identifica factores temporales que pueden favorecer o dificultar tu entrada al mercado.</li>
  </ul>

  <div class="phase-tasks">
    <strong>¿Qué aprenderás?</strong>
    <ul>
      <li>A calcular métricas clave de mercado (TAM, SAM, SOM).</li>
      <li>A estimar el potencial de ingresos de tu proyecto.</li>
      <li>A identificar si existe una ventana de oportunidad temporal.</li>
      <li>A validar la viabilidad económica de tu idea de negocio.</li>
    </ul>
  </div>

  <p>Los datos que recopiles en esta fase serán fundamentales para construir tu modelo de negocio y para presentar tu proyecto a inversores o stakeholders en fases posteriores.</p>
</section>`),
    'Fase 3': wrapPhaseIntro(`<section class="uic-phase">
  <header>
    <h2>Fase 3: Propuesta de valor y curva de valor</h2>
    <p class="phase-lead">Define qué hace único a tu proyecto. Articula claramente el valor que ofreces a tus clientes y cómo te diferencias de la competencia.</p>
  </header>

  <div class="phase-note">
    <strong>Objetivo de la fase</strong>
    <p>Esta fase se centra en la diferenciación y el posicionamiento. Aprenderás a comunicar claramente el valor único que ofrece tu proyecto, a identificar los atributos que más importan a tus clientes y a diseñar una propuesta que resuene con tu mercado objetivo.</p>
  </div>

  <h3>Actividades principales</h3>
  <ul>
    <li><strong>Propuesta de valor:</strong> Define claramente qué problema resuelves, para quién y cómo. Articula los beneficios únicos que ofrece tu proyecto y por qué los clientes deberían elegirte sobre la competencia.</li>
  </ul>

  <h3>Actividades opcionales</h3>
  <ul>
    <li><strong>Curva de valor (Océanos azules):</strong> Identifica factores que la industria da por sentados y que podrías eliminar o reducir, así como factores que podrías crear o aumentar para abrir nuevos espacios de mercado no disputados.</li>
  </ul>

  <div class="phase-tasks">
    <strong>¿Por qué es crucial esta fase?</strong>
    <p>Una propuesta de valor clara y diferenciada es el corazón de cualquier negocio exitoso. Sin ella, será difícil atraer clientes, inversores o partners. Esta fase te ayudará a comunicar de manera efectiva qué hace especial a tu proyecto.</p>
  </div>

  <p>Al completar esta fase, tendrás una propuesta de valor sólida que servirá como base para construir tu modelo de negocio y para desarrollar tu estrategia de marketing y ventas.</p>
</section>`),
    'Fase 4': wrapPhaseIntro(`<section class="uic-phase">
  <header>
    <h2>Fase 4: Modelo de negocio y ventaja competitiva</h2>
    <p class="phase-lead">Construye el modelo económico de tu proyecto. Define cómo generarás ingresos, cómo te relacionarás con tus clientes y qué te dará una ventaja sostenible en el mercado.</p>
  </header>

  <div class="phase-note">
    <strong>Objetivo de la fase</strong>
    <p>En esta fase desarrollarás el modelo de negocio completo de tu proyecto. Aprenderás a diseñar un modelo económico viable, a identificar tus ventajas competitivas sostenibles y a estructurar las operaciones necesarias para entregar valor a tus clientes.</p>
  </div>

  <h3>Actividades principales</h3>
  <ul>
    <li><strong>Modelo de negocio:</strong> Utiliza el Business Model Canvas para diseñar tu modelo económico completo. Define segmentos de clientes, propuesta de valor, canales, relaciones, flujos de ingresos, recursos clave, actividades clave, alianzas y estructura de costes.</li>
  </ul>

  <h3>Actividades opcionales</h3>
  <ul>
    <li><strong>Analizando la ventaja competitiva:</strong> Identifica qué te hace único y cómo sostenerlo en el tiempo. Analiza ventajas internas (costes, procesos, tecnología) y externas (percepción del cliente, servicio, reputación).</li>
  </ul>

  <div class="phase-tasks">
    <strong>¿Qué lograrás en esta fase?</strong>
    <ul>
      <li>Un modelo de negocio completo y estructurado.</li>
      <li>Una comprensión clara de cómo generarás ingresos.</li>
      <li>Identificación de tus ventajas competitivas sostenibles.</li>
      <li>Una visión integrada de todas las piezas de tu negocio.</li>
    </ul>
  </div>

  <p>El modelo de negocio que desarrolles en esta fase será la base para tu presentación final y para la planificación operativa de tu proyecto.</p>
</section>`),
    'Fase 5': wrapPhaseIntro(`<section class="uic-phase">
  <header>
    <h2>Fase 5: Presenta tu proyecto</h2>
    <p class="phase-lead">Llega el momento de contar tu historia. Desarrolla un pitch convincente que comunique la esencia de tu proyecto y conquiste a tu audiencia.</p>
  </header>

  <div class="phase-note">
    <strong>Objetivo de la fase</strong>
    <p>Esta fase se centra en la comunicación efectiva de tu proyecto. Aprenderás a estructurar y presentar tu idea de manera convincente, a crear una narrativa memorable y a prepararte para responder preguntas desafiantes sobre tu negocio.</p>
  </div>

  <h3>Actividades principales</h3>
  <ul>
    <li><strong>Presenta tu proyecto:</strong> Desarrolla un pitch de 3-5 minutos que conecte el problema, el cliente y la solución en una narrativa memorable. Prepara tanto la presentación visual como el vídeo de tu pitch.</li>
  </ul>

  <div class="phase-tasks">
    <strong>Consejos para un pitch exitoso</strong>
    <ul>
      <li>Máximo seis palabras por diapositiva.</li>
      <li>Diez diapositivas, veinte minutos, tipografía mínima de 30 pt.</li>
      <li>Usa imágenes potentes y una historia con principio, nudo y cierre.</li>
      <li>Ensaya hasta ganar fluidez y naturalidad.</li>
      <li>Prepara respuestas para preguntas frecuentes sobre finanzas, DAFO y roadmap.</li>
    </ul>
  </div>

  <p>Tu pitch será la primera impresión que muchos tendrán de tu proyecto. Asegúrate de que comunique claramente tu visión, tu propuesta de valor y tu potencial de impacto.</p>
</section>`),
    'Fase 6': wrapPhaseIntro(`<section class="uic-phase">
  <header>
    <h2>Fase 6: Validación, MVP y roadmap</h2>
    <p class="phase-lead">Da el salto de la teoría a la práctica. Valida tu modelo de negocio con clientes reales, construye un MVP y planifica el futuro de tu proyecto.</p>
  </header>

  <div class="phase-note">
    <strong>Objetivo de la fase</strong>
    <p>Esta fase final se enfoca en la ejecución y la planificación. Aprenderás a validar tus hipótesis de negocio con clientes reales, a construir un producto mínimo viable (MVP) y a crear un roadmap que guíe el desarrollo futuro de tu proyecto.</p>
  </div>

  <h3>Actividades opcionales</h3>
  <ul>
    <li><strong>Validación de modelo de negocio:</strong> Confirma con evidencia que tus hipótesis son sólidas antes de escalar. Realiza encuestas y entrevistas con clientes potenciales para validar problema, solución y modelo de ingresos.</li>
    <li><strong>Construye tu MVP:</strong> Diseña el experimento mínimo para validar tu solución con clientes reales. Evita invertir en funcionalidades innecesarias y prioriza el aprendizaje rápido.</li>
    <li><strong>Diagrama de Gantt:</strong> Planifica tareas, dependencias y responsables de tu proyecto con una visual clara. Controla plazos, identifica cuellos de botella y comunica avances al equipo.</li>
  </ul>

  <div class="phase-tasks">
    <strong>¿Por qué son importantes estas actividades?</strong>
    <p>La validación temprana con clientes reales puede ahorrarte meses de desarrollo en la dirección equivocada. Un MVP te permite aprender rápido y ajustar tu estrategia. Un roadmap claro te ayuda a mantener el foco y a comunicar tu visión a stakeholders.</p>
  </div>

  <p>Al completar esta fase, tendrás un proyecto validado, un plan de ejecución claro y las herramientas necesarias para llevar tu idea del concepto a la realidad.</p>
</section>`)
  };

  const phaseDefinitions = [
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Fase 0',
      description: 'Crea o únete a un proyecto',
      intro_html: phaseIntroHtml['Fase 0'],
      order_index: 0,
      is_elimination: false,
      start_date: new Date('2025-11-24T00:00:00.000Z'),
      end_date: new Date('2025-12-12T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Fase 1',
      description: 'Análisis de mercado y fuerzas de Porter',
      intro_html: phaseIntroHtml['Fase 1'],
      order_index: 2,
      is_elimination: false,
      start_date: new Date('2026-02-02T00:00:00.000Z'),
      end_date: new Date('2026-02-06T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Fase 2',
      description: 'Cuantificación del mercado y ventana de oportunidad',
      intro_html: phaseIntroHtml['Fase 2'],
      order_index: 3,
      is_elimination: false,
      start_date: new Date('2026-02-09T00:00:00.000Z'),
      end_date: new Date('2026-02-20T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Fase 3',
      description: 'Propuesta de valor y curva de valor',
      intro_html: phaseIntroHtml['Fase 3'],
      order_index: 4,
      is_elimination: false,
      start_date: new Date('2026-03-02T00:00:00.000Z'),
      end_date: new Date('2026-03-20T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Fase 4',
      description: 'Modelo de negocio y ventaja competitiva',
      intro_html: phaseIntroHtml['Fase 4'],
      order_index: 5,
      is_elimination: false,
      start_date: new Date('2026-03-02T00:00:00.000Z'),
      end_date: new Date('2026-03-20T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Fase 5',
      description: 'Presenta tu proyecto',
      intro_html: phaseIntroHtml['Fase 5'],
      order_index: 6,
      is_elimination: false,
      start_date: new Date('2026-03-23T00:00:00.000Z'),
      end_date: new Date('2026-03-23T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: 'Fase 6',
      description: 'Validación, MVP y roadmap',
      intro_html: phaseIntroHtml['Fase 6'],
      order_index: 7,
      is_elimination: false,
      start_date: new Date('2026-03-02T00:00:00.000Z'),
      end_date: new Date('2026-03-20T23:59:59.000Z'),
      view_start_date: eventStartDate,
      view_end_date: eventEndDate,
      created_at: phaseNow,
      updated_at: phaseNow
    }
  ];

  await queryInterface.bulkInsert('phases', phaseDefinitions);

  const [phaseRows] = await queryInterface.sequelize.query(
    `SELECT id, name, end_date FROM phases WHERE tenant_id = ${tenant.id} AND event_id = ${event.id}`
  );

  const phasesByName = new Map(
    phaseRows.map((phase) => [phase.name, { id: phase.id, endDate: phase.end_date ? new Date(phase.end_date) : null }])
  );

  const taskNow = new Date();

  const taskIntroStyles = `
<style>
  .uic-task {
    background: linear-gradient(135deg, rgba(0, 65, 107, 0.07), rgba(0, 123, 255, 0.04));
    border: 1px solid rgba(0, 65, 107, 0.12);
    border-radius: 18px;
    padding: 1.75rem;
    margin: 0;
    box-shadow: 0 18px 36px -20px rgba(0, 65, 107, 0.45);
  }

  .uic-task header {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .uic-task h2 {
    margin: 0;
    font-size: 1.2rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #00416b;
  }

  .uic-task .task-lead {
    font-size: 1.05rem;
    font-weight: 600;
    color: #002c45;
    margin: 0.35rem 0 0.75rem;
  }

  .uic-task h3 {
    margin-top: 1.35rem;
    margin-bottom: 0.65rem;
    font-size: 1rem;
    font-weight: 700;
    color: #005a99;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .uic-task h3::before {
    content: '✷';
    font-size: 0.85rem;
    color: #00a3ff;
  }

  .uic-task p {
    margin: 0.5rem 0;
    line-height: 1.65;
  }

  .uic-task ul,
  .uic-task ol {
    list-style: none;
    padding: 0;
    margin: 0.85rem 0 0.3rem;
    display: grid;
    gap: 0.5rem;
  }

  .uic-task li {
    position: relative;
    padding-left: 1.75rem;
    border-left: 2px solid rgba(0, 65, 107, 0.12);
    padding-top: 0.35rem;
    padding-bottom: 0.35rem;
  }

  .uic-task ul li::before {
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

  .uic-task ol {
    counter-reset: uic-counter;
  }

  .uic-task ol li {
    counter-increment: uic-counter;
    padding-left: 2.1rem;
  }

  .uic-task ol li::before {
    content: counter(uic-counter) '.';
    position: absolute;
    left: -0.35rem;
    top: 0.25rem;
    font-weight: 700;
    color: #00416b;
  }

  .uic-task a {
    color: #00416b;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
    transition: color 0.24s ease, text-decoration-color 0.24s ease;
  }

  .uic-task a:hover {
    color: #002c45;
    text-decoration-color: #00c2ff;
  }

  .uic-task .task-note {
    background: rgba(0, 65, 107, 0.06);
    border-left: 4px solid rgba(0, 65, 107, 0.45);
    border-radius: 14px;
    padding: 1rem 1.25rem;
    margin-top: 0.85rem;
  }

  .uic-task .task-callout {
    background: rgba(0, 123, 255, 0.08);
    border: 1px solid rgba(0, 65, 107, 0.16);
    border-radius: 14px;
    padding: 1rem 1.25rem;
    margin-top: 1.1rem;
  }

  .uic-task .task-callout strong {
    display: block;
    font-size: 0.95rem;
    margin-bottom: 0.45rem;
    color: #00416b;
  }
</style>
`;

  const wrapIntro = (content) => `${taskIntroStyles}${content}`;
  const taskIntroHtml = Object.freeze({
    'Inscripción y descripción de la idea': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Inscripción y descripción de la idea</h2>
    <p class="task-lead">Presenta tu idea de negocio y forma tu equipo para comenzar el programa SPP.</p>
  </header>

  <div class="task-note">
    <strong>En qué consiste</strong>
    <p>En esta fase inicial, los interesados presentan sus ideas de negocio y equipos. Deben proporcionar detalles sobre el concepto de su empresa, el mercado objetivo y el modelo de negocio.</p>
  </div>

  <h3>Proceso de inscripción</h3>
  <ul>
    <li><strong>Inscripción:</strong> Los interesados presentan sus ideas de negocio y equipos. Deben proporcionar detalles sobre el concepto de su empresa, el mercado objetivo y el modelo de negocio.</li>
    <li><strong>Evaluación Inicial:</strong> El profesorado responsable de cada asignatura revisa las propuestas para garantizar la calidad de las mismas, según criterios de innovación, viabilidad, impacto social/económico y presentación.</li>
    <li><strong>Feedback:</strong> Los equipos reciben comentarios constructivos para mejorar sus propuestas.</li>
  </ul>

  <h3>Requisitos de la inscripción</h3>
  <ul>
    <li>Presenta detalles sobre el concepto de tu empresa.</li>
    <li>Define el mercado objetivo.</li>
    <li>Describe el modelo de negocio inicial.</li>
    <li>Forma tu equipo (mínimo 3 miembros, máximo 5).</li>
  </ul>

  <div class="task-callout">
    <strong>Importante</strong>
    <ul>
      <li>¿Tienes una idea? Descríbela brevemente en el formulario online. Puede ser un negocio o una iniciativa social.</li>
      <li>¿No tienes idea o grupo? No hay problema, apúntate a un proyecto ya creado.</li>
    </ul>
  </div>
</section>`),
    'Análisis de mercado y fuerzas de Porter': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Análisis de mercado y fuerzas de Porter</h2>
    <p class="task-lead">Explora el ecosistema competitivo para anticipar riesgos y encontrar oportunidades con una visión integral.</p>
  </header>

  <div class="task-note">
    <strong>En qué consiste</strong>
    <p>Un <strong>análisis de mercado</strong> riguroso mide cambios globales y ayuda a comprender el entorno en el que opera tu proyecto. Sumado al análisis sectorial y a las cinco fuerzas de Porter, refuerza la toma de decisiones estratégicas.</p>
  </div>

  <h3>Cómo se complementan los enfoques</h3>
  <ul>
    <li><strong>Análisis del mercado:</strong> dimensiona el tamaño, la estructura y los hábitos del cliente objetivo.</li>
    <li><strong>Análisis del sector:</strong> identifica competidores directos e indirectos y su impacto potencial.</li>
    <li><strong>Cinco fuerzas de Porter:</strong> estudia poder de clientes y proveedores, amenaza de sustitutivos y nuevos entrantes, y rivalidad actual.</li>
  </ul>

  <div class="task-callout">
    <strong>Recurso recomendado</strong>
    <ul>
      <li><a href="{{asset:10-pasos-para-hacer-un-analisis-de-sector.pdf}}" target="_blank" rel="noopener">10 pasos para hacer un análisis de sector</a></li>
    </ul>
  </div>

  <h3>Analiza las cinco fuerzas</h3>
  <ol>
    <li><strong>Poder de negociación de los clientes:</strong> influencia en precio y condiciones.</li>
    <li><strong>Poder de negociación de los proveedores:</strong> capacidad para condicionar costes.</li>
    <li><strong>Amenaza de sustitutivos:</strong> alternativas que resuelven la misma necesidad.</li>
    <li><strong>Nuevos competidores:</strong> facilidad para entrar en el mercado.</li>
    <li><strong>Rivalidad existente:</strong> intensidad competitiva actual.</li>
  </ol>

  <p>La lectura conjunta revela oportunidades, debilidades y tácticas para reforzar tu diferenciación.</p>

  <div class="task-callout">
    <strong>Plantilla descargable</strong>
    <ul>
      <li><a href="{{asset:Plantilla-de-las-5-Fuerzas-de-Porter.pptx}}" target="_blank" rel="noopener">Descargar plantilla de Porter</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=1cQ7Ebj6Gxs&feature=youtu.be" target="_blank" rel="noopener">Porter’s Five Forces: A Practical Example</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Comparte tu análisis documentado de Porter.</li>
      <li>Formato editable PPT o PDF.</li>
      <li>Peso máximo 25 MB.</li>
    </ul>
  </div>
</section>`),
    PESTEL: wrapIntro(`<section class="uic-task">
  <header>
    <h2>PESTEL</h2>
    <p class="task-lead">Evalúa el contexto externo de tu proyecto para anticipar factores que pueden acelerar o frenar su crecimiento.</p>
  </header>

  <div class="task-note">
    <strong>Por qué hacerlo</strong>
    <p>El análisis PESTEL revisa factores <strong>políticos, económicos, socioculturales, tecnológicos, ecológicos y legales</strong>. Te ayuda a detectar amenazas tempranas y a reforzar tu estrategia con datos reales.</p>
  </div>

  <h3>Cómo aprovecharlo</h3>
  <ul>
    <li>Identifica variables externas relevantes para tu sector.</li>
    <li>Valora el impacto potencial de cada factor en tu proyecto.</li>
    <li>Define acciones preventivas u oportunidades emergentes.</li>
  </ul>

  <div class="task-callout">
    <strong>Recurso recomendado</strong>
    <ul>
      <li><a href="{{asset:Como-hacer-un-analisis-pestal.pdf}}" target="_blank" rel="noopener">Cómo hacer un análisis PESTEL</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Plantilla descargable</strong>
    <ul>
      <li><a href="{{asset:Analisis-Pestel.pptx}}" target="_blank" rel="noopener">Descargar plantilla PESTEL</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=EVw3RjG2wag" target="_blank" rel="noopener">PESTEL: herramienta de planificación estratégica</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Sube tu análisis PESTEL completo.</li>
      <li>Formato editable PPT o PDF.</li>
      <li>Peso máximo 25 MB.</li>
    </ul>
  </div>
</section>`),
    'Análisis DAFO': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Análisis DAFO</h2>
    <p class="task-lead">Cruza la mirada interna y externa de tu proyecto para diseñar estrategias accionables.</p>
  </header>

  <div class="task-note">
    <strong>Elementos clave</strong>
    <ul>
      <li><strong>Debilidades:</strong> aspectos internos que limitan tu propuesta.</li>
      <li><strong>Amenazas:</strong> factores externos con impacto negativo potencial.</li>
      <li><strong>Fortalezas:</strong> ventajas que te diferencian.</li>
      <li><strong>Oportunidades:</strong> tendencias o cambios que puedes aprovechar.</li>
    </ul>
  </div>

  <h3>Cómo trabajarlo</h3>
  <ul>
    <li>Recoge datos objetivos antes de completar cada cuadrante.</li>
    <li>Prioriza los hallazgos que influyen directamente en tu modelo de negocio.</li>
    <li>Define acciones para potenciar fortalezas y reducir riesgos.</li>
  </ul>

  <div class="task-callout">
    <strong>Plantilla descargable</strong>
    <ul>
      <li><a href="{{asset:Plantillas-para-realizar-un-analisis-FODA.pptx}}" target="_blank" rel="noopener">Descargar plantilla de análisis DAFO</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=Vlyh-2H6syg" target="_blank" rel="noopener">Vídeo explicativo sobre análisis DAFO</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Elige la plantilla que prefieras y completa los cuatro cuadrantes.</li>
      <li>Incluye conclusiones sobre amenazas y oportunidades clave.</li>
      <li>Peso máximo 25 MB.</li>
    </ul>
  </div>
</section>`),
    'Opcional 1: El mercado y el cliente': wrapIntro(`<section class="uic-task">
  <header>
    <h2>El mercado y el cliente</h2>
    <p class="task-lead">Define a quién sirves y cómo generar valor real para cada segmento.</p>
  </header>

  <div class="task-note">
    <strong>Conceptos esenciales</strong>
    <ul>
      <li><strong>Mercado:</strong> conjunto de personas u organizaciones con necesidad y capacidad de compra.</li>
      <li><strong>Cliente:</strong> quien adquiere y usa tu solución; su experiencia sostiene la propuesta.</li>
      <li><strong>Relevancia:</strong> la ventaja competitiva nace de poner al cliente en el centro.</li>
    </ul>
  </div>

  <h3>Beneficios de segmentar bien</h3>
  <ul>
    <li>Optimiza recursos de marketing y ventas.</li>
    <li>Permite mensajes y productos más personalizados.</li>
    <li>Favorece la generación de ideas y mejoras continuas.</li>
    <li>Aterriza proyecciones de demanda con datos realistas.</li>
  </ul>

  <p>Identifica personas usuarias, toma notas de sus motivaciones y practica la empatía para construir historias de uso.</p>

  <div class="task-callout">
    <strong>Recursos recomendados</strong>
    <ul>
      <li><a href="{{asset:Guia-practica-para-entender-el-mercado-los-clientes-y-consumidores.pdf}}" target="_blank" rel="noopener">Guía práctica para entender el mercado, los clientes y consumidores</a></li>
      <li><a href="{{asset:investigacion-de-mercado-para-Pymes.pdf}}" target="_blank" rel="noopener">Investigación de mercado para Pymes</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Plantillas y toolbox</strong>
    <ul>
      <li><a href="{{asset:Plantilla-de-tipos-de-cliente-1.pptx}}" target="_blank" rel="noopener">Plantilla de tipos de clientes</a></li>
      <li><a href="https://www.youtube.com/watch?v=j2_BDsaKfEs&feature=youtu.be" target="_blank" rel="noopener">Vídeo: Qué valora el cliente</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Comparte tu análisis del segmento de clientes.</li>
      <li>Incluye insights clave y mapa de empatía si aplican.</li>
      <li>Formato PPT o PDF. Máximo 25 MB.</li>
    </ul>
  </div>
</section>`),
    'Opcional 2: Análisis de competidores': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Análisis de competidores</h2>
    <p class="task-lead">Anticipa los movimientos del mercado y fortalece tu propuesta antes que el resto.</p>
  </header>

  <div class="task-note">
    <strong>Qué lograrás</strong>
    <p>Identificar diferenciadores, obstáculos para crecer y oportunidades para reorientar tu estrategia comercial o de producto.</p>
  </div>

  <h3>Recomendaciones clave</h3>
  <ul>
    <li>Haz un seguimiento periódico de tus competidores directos e indirectos.</li>
    <li>Contrasta tus hipótesis con datos recientes: el contexto cambia rápido.</li>
    <li>Evalúa precios, canales, narrativa y experiencia de usuario.</li>
  </ul>

  <div class="task-callout">
    <strong>Recursos</strong>
    <ul>
      <li><a href="https://alternativeto.net/" target="_blank" rel="noopener">AlternativeTo: buscador de competidores</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Plantilla descargable</strong>
    <ul>
      <li><a href="{{asset:competitive-analysis-file-pdf.pdf}}" target="_blank" rel="noopener">Plantilla de análisis de la competencia</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=QtGvRYjjTms" target="_blank" rel="noopener">Crear Océanos Azules con las curvas de valor</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Documenta hallazgos por competidor y tu estrategia de respuesta.</li>
      <li>Formato PPT o PDF (puedes añadir vídeo opcional &lt; 25 MB).</li>
    </ul>
  </div>
</section>`),
    'Cuantificación del mercado': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Cuantificación de mercado: PAM, TAM, SAM, SOM</h2>
    <p class="task-lead">Dimensiona el tamaño real de tu oportunidad y prioriza dónde enfocarte primero.</p>
  </header>

  <div class="task-note">
    <strong>Definiciones clave</strong>
    <ul>
      <li><strong>PAM (Potential Available Market):</strong> consumo global sin restricciones.</li>
      <li><strong>TAM (Total Available Market):</strong> mercado total accesible dentro de tus límites actuales.</li>
      <li><strong>SAM (Serviceable Available Market):</strong> segmento que puedes atender con tu propuesta actual.</li>
      <li><strong>SOM (Serviceable Obtainable Market):</strong> participación que puedes captar a corto plazo.</li>
    </ul>
  </div>

  <h3>Cómo interpretarlo</h3>
  <ul>
    <li>Analiza barreras legales, tecnológicas o culturales que reducen tu TAM.</li>
    <li>Utiliza datos públicos y privados para estimar volumen, crecimiento y tickets medios.</li>
    <li>Contrasta tus supuestos con entrevistas o pruebas piloto.</li>
  </ul>

  <p>Recuerda que un mercado puede permanecer en el PAM, pero quedar fuera del TAM por limitaciones normativas (ej. requisitos locales en China o Qatar).</p>

  <div class="task-callout">
    <strong>Plantilla descargable</strong>
    <ul>
      <li><a href="{{asset:PLANTILLA-TAM-SAM-SOM-1.pptx}}" target="_blank" rel="noopener">Plantilla TAM · SAM · SOM</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?si=xcwoRyFWzsR5EUux&v=z-VF1mCMfvg&feature=youtu.be" target="_blank" rel="noopener">¿Cómo calcular el mercado potencial de tu startup?</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Documenta los cálculos y fuentes utilizadas.</li>
      <li>Formato PPT o PDF (puedes adjuntar hoja de cálculo).</li>
      <li>Máximo 25 MB.</li>
    </ul>
  </div>
</section>`),
    'Opcional 3: Ventana de oportunidad': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Ventana de oportunidad</h2>
    <p class="task-lead">Detecta segmentos que valoran tu propuesta ahora mismo y conviértelos en aliados tempranos.</p>
  </header>

  <div class="task-note">
    <strong>Segmentación inteligente</strong>
    <p>Definir grupos con necesidades y comportamientos similares evita campañas genéricas y te permite lanzar mensajes con mayor precisión.</p>
  </div>

  <h3>Pasos sugeridos</h3>
  <ul>
    <li>Clasifica tus clientes potenciales según problema, motivación y capacidad de pago.</li>
    <li>Evalúa qué segmentos están listos para adoptar tu solución en el corto plazo.</li>
    <li>Alinea canales y propuesta de valor para cada ventana detectada.</li>
  </ul>

  <div class="task-callout">
    <strong>Recursos recomendados</strong>
    <ul>
      <li><a href="{{asset:Como-realizar-un-analisis-de-mercado-para-su-producto.pdf}}" target="_blank" rel="noopener">Cómo realizar un análisis de mercado para su producto</a></li>
      <li><a href="{{asset:Segmentacion-de-mercado-Que-es-y-como-segmentarlo-paso-a-paso.pdf}}" target="_blank" rel="noopener">Segmentación de mercado: guía paso a paso</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Plantilla descargable</strong>
    <ul>
      <li><a href="{{asset:Plantilla-para-hacer-segmentacion-de-mercado-1.pptx}}" target="_blank" rel="noopener">Plantilla de segmentación de mercado</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=83ckliHw2kg" target="_blank" rel="noopener">Segmentación de mercado (introducción)</a></li>
      <li><a href="https://www.youtube.com/watch?v=voALLoCOeRI" target="_blank" rel="noopener">Ejemplo práctico de segmentación</a></li>
    </ul>
  </div>
</section>`),
    'Propuesta de valor': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Propuesta de valor</h2>
    <p class="task-lead">Explica cómo tu solución transforma la vida de tu cliente mejor que cualquier alternativa.</p>
  </header>

  <div class="task-note">
    <strong>Canvas: segmento vs. propuesta</strong>
    <ul>
      <li><strong>Segmento de clientes:</strong> qué tareas desean completar, qué les entusiasma y qué les frustra.</li>
      <li><strong>Propuesta de valor:</strong> cómo alivias sus dolores, generas alegrías y qué ofreces de forma tangible.</li>
    </ul>
  </div>

  <h3>Claves para construirla</h3>
  <ul>
    <li>Parte de insights reales obtenidos en entrevistas o encuestas.</li>
    <li>Describe beneficios funcionales, emocionales y sociales.</li>
    <li>Conecta con misión, visión y valores de tu proyecto.</li>
  </ul>

  <div class="task-callout">
    <strong>Recursos recomendados</strong>
    <ul>
      <li><a href="{{asset:Como-formular-la-propuesta-de-valor-de-una-empresa.pdf}}" target="_blank" rel="noopener">Cómo formular la propuesta de valor de una empresa</a></li>
      <li><a href="{{asset:La-propuesta-de-valor-modelos-de-negocio-a-fondo.pdf}}" target="_blank" rel="noopener">La propuesta de valor en modelos de negocio</a></li>
      <li><a href="{{asset:Como-definir-la-mision-vision-y-valores-de-una-empresa-ejemplos.pdf}}" target="_blank" rel="noopener">Cómo definir misión, visión y valores</a></li>
      <li><a href="{{asset:Valores-corporativos-que-son-y-10-ejemplos.pdf}}" target="_blank" rel="noopener">Valores corporativos: qué son y ejemplos</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Plantilla descargable</strong>
    <ul>
      <li><a href="{{asset:plantilla-propuesta-de-valor.pdf}}" target="_blank" rel="noopener">Plantilla de propuesta de valor</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=C8tWbb41Q9M" target="_blank" rel="noopener">¿Qué es una propuesta de valor?</a></li>
      <li><a href="https://www.youtube.com/watch?v=xUl3r0FnfsU" target="_blank" rel="noopener">Value Proposition (How to Build a Startup)</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Incluye propuesta de valor, público objetivo y aportes sociales.</li>
      <li>Formato PPT o PDF. Máximo 25 MB.</li>
    </ul>
  </div>
</section>`),
    'Opcional 4: Curva de valor (Océanos azules)': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Curva de valor (Océanos Azules)</h2>
    <p class="task-lead">Visualiza cómo te diferencias de la competencia y descubre espacios de valor inexplorados.</p>
  </header>

  <div class="task-note">
    <strong>Qué obtienes</strong>
    <ul>
      <li>Comprensión comparativa del sector.</li>
      <li>Evaluación crítica de tu propuesta actual.</li>
      <li>Hallazgo de atributos que puedes potenciar o reducir.</li>
    </ul>
  </div>

  <h3>Consejos para construirla</h3>
  <ul>
    <li>Selecciona factores de valor que importen a tu cliente (precio, personalización, soporte, etc.).</li>
    <li>Asigna puntuaciones consistentes para tu proyecto y tus competidores.</li>
    <li>Detecta dónde puedes innovar o simplificar para abrir un océano azul.</li>
  </ul>

  <div class="task-callout">
    <strong>Plantilla descargable</strong>
    <ul>
      <li><a href="{{asset:Plantilla-para-implementar-la-estrategia-oceanos-azules.pptx}}" target="_blank" rel="noopener">Plantilla estrategia Océanos Azules</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=QtGvRYjjTms" target="_blank" rel="noopener">Crear Océanos Azules con las curvas de valor</a></li>
    </ul>
  </div>
</section>`),
    'Modelo de negocio': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Business Model Canvas</h2>
    <p class="task-lead">Resume cómo generas, entregas y capturas valor en una sola página.</p>
  </header>

  <div class="task-note">
    <strong>Dos bloques clave</strong>
    <ul>
      <li><strong>Mercado y clientes:</strong> segmentos, propuesta de valor, canales, relación y flujos de ingreso.</li>
      <li><strong>Operaciones y recursos:</strong> actividades clave, alianzas, recursos y estructura de costes.</li>
    </ul>
  </div>

  <h3>Recomendaciones</h3>
  <ul>
    <li>Rellena primero la propuesta de valor y el segmento de cliente.</li>
    <li>Valida supuestos con datos y feedback de usuarios.</li>
    <li>Refresca el canvas en cada iteración importante del proyecto.</li>
  </ul>

  <div class="task-callout">
    <strong>Plantilla descargable</strong>
    <ul>
      <li><a href="{{asset:Modelo-Canvas.doc}}" target="_blank" rel="noopener">Plantilla Business Model Canvas</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=f7-3mhABFxg" target="_blank" rel="noopener">The Business Model Canvas (9 Steps)</a></li>
      <li><a href="https://www.youtube.com/watch?v=xUl3r0FnfsU" target="_blank" rel="noopener">Value Proposition - How to Build a Startup</a></li>
      <li><a href="https://www.youtube.com/watch?v=E6YUVhYkc0A" target="_blank" rel="noopener">Business Model Canvas (Steve Blank)</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Comparte tu canvas completo y conclusiones principales.</li>
      <li>Formato editable PPT o PDF. Máximo 25 MB.</li>
    </ul>
  </div>
</section>`),
    'Opcional 5: Analizando la ventaja competitiva': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Analizando la ventaja competitiva</h2>
    <p class="task-lead">Identifica qué te hace único y cómo sostenerlo en el tiempo.</p>
  </header>

  <div class="task-note">
    <strong>Dos miradas complementarias</strong>
    <ul>
      <li><strong>Interna:</strong> costes, procesos, tecnología, propiedad intelectual.</li>
      <li><strong>Externa:</strong> percepción del cliente, servicio, comunidad, reputación.</li>
    </ul>
  </div>

  <h3>Cómo validarla</h3>
  <ul>
    <li>Contrasta supuestos con clientes reales o potenciales.</li>
    <li>Analiza sostenibilidad y facilidad de réplica por parte de la competencia.</li>
    <li>Conecta la ventaja con tu propuesta de valor y narrativa comercial.</li>
  </ul>

  <div class="task-callout">
    <strong>Plantilla descargable</strong>
    <ul>
      <li><a href="{{asset:Plantilla-de-ventaja-comparativa-1.pptx}}" target="_blank" rel="noopener">Plantilla de ventaja comparativa</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=_XPEAvIfL00" target="_blank" rel="noopener">Estrategia y ventaja competitiva</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Resume tus ventajas clave y cómo las validarás.</li>
      <li>Formato PPT o PDF. Máximo 25 MB.</li>
    </ul>
  </div>
</section>`),
    'Presenta tu proyecto': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Pitch</h2>
    <p class="task-lead">Cuenta la historia de tu proyecto en 3-5 minutos y conquista a tu audiencia.</p>
  </header>

  <div class="task-note">
    <strong>Preparación</strong>
    <p>A estas alturas ya dominas el problema, al cliente y la solución. Tu pitch conecta esos elementos en una narrativa memorable.</p>
  </div>

  <h3>Herramientas recomendadas</h3>
  <ul>
    <li><a href="https://www.chatsimple.ai/es/tools/ai-elevator-pitch-generator" target="_blank" rel="noopener">ChatSimple Pitch Generator</a></li>
    <li><a href="https://writerbuddy.ai/writing-tools/elevator-pitch-generator" target="_blank" rel="noopener">WriterBuddy AI</a></li>
    <li><a href="https://app.heygen.com/" target="_blank" rel="noopener">HeyGen (vídeos con avatares)</a></li>
  </ul>

  <h3>Consejos para tu presentación</h3>
  <ul>
    <li>Máximo seis palabras por diapositiva.</li>
    <li>Diez diapositivas, veinte minutos, tipografía mínima de 30 pt.</li>
    <li>Usa imágenes potentes y una historia con principio, nudo y cierre.</li>
    <li>Ensaya hasta ganar fluidez.</li>
    <li>Prepara respuestas para preguntas frecuentes (finanzas, DAFO, roadmap).</li>
  </ul>

  <div class="task-callout">
    <strong>Recursos</strong>
    <ul>
      <li><a href="{{asset:Pitch-deck.pptx}}" target="_blank" rel="noopener">Plantilla editable de pitch</a></li>
      <li><a href="https://www.youtube.com/watch?v=WOvhpKwxeKc" target="_blank" rel="noopener">Vídeo: rol play elevator pitch</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Sube dos archivos: vídeo del pitch y la presentación.</li>
      <li>Presentación en PPT o PDF; cada archivo &lt; 25 MB.</li>
    </ul>
  </div>
</section>`),
    'Opcional 6: Validación de modelo de negocio': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Validación de modelo de negocio</h2>
    <p class="task-lead">Confirma con evidencia que tus hipótesis son sólidas antes de escalar.</p>
  </header>

  <div class="task-note">
    <strong>Qué implica</strong>
    <p>Hacer las preguntas correctas, contrastarlas con clientes tempranos y ajustar tu estrategia a partir de los resultados.</p>
  </div>

  <h3>Puntos de validación</h3>
  <ul>
    <li>Problema y solución: ¿el cliente reconoce la necesidad y valora tu propuesta?</li>
    <li>Modelo de ingresos: ¿aceptan el precio o están dispuestos a pagar?</li>
    <li>Canales y relación: ¿cómo prefieren ser contactados y atendidos?</li>
  </ul>

  <div class="task-callout">
    <strong>Recursos</strong>
    <ul>
      <li><a href="{{asset:Encuestas-de-investigacion-de-mercado-1.pdf}}" target="_blank" rel="noopener">Encuestas de investigación de mercado y entrevistas de validación</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=hKMX-uQ0NYY" target="_blank" rel="noopener">Validación del modelo de negocio</a></li>
      <li><a href="https://www.youtube.com/watch?v=WqutVXJ_VY8" target="_blank" rel="noopener">Producto mínimo viable y validación</a></li>
      <li><a href="https://www.youtube.com/watch?v=d9F2zz__Veg" target="_blank" rel="noopener">Descubrimiento de clientes: entrevistas de validación</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Resume hallazgos de encuestas o entrevistas y decisiones tomadas.</li>
      <li>Formato PPT o PDF. Máximo 25 MB.</li>
    </ul>
  </div>
</section>`),
    'Opcional 7: Construye tu MVP': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Construye tu MVP</h2>
    <p class="task-lead">Diseña el experimento mínimo para validar tu solución con clientes reales.</p>
  </header>

  <div class="task-note">
    <strong>Propósito</strong>
    <p>Conversar con usuarios tempranos, comprobar que resuelves su problema y confirmar su disposición a pagar.</p>
  </div>

  <h3>Beneficios</h3>
  <ul>
    <li>Evita invertir en funcionalidades que nadie necesita.</li>
    <li>Prioriza hipótesis críticas y aprende rápido.</li>
    <li>Sienta bases sólidas para escalar el negocio.</li>
  </ul>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=cSXsPCgWOHU" target="_blank" rel="noopener">Las fases del lanzamiento de un producto</a></li>
      <li><a href="https://www.youtube.com/watch?v=WqutVXJ_VY8" target="_blank" rel="noopener">Cómo crear un producto mínimo viable</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Describe tu MVP, métricas objetivo y aprendizajes esperados.</li>
      <li>Formato flexible (PPT, PDF o vídeo &lt; 25 MB).</li>
    </ul>
  </div>
</section>`),
    'Opcional 8: Diagrama de Gantt': wrapIntro(`<section class="uic-task">
  <header>
    <h2>Diagrama de Gantt</h2>
    <p class="task-lead">Planifica tareas, dependencias y responsables de tu proyecto con una visual clara.</p>
  </header>

  <div class="task-note">
    <strong>Por qué usarlo</strong>
    <p>Te ayuda a ordenar fases, controlar plazos, identificar cuellos de botella y comunicar avances al equipo.</p>
  </div>

  <h3>Cómo construirlo</h3>
  <ol>
    <li>Define alcance y fechas clave.</li>
    <li>Lista actividades e hitos principales.</li>
    <li>Estima duración y dependencias de cada tarea.</li>
    <li>Asigna responsables y recursos.</li>
    <li>Revisa periódicamente y ajusta según el progreso.</li>
  </ol>

  <div class="task-callout">
    <strong>Recursos</strong>
    <ul>
      <li><a href="{{asset:Que-es-y-para-que-sirve-un-diagrama-de-Gantt_.pdf}}" target="_blank" rel="noopener">¿Qué es y para qué sirve un diagrama de Gantt?</a></li>
      <li><a href="{{asset:Crea-una-plantilla-para-tus-cronogramas-con-Excel.pdf}}" target="_blank" rel="noopener">Plantilla de cronograma en Excel</a></li>
      <li><a href="{{asset:Crea-un-diagrama-de-Gantt-con-Canva.pdf}}" target="_blank" rel="noopener">Cómo crear un Gantt con Canva</a></li>
      <li><a href="{{asset:Plantilla-de-Diagrama-de-Gantt.xlsx}}" target="_blank" rel="noopener">Plantilla Excel de diagrama de Gantt</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Toolbox</strong>
    <ul>
      <li><a href="https://www.youtube.com/watch?v=5rhMbbasqNQ" target="_blank" rel="noopener">Cómo hacer un Gantt</a></li>
      <li><a href="https://www.youtube.com/watch?v=uH2xz39n2bY" target="_blank" rel="noopener">Crear un Gantt con Google Calendar</a></li>
    </ul>
  </div>

  <div class="task-callout">
    <strong>Entrega</strong>
    <ul>
      <li>Incluye ruta crítica, duración estimada y responsables.</li>
      <li>Formatos admitidos: PPT, PDF o Excel (máx. 25 MB).</li>
    </ul>
  </div>
</section>`)
  });
  const taskDefinitions = [
    {
      phaseName: 'Fase 0',
      title: 'Inscripción y descripción de la idea',
      isRequired: true
    },
    {
      phaseName: 'Fase 1',
      title: 'Análisis de mercado y fuerzas de Porter',
      isRequired: true
    },
    {
      phaseName: 'Fase 1',
      title: 'PESTEL',
      isRequired: true
    },
    {
      phaseName: 'Fase 1',
      title: 'Análisis DAFO',
      isRequired: true
    },
    {
      phaseName: 'Fase 1',
      title: 'Opcional 1: El mercado y el cliente',
      isRequired: false
    },
    {
      phaseName: 'Fase 1',
      title: 'Opcional 2: Análisis de competidores',
      isRequired: false
    },
    {
      phaseName: 'Fase 2',
      title: 'Cuantificación del mercado',
      isRequired: true
    },
    {
      phaseName: 'Fase 2',
      title: 'Opcional 3: Ventana de oportunidad',
      isRequired: false
    },
    {
      phaseName: 'Fase 3',
      title: 'Propuesta de valor',
      isRequired: true
    },
    {
      phaseName: 'Fase 3',
      title: 'Opcional 4: Curva de valor (Océanos azules)',
      isRequired: false
    },
    {
      phaseName: 'Fase 4',
      title: 'Modelo de negocio',
      isRequired: true
    },
    {
      phaseName: 'Fase 4',
      title: 'Opcional 5: Analizando la ventaja competitiva',
      isRequired: false
    },
    {
      phaseName: 'Fase 5',
      title: 'Presenta tu proyecto',
      isRequired: true
    },
    {
      phaseName: 'Fase 6',
      title: 'Opcional 6: Validación de modelo de negocio',
      isRequired: false
    },
    {
      phaseName: 'Fase 6',
      title: 'Opcional 7: Construye tu MVP',
      isRequired: false
    },
    {
      phaseName: 'Fase 6',
      title: 'Opcional 8: Diagrama de Gantt',
      isRequired: false
    }
  ];

  // Agrupar tareas por fase y asignar order_index secuencial
  const tasksByPhase = new Map();
  taskDefinitions.forEach((task) => {
    if (!tasksByPhase.has(task.phaseName)) {
      tasksByPhase.set(task.phaseName, []);
    }
    tasksByPhase.get(task.phaseName).push(task);
  });

  // Ordenar tareas dentro de cada fase: primero las requeridas, luego las opcionales
  tasksByPhase.forEach((tasks, phaseName) => {
    tasks.sort((a, b) => {
      // Primero las requeridas (isRequired: true), luego las opcionales (false)
      if (a.isRequired !== b.isRequired) {
        return b.isRequired ? 1 : -1;
      }
      // Si ambas son del mismo tipo, mantener el orden original
      return 0;
    });
  });

  const tasksToInsert = [];
  tasksByPhase.forEach((tasks, phaseName) => {
    const phaseMeta = phasesByName.get(phaseName);

    if (!phaseMeta) {
      throw new Error(`No se encontró la fase ${phaseName} para crear las tareas`);
    }

    tasks.forEach((task, index) => {
      // La tarea "Inscripción y descripción de la idea" es de tipo "Sin entrega"
      const isRegistrationTask = task.title === 'Inscripción y descripción de la idea';
      tasksToInsert.push({
        tenant_id: tenant.id,
        event_id: event.id,
        phase_id: phaseMeta.id,
        title: task.title,
        description: null,
        intro_html: taskIntroHtml[task.title] ?? null,
        delivery_type: isRegistrationTask ? 'none' : 'file',
        is_required: isRegistrationTask ? false : task.isRequired,
        due_date: phaseMeta.endDate,
        status: 'active',
        phase_rubric_id: null,
        max_files: 1,
        max_file_size_mb: null,
        allowed_mime_types: null,
        order_index: index + 1, // order_index secuencial empezando en 1
        created_at: taskNow,
        updated_at: taskNow
      });
    });
  });

  await queryInterface.bulkInsert('tasks', tasksToInsert);
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
  await queryInterface.bulkDelete('tenants', { id: tenant.id });
}


