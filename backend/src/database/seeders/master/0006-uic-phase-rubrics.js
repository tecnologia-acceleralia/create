// Seeder maestro para crear rúbricas de evaluación para cada fase del evento SPP 2026 de UIC.
// Dependencias: 0002-uic-tenant.js (debe ejecutarse después de crear el evento y las fases).

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
    "SELECT id FROM users WHERE email = 'admin@uic.cat' LIMIT 1"
  );

  if (!adminUser) {
    throw new Error('No se encontró el usuario administrador de UIC.');
  }

  const [phases] = await queryInterface.sequelize.query(
    `SELECT id, name FROM phases WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} ORDER BY order_index`
  );

  if (!phases || phases.length === 0) {
    throw new Error('No se encontraron fases para el evento SPP 2026. Ejecuta primero el seeder 0002-uic-tenant.js');
  }

  const now = new Date();

  // Definición de rúbricas por fase con sus criterios
  const rubricsByPhase = {
    'Fase 0': {
      name: 'Rúbrica de evaluación - Fase 0: Inscripción y descripción de la idea',
      description: 'Criterios de evaluación para la fase inicial de inscripción y descripción del proyecto.',
      criteria: [
        {
          title: 'Claridad y definición de la idea',
          description: 'La idea de negocio está claramente definida y es comprensible. Se describe de manera concisa el concepto, el problema que resuelve y la solución propuesta.',
          weight: 1.0,
          max_score: 25,
          order_index: 1
        },
        {
          title: 'Identificación del mercado objetivo',
          description: 'Se identifica claramente el mercado objetivo, incluyendo segmentación de clientes y necesidades específicas que se pretenden satisfacer.',
          weight: 1.0,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Modelo de negocio inicial',
          description: 'Se presenta un modelo de negocio inicial coherente, aunque sea básico, que explique cómo se generará valor y se capturará ingresos.',
          weight: 1.0,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Composición y complementariedad del equipo',
          description: 'El equipo está formado correctamente (mínimo 3 miembros, máximo 5) y muestra complementariedad de perfiles y habilidades necesarias para el proyecto.',
          weight: 1.0,
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
          weight: 1.0,
          max_score: 30,
          order_index: 1
        },
        {
          title: 'Análisis PESTEL',
          description: 'Evaluación exhaustiva de factores políticos, económicos, socioculturales, tecnológicos, ecológicos y legales relevantes para el proyecto. Identificación de impactos potenciales y acciones preventivas.',
          weight: 1.0,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Análisis DAFO',
          description: 'Identificación precisa de fortalezas, debilidades, oportunidades y amenazas. Priorización de hallazgos relevantes y definición de estrategias accionables basadas en el análisis.',
          weight: 1.0,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Integración y coherencia del análisis',
          description: 'Los diferentes análisis (Porter, PESTEL, DAFO) están integrados y muestran coherencia. Se identifican conexiones entre los diferentes elementos y se derivan conclusiones estratégicas claras.',
          weight: 1.0,
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
          weight: 1.0,
          max_score: 30,
          order_index: 1
        },
        {
          title: 'Cálculo de SAM (Serviceable Available Market)',
          description: 'Identificación correcta del segmento de mercado que puede ser atendido con la propuesta actual. Justificación clara de las limitaciones que definen el SAM.',
          weight: 1.0,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Cálculo de SOM (Serviceable Obtainable Market)',
          description: 'Estimación realista de la participación de mercado alcanzable a corto plazo. Incluye análisis de capacidad operativa, recursos disponibles y estrategia de entrada.',
          weight: 1.0,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Metodología y fuentes de datos',
          description: 'Uso de metodologías apropiadas para la cuantificación. Fuentes de datos confiables y actualizadas. Documentación clara de los cálculos y supuestos utilizados.',
          weight: 1.0,
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
          weight: 1.0,
          max_score: 30,
          order_index: 1
        },
        {
          title: 'Diferenciación competitiva',
          description: 'Se identifica claramente qué hace único al proyecto y cómo se diferencia de la competencia. La propuesta de valor es distintiva y difícil de replicar.',
          weight: 1.0,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Alineación con segmento de clientes',
          description: 'La propuesta de valor está perfectamente alineada con las necesidades, motivaciones y frustraciones del segmento de clientes identificado. Evidencia de investigación de mercado.',
          weight: 1.0,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Comunicación y claridad',
          description: 'La propuesta de valor se comunica de manera clara, concisa y memorable. Está conectada con la misión, visión y valores del proyecto.',
          weight: 1.0,
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
          weight: 1.0,
          max_score: 35,
          order_index: 1
        },
        {
          title: 'Modelo de ingresos',
          description: 'Los flujos de ingresos están claramente definidos y son viables. Se explica cómo se captura valor y se generan ingresos de manera sostenible.',
          weight: 1.0,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Recursos y actividades clave',
          description: 'Identificación precisa de los recursos y actividades necesarios para entregar la propuesta de valor. Análisis de viabilidad operativa y de recursos disponibles.',
          weight: 1.0,
          max_score: 20,
          order_index: 3
        },
        {
          title: 'Ventaja competitiva sostenible',
          description: 'Identificación de ventajas competitivas internas y externas. Análisis de sostenibilidad y dificultad de réplica por parte de la competencia.',
          weight: 1.0,
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
          weight: 1.0,
          max_score: 30,
          order_index: 1
        },
        {
          title: 'Comunicación visual y diseño',
          description: 'La presentación visual es profesional, con diseño claro y atractivo. Cumple con las mejores prácticas (máximo 6 palabras por diapositiva, tipografía legible, imágenes potentes).',
          weight: 1.0,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Contenido y argumentación',
          description: 'El contenido del pitch cubre los aspectos clave: problema, solución, mercado, modelo de negocio y propuesta de valor. Los argumentos están respaldados por los análisis previos.',
          weight: 1.0,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Calidad del vídeo y presentación',
          description: 'El vídeo del pitch es de calidad profesional, con buena producción audiovisual. La presentación es fluida, natural y demuestra dominio del proyecto. Duración adecuada (3-5 minutos).',
          weight: 1.0,
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
          weight: 1.0,
          max_score: 30,
          order_index: 1
        },
        {
          title: 'Diseño y planificación del MVP',
          description: 'Definición clara del producto mínimo viable, con identificación de funcionalidades esenciales. Planificación de experimentos para validar hipótesis críticas con recursos mínimos.',
          weight: 1.0,
          max_score: 25,
          order_index: 2
        },
        {
          title: 'Roadmap y planificación (Diagrama de Gantt)',
          description: 'Planificación detallada con diagrama de Gantt que incluye tareas, dependencias, responsables y fechas. Identificación de ruta crítica y gestión de recursos.',
          weight: 1.0,
          max_score: 25,
          order_index: 3
        },
        {
          title: 'Viabilidad y ejecución',
          description: 'El plan de validación y desarrollo del MVP es realista y ejecutable. Se identifican recursos necesarios, riesgos potenciales y estrategias de mitigación.',
          weight: 1.0,
          max_score: 20,
          order_index: 4
        }
      ]
    }
  };

  // Crear rúbricas para cada fase
  for (const phase of phases) {
    const rubricDef = rubricsByPhase[phase.name];

    if (!rubricDef) {
      console.warn(`No se encontró definición de rúbrica para la fase: ${phase.name}`);
      continue;
    }

    // Verificar si ya existe una rúbrica para esta fase
    const [[existingRubric]] = await queryInterface.sequelize.query(
      `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND phase_id = ${phase.id} LIMIT 1`
    );

    if (existingRubric) {
      console.log(`Ya existe una rúbrica para ${phase.name}, omitiendo...`);
      continue;
    }

    // Insertar la rúbrica
    await queryInterface.bulkInsert('phase_rubrics', [
      {
        tenant_id: tenant.id,
        event_id: event.id,
        phase_id: phase.id,
        name: rubricDef.name,
        description: rubricDef.description,
        scale_min: 0,
        scale_max: 100,
        model_preference: null,
        created_by: adminUser.id,
        updated_by: adminUser.id,
        created_at: now,
        updated_at: now
      }
    ]);

    // Obtener el ID de la rúbrica recién creada
    const [[rubric]] = await queryInterface.sequelize.query(
      `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND phase_id = ${phase.id} ORDER BY created_at DESC LIMIT 1`
    );

    if (!rubric) {
      throw new Error(`No se pudo recuperar la rúbrica creada para ${phase.name}`);
    }

    // Insertar los criterios de la rúbrica
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

  // Obtener todas las rúbricas del evento
  const [rubrics] = await queryInterface.sequelize.query(
    `SELECT id FROM phase_rubrics WHERE tenant_id = ${tenant.id} AND event_id = ${event.id}`
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
      event_id: event.id
    });
  }
}

