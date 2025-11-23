// Seeder maestro para crear la rúbrica final de evaluación de proyectos de emprendeduría para UIC.
// Esta rúbrica evalúa el proyecto completo y todas sus entregas.
// Dependencias: 0002-uic-tenant.js (debe ejecutarse después de crear el evento).

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

  const [[adminUser]] = await queryInterface.sequelize.query(
    "SELECT id FROM users WHERE email = 'admin@uic.es' LIMIT 1"
  );

  if (!adminUser) {
    throw new Error('No se encontró el usuario administrador de UIC.');
  }

  // Verificar si ya existe una rúbrica final para este evento
  const [[existingRubric]] = await queryInterface.sequelize.query(
    `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND rubric_scope = 'project' LIMIT 1`
  );

  if (existingRubric) {
    console.log('Ya existe una rúbrica final para el proyecto, omitiendo...');
    return;
  }

  const now = new Date();

  // Definición de la rúbrica final del proyecto
  const finalRubric = {
    name: 'Rúbrica de evaluación de proyectos de emprendeduría',
    description: 'Rúbrica final para evaluar el proyecto completo y todas sus entregas. Escala de 1-5 puntos por criterio.',
    scale_min: 1,
    scale_max: 5,
    criteria: [
      {
        title: 'Impacto social',
        description: 'Evalúa en qué medida el proyecto responde a una necesidad real y la capacidad de generar beneficios sociales tangibles, sostenibles y de alcance significativo, así como su grado de relación y coherencia con el tema de la edición y la adaptación del proyecto a dicho enfoque.',
        weight: 20.00,
        max_score: 5.00,
        order_index: 1,
        levels: {
          1: 'No aborda una necesidad real ni genera beneficio social. No guarda relación con el tema de la edición.',
          2: 'Impacto poco claro o muy limitado. Relación débil o superficial con el tema de la edición.',
          3: 'Responde a una necesidad concreta con impacto real pero reducido. Relación adecuada aunque poco desarrollada con el tema de la edición.',
          4: 'Aporta mejoras claras a una problemática relevante. Buena conexión y adaptación al tema de la edición.',
          5: 'Impacto transformador, medible y sostenible. Total coherencia y alineación con el tema de la edición, mostrando una adaptación creativa y profunda.'
        }
      },
      {
        title: 'Originalidad de la idea',
        description: 'Valora el grado de innovación, creatividad y diferenciación de la propuesta respecto a lo existente en el mercado o en su ámbito de actuación. Analiza si la idea aporta una perspectiva nueva, una solución creativa o un enfoque alternativo frente a las opciones actuales, así como la capacidad del equipo para aprovechar tendencias, tecnologías o combinaciones originales de recursos que generen valor añadido.',
        weight: 15.00,
        max_score: 5.00,
        order_index: 2,
        levels: {
          1: 'Idea copiada o claramente inspirada en propuestas existentes, sin aportar ningún elemento diferencial ni creativo. No se percibe innovación ni valor añadido.',
          2: 'Idea con escaso grado de innovación. Presenta ligeras variaciones respecto a propuestas existentes, pero sin un desarrollo propio ni una aportación relevante que la distinga.',
          3: 'Propone algún elemento novedoso o diferenciador, aunque todavía poco desarrollado o con escasa coherencia en su aplicación. La creatividad es limitada pero visible.',
          4: 'Idea creativa, con una diferenciación clara frente a alternativas existentes. Combina enfoques, recursos o tecnologías de manera original y coherente, generando un valor distintivo.',
          5: 'Idea altamente innovadora, disruptiva y única, con un planteamiento original que redefine el enfoque del sector o propone una nueva categoría de solución. Muestra una creatividad sólida, coherente y bien articulada en todas las dimensiones del proyecto.'
        }
      },
      {
        title: 'Potencial/Viabilidad / Factibilidad',
        description: 'Mide la viabilidad del modelo de negocio, su sostenibilidad económica y operativa, y las posibilidades de crecimiento o escalabilidad del proyecto. Evalúa la claridad del modelo de ingresos, la coherencia entre los recursos y los objetivos, y la capacidad del equipo para implementar el proyecto en el tiempo y contexto previstos.',
        weight: 25.00,
        max_score: 5.00,
        order_index: 3,
        levels: {
          1: 'No presenta un modelo de negocio viable ni sostenible. Carece de estructura financiera o de una propuesta operativa realista.',
          2: 'Modelo débil, con inconsistencias en ingresos, costes o recursos. Escasa sostenibilidad a medio plazo.',
          3: 'Modelo definido y funcional, aunque con dudas en su sostenibilidad o en la capacidad de escalarlo. Requiere ajustes para consolidarse.',
          4: 'Modelo sólido, bien estructurado y viable. Muestra proyección de crecimiento y coherencia entre los recursos, las actividades y el mercado objetivo.',
          5: 'Modelo de negocio claro, escalable y sostenible, con alto potencial de crecimiento y posicionamiento en el mercado. Evidencia una planificación realista y un planteamiento estratégico robusto.'
        }
      },
      {
        title: 'Calidad de los entregables',
        description: 'Examina la completitud, claridad, organización y presentación profesional de los materiales entregados (documentos, presentaciones, informes u otros). Evalúa tanto la forma (estructuración, formato, lenguaje y diseño) como el fondo (coherencia, rigor y capacidad de síntesis), reflejando el nivel de preparación y cuidado en la ejecución del trabajo.',
        weight: 10.00,
        max_score: 5.00,
        order_index: 4,
        levels: {
          1: 'Entregables incompletos, desordenados o con formato poco profesional. Dificultan la comprensión del proyecto.',
          2: 'Materiales con carencias importantes en claridad, coherencia o presentación. Aspecto poco cuidado o estructura deficiente.',
          3: 'Entregables completos y comprensibles, pero básicos o poco atractivos. Presentan errores menores o limitaciones en la forma.',
          4: 'Entregables bien estructurados, claros y con una presentación profesional. Comunican eficazmente la información clave.',
          5: 'Entregables sobresalientes: muy claros, coherentes, bien diseñados y atractivos. Reflejan un alto nivel de rigor, organización y profesionalidad.'
        }
      },
      {
        title: 'Presentación',
        description: 'Considera la preparación, claridad, estructura, lenguaje corporal y capacidad de comunicación para transmitir el proyecto de manera convincente y conectar con la audiencia. Evalúa la capacidad del equipo para sintetizar, argumentar y responder preguntas con seguridad y coherencia, así como el uso de recursos visuales o narrativos para reforzar el mensaje.',
        weight: 10.00,
        max_score: 5.00,
        order_index: 5,
        levels: {
          1: 'Presentación poco preparada, confusa o difícil de seguir. Falta de claridad, coordinación o dominio del tema.',
          2: 'Exposición débil o desorganizada. Mensaje poco claro y escasa conexión con la audiencia.',
          3: 'Presentación clara y ordenada, aunque básica. Transmite lo esencial pero con poco impacto o dinamismo.',
          4: 'Exposición fluida, estructurada y convincente. Buena comunicación, coordinación y conexión con la audiencia.',
          5: 'Presentación sobresaliente: clara, inspiradora y dinámica. Capta la atención, transmite seguridad y genera impacto positivo en la audiencia.'
        }
      },
      {
        title: 'Equipo emprendedor',
        description: 'Evalúa la organización, cohesión, motivación y complementariedad del equipo, así como la existencia de liderazgo, visión compartida y compromiso para llevar adelante el proyecto. Considera la distribución de roles, la colaboración efectiva y la capacidad de aprendizaje y adaptación del grupo.',
        weight: 20.00,
        max_score: 5.00,
        order_index: 6,
        levels: {
          1: 'Equipo desorganizado, sin roles definidos ni coordinación. Falta de liderazgo y compromiso.',
          2: 'Equipo con roles poco claros y liderazgo débil. Muestra baja cohesión y comunicación limitada.',
          3: 'Equipo funcional, con cierta organización y liderazgo básico. Cumple sus funciones pero sin destacar en cohesión o visión compartida.',
          4: 'Equipo cohesionado, complementario y con buena comunicación. Presenta liderazgo efectivo y alineación en objetivos.',
          5: 'Equipo altamente motivado, complementario y bien organizado, con liderazgo sólido, visión clara y compromiso compartido para impulsar el proyecto.'
        }
      }
    ]
  };

  // Insertar la rúbrica final del proyecto
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
      created_by: adminUser.id,
      updated_by: adminUser.id,
      created_at: now,
      updated_at: now
    }
  ]);

  // Obtener el ID de la rúbrica recién creada
  const [[rubric]] = await queryInterface.sequelize.query(
    `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND rubric_scope = 'project' ORDER BY created_at DESC LIMIT 1`
  );

  if (!rubric) {
    throw new Error('No se pudo recuperar la rúbrica final del proyecto creada');
  }

  // Insertar los criterios de la rúbrica
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

  console.log(`Rúbrica final del proyecto creada con ${finalRubric.criteria.length} criterios`);
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

  if (!event) {
    return;
  }

  // Obtener la rúbrica final del proyecto
  const [rubrics] = await queryInterface.sequelize.query(
    `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND rubric_scope = 'project'`
  );

  if (rubrics && rubrics.length > 0) {
    const rubricIds = rubrics.map((r) => r.id).join(',');

    // Eliminar criterios
    await queryInterface.sequelize.query(
      `DELETE FROM phase_rubric_criteria WHERE rubric_id IN (${rubricIds})`
    );

    // Eliminar rúbricas
    await queryInterface.bulkDelete('phase_rubrics', {
      tenant_id: tenant.id,
      event_id: event.id,
      rubric_scope: 'project'
    });
  }
}

