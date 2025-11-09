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
      type: Sequelize.ENUM('free', 'basic', 'professional', 'enterprise'),
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
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
    avatar_url: {
      type: Sequelize.STRING(500)
    },
    language: {
      type: Sequelize.STRING(10),
      defaultValue: 'es'
    },
    profile_image_url: {
      type: Sequelize.STRING(500)
    },
    status: {
      type: Sequelize.ENUM('active', 'inactive', 'invited'),
      defaultValue: 'active'
    },
    is_super_admin: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      type: Sequelize.STRING(255),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
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
    publish_start_at: {
      type: Sequelize.DATE
    },
    publish_end_at: {
      type: Sequelize.DATE
    },
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      type: Sequelize.STRING(200),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
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
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      allowNull: false,
      references: {
        model: 'phases',
        key: 'id'
      },
      onDelete: 'CASCADE'
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
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      type: Sequelize.ENUM('draft', 'active', 'completed'),
      defaultValue: 'draft'
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
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      type: Sequelize.STRING(255),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
    },
    delivery_type: {
      type: Sequelize.ENUM('text', 'file', 'url', 'video', 'audio', 'zip'),
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
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
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
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      allowNull: false,
      references: { model: 'submissions', key: 'id' },
      onDelete: 'CASCADE'
    },
    reviewer_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    score: {
      type: Sequelize.DECIMAL(5, 2)
    },
    comment: {
      type: Sequelize.TEXT
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
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  });

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
  await queryInterface.addIndex('notifications', ['tenant_id', 'user_id']);
}

export async function down(queryInterface) {
  await queryInterface.removeIndex('user_tenant_roles', ['tenant_id', 'role_id']);
  await queryInterface.removeIndex('user_tenants', ['tenant_id', 'user_id']);
  await queryInterface.removeIndex('notifications', ['tenant_id', 'user_id']);
  await queryInterface.removeIndex('evaluations', ['tenant_id', 'submission_id']);
  await queryInterface.removeIndex('submissions', ['tenant_id', 'task_id']);
  await queryInterface.removeIndex('projects', ['tenant_id', 'event_id']);
  await queryInterface.removeIndex('team_members', ['tenant_id', 'user_id']);
  await queryInterface.removeIndex('teams', ['tenant_id', 'event_id']);
  await queryInterface.removeIndex('tasks', ['tenant_id', 'event_id', 'phase_id']);
  await queryInterface.removeIndex('phases', ['tenant_id', 'event_id', 'order_index']);
  await queryInterface.removeIndex('phases', ['tenant_id', 'view_start_date', 'view_end_date']);
  await queryInterface.removeIndex('events', ['tenant_id', 'start_date']);
  await queryInterface.removeIndex('users', ['tenant_id', 'email']);

  await queryInterface.dropTable('notifications');
  await queryInterface.dropTable('evaluations');
  await queryInterface.dropTable('submission_files');
  await queryInterface.dropTable('submissions');
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
