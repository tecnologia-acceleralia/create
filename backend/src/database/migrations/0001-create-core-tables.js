/**
 * Migración consolidada que crea todas las tablas del sistema en su versión final.
 * 
 * Esta migración incluye todos los cambios de las migraciones 0002-0017:
 * - Tablas: password_reset_tokens, event_assets
 * - Campos multiidioma (JSON) en events, tasks, phases
 * - Campos de evaluación con IA en events
 * - Campos de evaluación extendida en evaluations
 * - registration_answers en users (sin grade)
 * - Timestamps corregidos en todas las tablas
 * - ENUMs actualizados (delivery_type incluye 'none')
 */

export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('tenants', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    slug: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    subdomain: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true
    },
    custom_domain: {
      type: Sequelize.STRING(255)
    },
    logo_url: {
      type: Sequelize.STRING(500)
    },
    primary_color: {
      type: Sequelize.STRING(7)
    },
    secondary_color: {
      type: Sequelize.STRING(7)
    },
    accent_color: {
      type: Sequelize.STRING(7)
    },
    start_date: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      defaultValue: Sequelize.literal('(CURRENT_DATE)')
    },
    end_date: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      defaultValue: '2099-12-31'
    },
    tenant_css: {
      type: Sequelize.TEXT('long')
    },
    website_url: {
      type: Sequelize.STRING(500)
    },
    facebook_url: {
      type: Sequelize.STRING(500)
    },
    instagram_url: {
      type: Sequelize.STRING(500)
    },
    linkedin_url: {
      type: Sequelize.STRING(500)
    },
    twitter_url: {
      type: Sequelize.STRING(500)
    },
    youtube_url: {
      type: Sequelize.STRING(500)
    },
    hero_content: {
      type: Sequelize.JSON,
      comment: 'Contenido del hero por idioma'
    },
    plan_type: {
      type: Sequelize.ENUM('free', 'professional', 'enterprise'),
      defaultValue: 'free'
    },
    max_evaluators: {
      type: Sequelize.INTEGER.UNSIGNED
    },
    max_participants: {
      type: Sequelize.INTEGER.UNSIGNED
    },
    max_appointments_per_month: {
      type: Sequelize.INTEGER.UNSIGNED
    },
    status: {
      type: Sequelize.ENUM('active', 'suspended', 'trial', 'cancelled'),
      defaultValue: 'trial'
    },
    registration_schema: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Esquema de registro personalizado del tenant'
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('roles', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE',
      allowNull: true
    },
    name: {
      type: Sequelize.STRING(150),
      allowNull: false
    },
    scope: {
      type: Sequelize.ENUM('super_admin', 'tenant_admin', 'organizer', 'evaluator', 'participant', 'team_captain'),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('users', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    email: {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true
    },
    password: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    first_name: {
      type: Sequelize.STRING(150),
      allowNull: false
    },
    last_name: {
      type: Sequelize.STRING(150),
      allowNull: false
    },
    language: {
      type: Sequelize.STRING(10),
      defaultValue: 'es'
    },
    profile_image_url: {
      type: Sequelize.STRING(500)
    },
    registration_answers: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Respuestas adicionales del usuario al formulario de registro según el schema del tenant'
    },
    status: {
      type: Sequelize.ENUM('active', 'inactive', 'invited'),
      defaultValue: 'active'
    },
    last_login_at: {
      type: Sequelize.DATE,
      allowNull: true
    },
    is_super_admin: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('user_tenants', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    status: {
      type: Sequelize.ENUM('active', 'inactive', 'invited'),
      defaultValue: 'active'
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.addConstraint('user_tenants', {
    type: 'unique',
    fields: ['user_id', 'tenant_id'],
    name: 'uniq_user_tenants_user_tenant'
  });

  await queryInterface.createTable('user_tenant_roles', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    user_tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'user_tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    role_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    created_at: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.addConstraint('user_tenant_roles', {
    type: 'unique',
    fields: ['user_tenant_id', 'role_id'],
    name: 'uniq_user_tenant_roles_assignment'
  });

  await queryInterface.createTable('events', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    created_by: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'RESTRICT'
    },
    name: {
      type: Sequelize.JSON,
      allowNull: false,
      comment: 'Nombre del evento por idioma: { "es": "...", "ca": "...", "en": "..." }'
    },
    description: {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Descripción del evento por idioma: { "es": "...", "ca": "...", "en": "..." }'
    },
    description_html: {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Contenido HTML de la descripción por idioma: { "es": "...", "ca": "...", "en": "..." }'
    },
    start_date: {
      type: Sequelize.DATE,
      allowNull: false
    },
    end_date: {
      type: Sequelize.DATE,
      allowNull: false
    },
    min_team_size: {
      type: Sequelize.INTEGER.UNSIGNED,
      defaultValue: 1
    },
    max_team_size: {
      type: Sequelize.INTEGER.UNSIGNED,
      defaultValue: 8
    },
    status: {
      type: Sequelize.ENUM('draft', 'published', 'archived'),
      defaultValue: 'draft'
    },
    video_url: {
      type: Sequelize.STRING(500)
    },
    is_public: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    allow_open_registration: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    registration_schema: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Schema definition for registration additional fields (grade, custom fields, etc.)'
    },
    publish_start_at: {
      type: Sequelize.DATE
    },
    publish_end_at: {
      type: Sequelize.DATE
    },
    ai_evaluation_prompt: {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Prompt personalizado para la evaluación con IA en texto plano (un solo idioma). El idioma de respuesta se indica al ejecutar el prompt. Si está vacío, se usa el prompt por defecto.'
    },
    ai_evaluation_model: {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Modelo de OpenAI a usar para la evaluación con IA. Si está vacío, se usa el modelo por defecto del sistema.'
    },
    ai_evaluation_temperature: {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      comment: 'Temperatura para la evaluación con IA (0-2). Si está vacío, se usa 0.2 por defecto.'
    },
    ai_evaluation_max_tokens: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      comment: 'Máximo de tokens en la respuesta de OpenAI. Si está vacío, no se limita.'
    },
    ai_evaluation_top_p: {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      comment: 'Top-p (nucleus sampling) para la evaluación con IA (0-1). Si está vacío, se usa 1.0 por defecto.'
    },
    ai_evaluation_frequency_penalty: {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      comment: 'Penalización por frecuencia para la evaluación con IA (-2.0 a 2.0). Si está vacío, se usa 0.0 por defecto.'
    },
    ai_evaluation_presence_penalty: {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      comment: 'Penalización por presencia para la evaluación con IA (-2.0 a 2.0). Si está vacío, se usa 0.0 por defecto.'
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('phases', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    name: {
      type: Sequelize.JSON,
      allowNull: false,
      comment: 'Nombre de la fase por idioma: { "es": "...", "ca": "...", "en": "..." }'
    },
    description: {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Descripción de la fase por idioma: { "es": "...", "ca": "...", "en": "..." }'
    },
    intro_html: {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Contenido HTML de introducción por idioma: { "es": "...", "ca": "...", "en": "..." }'
    },
    start_date: {
      type: Sequelize.DATE
    },
    end_date: {
      type: Sequelize.DATE
    },
    view_start_date: {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Controla desde cuándo la fase es visible en navegación'
    },
    view_end_date: {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Controla hasta cuándo la fase es visible en navegación'
    },
    order_index: {
      type: Sequelize.INTEGER.UNSIGNED,
      defaultValue: 1
    },
    is_elimination: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('phase_rubrics', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    phase_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'phases',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: 'NULL para rúbricas de proyecto completo, obligatorio para rúbricas de fase'
    },
    rubric_scope: {
      type: Sequelize.ENUM('phase', 'project'),
      allowNull: false,
      defaultValue: 'phase',
      comment: 'Indica si la rúbrica es para una fase específica o para el proyecto completo'
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
    },
    scale_min: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    scale_max: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 100
    },
    model_preference: {
      type: Sequelize.STRING(100)
    },
    created_by: {
      type: Sequelize.INTEGER.UNSIGNED,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    updated_by: {
      type: Sequelize.INTEGER.UNSIGNED,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    created_at: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('phase_rubric_criteria', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    rubric_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'phase_rubrics',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
    },
    weight: {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: '1.00'
    },
    max_score: {
      type: Sequelize.DECIMAL(5, 2)
    },
    order_index: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1
    },
    created_at: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('teams', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE'
    },
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'events', key: 'id' },
      onDelete: 'CASCADE'
    },
    captain_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL'
    },
    name: {
      type: Sequelize.STRING(200),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
    },
    requirements: {
      type: Sequelize.TEXT
    },
    status: {
      type: Sequelize.ENUM('open', 'closed'),
      defaultValue: 'open'
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('team_members', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE'
    },
    team_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    role: {
      type: Sequelize.ENUM('captain', 'member', 'evaluator'),
      defaultValue: 'member'
    },
    status: {
      type: Sequelize.ENUM('active', 'pending', 'invited'),
      defaultValue: 'active'
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.addConstraint('team_members', {
    type: 'unique',
    fields: ['team_id', 'user_id'],
    name: 'uniq_team_member'
  });

  await queryInterface.createTable('projects', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE'
    },
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'events', key: 'id' },
      onDelete: 'CASCADE'
    },
    team_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
      onDelete: 'CASCADE'
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    summary: {
      type: Sequelize.TEXT
    },
    problem: {
      type: Sequelize.TEXT
    },
    solution: {
      type: Sequelize.TEXT
    },
    status: {
      type: Sequelize.ENUM('active', 'inactive'),
      defaultValue: 'active'
    },
    logo_url: {
      type: Sequelize.STRING(500)
    },
    repository_url: {
      type: Sequelize.STRING(500)
    },
    pitch_url: {
      type: Sequelize.STRING(500)
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('tasks', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    phase_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'phases',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    phase_rubric_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      references: {
        model: 'phase_rubrics',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },
    title: {
      type: Sequelize.JSON,
      allowNull: false,
      comment: 'Título de la tarea por idioma: { "es": "...", "ca": "...", "en": "..." }'
    },
    description: {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Descripción de la tarea por idioma: { "es": "...", "ca": "...", "en": "..." }'
    },
    intro_html: {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Contenido HTML de introducción por idioma: { "es": "...", "ca": "...", "en": "..." }'
    },
    delivery_type: {
      type: Sequelize.ENUM('text', 'file', 'url', 'video', 'audio', 'zip', 'none'),
      defaultValue: 'file'
    },
    is_required: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    },
    due_date: {
      type: Sequelize.DATE
    },
    status: {
      type: Sequelize.ENUM('draft', 'active', 'closed'),
      defaultValue: 'draft'
    },
    order_index: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1
    },
    max_files: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1
    },
    max_file_size_mb: {
      type: Sequelize.INTEGER.UNSIGNED
    },
    allowed_mime_types: {
      type: Sequelize.JSON
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('event_registrations', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    grade: {
      type: Sequelize.STRING(255),
      allowNull: true
    },
    answers: {
      type: Sequelize.JSON,
      allowNull: true
    },
    status: {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'registered'
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.addConstraint('event_registrations', {
    type: 'unique',
    fields: ['event_id', 'user_id'],
    name: 'uniq_event_registration_user'
  });

  await queryInterface.createTable('submissions', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE'
    },
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'events', key: 'id' },
      onDelete: 'CASCADE'
    },
    task_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tasks', key: 'id' },
      onDelete: 'CASCADE'
    },
    team_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
      onDelete: 'CASCADE'
    },
    submitted_by: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    status: {
      type: Sequelize.ENUM('draft', 'final'),
      defaultValue: 'draft'
    },
    type: {
      type: Sequelize.ENUM('provisional', 'final'),
      defaultValue: 'provisional'
    },
    content: {
      type: Sequelize.TEXT
    },
    attachment_url: {
      type: Sequelize.STRING(500)
    },
    submitted_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('submission_files', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    submission_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'submissions',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    url: {
      type: Sequelize.STRING(500),
      allowNull: false
    },
    storage_key: {
      type: Sequelize.STRING(500),
      allowNull: false
    },
    mime_type: {
      type: Sequelize.STRING(150),
      allowNull: false
    },
    size_bytes: {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: false
    },
    original_name: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    checksum: {
      type: Sequelize.STRING(128)
    },
    created_at: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('evaluations', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE'
    },
    submission_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'submissions', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'ID de la submission evaluada (nullable para evaluaciones de fase/proyecto)'
    },
    reviewer_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    evaluation_scope: {
      type: Sequelize.ENUM('submission', 'phase', 'project'),
      allowNull: false,
      defaultValue: 'submission',
      comment: 'Tipo de evaluación: submission (individual), phase (por fase), project (por proyecto)'
    },
    phase_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'phases',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: 'ID de la fase evaluada (solo para evaluation_scope = phase)'
    },
    project_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'projects',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: 'ID del proyecto evaluado (solo para evaluation_scope = project)'
    },
    team_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'teams',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: 'ID del equipo evaluado (para phase y project)'
    },
    evaluated_submission_ids: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Array de IDs de submissions usadas en la evaluación (para phase y project)'
    },
    score: {
      type: Sequelize.DECIMAL(5, 2)
    },
    comment: {
      type: Sequelize.TEXT
    },
    status: {
      type: Sequelize.ENUM('draft', 'final'),
      allowNull: false,
      defaultValue: 'draft'
    },
    source: {
      type: Sequelize.ENUM('manual', 'ai_assisted'),
      allowNull: false,
      defaultValue: 'manual'
    },
    rubric_snapshot: {
      type: Sequelize.JSON
    },
    metadata: {
      type: Sequelize.JSON
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  await queryInterface.createTable('notifications', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    message: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    type: {
      type: Sequelize.ENUM('system', 'evaluation', 'reminder'),
      defaultValue: 'system'
    },
    is_read: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  // Tabla password_reset_tokens (0002)
  await queryInterface.createTable('password_reset_tokens', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    code_hash: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    expires_at: {
      type: Sequelize.DATE,
      allowNull: false
    },
    consumed_at: {
      type: Sequelize.DATE,
      allowNull: true
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  // Tabla event_assets (0003)
  await queryInterface.createTable('event_assets', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'Nombre identificador del recurso (usado en marcadores)'
    },
    original_filename: {
      type: Sequelize.STRING(500),
      allowNull: false,
      comment: 'Nombre original del archivo subido'
    },
    s3_key: {
      type: Sequelize.STRING(1000),
      allowNull: false,
      comment: 'Clave del objeto en S3/Spaces'
    },
    url: {
      type: Sequelize.STRING(1000),
      allowNull: false,
      comment: 'URL pública del archivo'
    },
    mime_type: {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'Tipo MIME del archivo'
    },
    file_size: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Tamaño del archivo en bytes'
    },
    description: {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Texto descriptivo del recurso que se mostrará en lugar de la URL completa'
    },
    uploaded_by: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'RESTRICT'
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }
  });

  // Índices
  await queryInterface.addIndex('user_tenants', ['tenant_id', 'user_id']);
  await queryInterface.addIndex('user_tenant_roles', ['tenant_id', 'role_id']);
  await queryInterface.addIndex('events', ['tenant_id', 'start_date']);
  await queryInterface.addIndex('phases', ['tenant_id', 'event_id', 'order_index']);
  await queryInterface.addIndex('phases', ['tenant_id', 'view_start_date', 'view_end_date']);
  await queryInterface.addIndex('tasks', ['tenant_id', 'event_id', 'phase_id']);
  await queryInterface.addIndex('teams', ['tenant_id', 'event_id']);
  await queryInterface.addIndex('team_members', ['tenant_id', 'user_id']);
  await queryInterface.addIndex('projects', ['tenant_id', 'event_id']);
  await queryInterface.addIndex('submissions', ['tenant_id', 'task_id']);
  await queryInterface.addIndex('evaluations', ['tenant_id', 'submission_id']);
  await queryInterface.addIndex('event_registrations', ['tenant_id', 'event_id'], {
    name: 'event_registrations_tenant_event_idx'
  });
  await queryInterface.addIndex('event_registrations', ['tenant_id', 'grade'], {
    name: 'event_registrations_tenant_grade_idx'
  });
  await queryInterface.addIndex('notifications', ['tenant_id', 'user_id']);
  await queryInterface.addIndex('password_reset_tokens', ['tenant_id', 'user_id'], {
    name: 'password_reset_tokens_tenant_user_idx'
  });
  await queryInterface.addIndex('password_reset_tokens', ['tenant_id', 'expires_at'], {
    name: 'password_reset_tokens_tenant_expiration_idx'
  });
  await queryInterface.addIndex('event_assets', ['tenant_id', 'event_id'], {
    name: 'idx_event_assets_tenant_event'
  });
  await queryInterface.addIndex('event_assets', ['tenant_id', 'event_id', 'name'], {
    name: 'idx_event_assets_tenant_event_name',
    unique: true
  });
  await queryInterface.addIndex('event_assets', ['event_id'], {
    name: 'idx_event_assets_event'
  });
}

export async function down(queryInterface) {
  await queryInterface.removeIndex('event_assets', 'idx_event_assets_event');
  await queryInterface.removeIndex('event_assets', 'idx_event_assets_tenant_event_name');
  await queryInterface.removeIndex('event_assets', 'idx_event_assets_tenant_event');
  await queryInterface.removeIndex('password_reset_tokens', 'password_reset_tokens_tenant_expiration_idx');
  await queryInterface.removeIndex('password_reset_tokens', 'password_reset_tokens_tenant_user_idx');
  await queryInterface.removeIndex('notifications', ['tenant_id', 'user_id']);
  await queryInterface.removeIndex('event_registrations', 'event_registrations_tenant_grade_idx');
  await queryInterface.removeIndex('event_registrations', 'event_registrations_tenant_event_idx');
  await queryInterface.removeIndex('evaluations', ['tenant_id', 'submission_id']);
  await queryInterface.removeIndex('submissions', ['tenant_id', 'task_id']);
  await queryInterface.removeIndex('projects', ['tenant_id', 'event_id']);
  await queryInterface.removeIndex('team_members', ['tenant_id', 'user_id']);
  await queryInterface.removeIndex('teams', ['tenant_id', 'event_id']);
  await queryInterface.removeIndex('tasks', ['tenant_id', 'event_id', 'phase_id']);
  await queryInterface.removeIndex('phases', ['tenant_id', 'view_start_date', 'view_end_date']);
  await queryInterface.removeIndex('phases', ['tenant_id', 'event_id', 'order_index']);
  await queryInterface.removeIndex('events', ['tenant_id', 'start_date']);
  await queryInterface.removeIndex('user_tenant_roles', ['tenant_id', 'role_id']);
  await queryInterface.removeIndex('user_tenants', ['tenant_id', 'user_id']);

  await queryInterface.dropTable('event_assets');
  await queryInterface.dropTable('password_reset_tokens');
  await queryInterface.dropTable('notifications');
  await queryInterface.dropTable('evaluations');
  await queryInterface.dropTable('submission_files');
  await queryInterface.dropTable('submissions');
  await queryInterface.removeConstraint('event_registrations', 'uniq_event_registration_user');
  await queryInterface.dropTable('event_registrations');
  await queryInterface.dropTable('tasks');
  await queryInterface.dropTable('projects');
  await queryInterface.dropTable('team_members');
  await queryInterface.dropTable('teams');
  await queryInterface.dropTable('phase_rubric_criteria');
  await queryInterface.dropTable('phase_rubrics');
  await queryInterface.dropTable('phases');
  await queryInterface.dropTable('events');
  await queryInterface.dropTable('user_tenant_roles');
  await queryInterface.dropTable('user_tenants');
  await queryInterface.dropTable('users');
  await queryInterface.dropTable('roles');
  await queryInterface.dropTable('tenants');
}
