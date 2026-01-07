import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { AuthService } from '../services/auth.service.js';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { getUserGrade, setGradeInAnswers } from '../utils/user-helpers.js';

const AUTH_MESSAGES = {
  TENANT_NOT_RESOLVED: 'Tenant no resuelto',
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  USER_NOT_IN_TENANT: 'El usuario no pertenece a este espacio',
  USER_INACTIVE: 'El usuario no tiene acceso activo a este espacio',
  LOGIN_ERROR: 'Error al iniciar sesión',
  REFRESH_TOKEN_INVALID: 'Refresh token inválido',
  SUPERADMIN_ONLY: 'Acceso restringido a super-administradores',
  SUPERADMIN_LOGIN_ERROR: 'Error en login de superadmin',
  REGISTRATION_DISABLED: 'El registro no está habilitado en este espacio',
  EMAIL_ALREADY_TAKEN: 'Este correo ya está registrado. Inicia sesión para continuar',
  REGISTRATION_ERROR: 'No se pudo completar el registro'
};

function serializeMembership(membership) {
  if (!membership) {
    return null;
  }

  return {
    id: membership.id,
    tenantId: membership.tenant_id,
    status: membership.status,
    tenant: membership.tenant
      ? {
          id: membership.tenant.id,
          slug: membership.tenant.slug,
          name: membership.tenant.name,
          status: membership.tenant.status
        }
      : null,
    roles:
      membership.assignedRoles?.map(role => ({
        id: role.id,
        name: role.name,
        scope: role.scope
      })) ?? []
  };
}


/**
 * Verifica qué campos requeridos del schema faltan en los datos del usuario
 * @param {Object} schema - Schema de registro (tenant o evento)
 * @param {Object} userData - Datos del usuario (registration_answers, EventRegistration.answers)
 * @returns {Array} Array de campos faltantes con su configuración
 */
function checkMissingRequiredFields(schema, userData) {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  const missingFields = [];
  // Obtener grade desde registration_answers o desde userData.answers (para EventRegistration)
  const userAnswers = userData.answers || userData.registration_answers || {};
  const userGrade = userAnswers.grade || null;

  // Verificar campo grade si existe en el schema
  if (schema.grade && typeof schema.grade === 'object') {
    const gradeConfig = schema.grade;
    if (gradeConfig.required && !userGrade) {
      missingFields.push({
        id: 'grade',
        label: gradeConfig.label || { es: 'Grado' },
        type: 'select',
        required: true,
        options: gradeConfig.options || []
      });
    }
  }

  // Verificar campos adicionales
  const additionalFields = Array.isArray(schema.additionalFields)
    ? schema.additionalFields.filter(field => field && typeof field === 'object')
    : [];

  for (const field of additionalFields) {
    if (!field.id || !field.required) {
      continue;
    }

    const fieldId = typeof field.id === 'string' ? field.id.trim() : null;
    if (!fieldId) {
      continue;
    }

    const answer = userAnswers[fieldId];
    const hasAnswer =
      answer !== undefined &&
      answer !== null &&
      !(typeof answer === 'string' && answer.trim().length === 0);

    if (!hasAnswer) {
      missingFields.push({
        id: fieldId,
        label: field.label || fieldId,
        type: field.type || 'text',
        required: true,
        options: field.options || []
      });
    }
  }

  return missingFields;
}

export class AuthController {
  static async register(req, res) {
    const models = getModels();
    const { User, Event, Role, UserTenant, UserTenantRole, Tenant, EventRegistration } = models;
    const transaction = await User.sequelize.transaction();
    try {
      const tenant = req.tenant;
      if (!tenant) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: AUTH_MESSAGES.TENANT_NOT_RESOLVED });
      }

      const {
        first_name: rawFirstName,
        last_name: rawLastName,
        email: rawEmail,
        password,
        language,
        event_id: eventId,
        grade: rawGrade,
        registration_answers: rawRegistrationAnswers
      } = req.body;

      const firstName = rawFirstName.trim();
      const lastName = rawLastName.trim();
      const email = rawEmail.toLowerCase();
      const registrationAnswers =
        rawRegistrationAnswers && typeof rawRegistrationAnswers === 'object' && !Array.isArray(rawRegistrationAnswers)
          ? rawRegistrationAnswers
          : {};
      const gradeFromBody =
        typeof rawGrade === 'string' && rawGrade.trim().length ? rawGrade.trim() : null;
      let resolvedGrade = gradeFromBody;
      const parsedAnswers = {};

      // Procesar evento si se proporciona (opcional)
      let registrationEvent = null;
      if (eventId) {
        const now = new Date();
        const baseEventFilters = {
          tenant_id: tenant.id,
          status: 'published',
          is_public: true,
          allow_open_registration: true,
          [Op.and]: [
            {
              [Op.or]: [
                { publish_start_at: { [Op.is]: null } },
                { publish_start_at: { [Op.lte]: now } }
              ]
            },
            {
              [Op.or]: [
                { publish_end_at: { [Op.is]: null } },
                { publish_end_at: { [Op.gte]: now } }
              ]
            }
          ]
        };

        registrationEvent = await Event.findOne({
          where: {
            ...baseEventFilters,
            id: eventId
          },
          transaction
        });

        if (!registrationEvent) {
          await transaction.rollback();
          return res
            .status(403)
            .json({ success: false, message: AUTH_MESSAGES.REGISTRATION_DISABLED });
        }

        // Validar schema del evento si existe
        const eventRegistrationSchema =
          registrationEvent.registration_schema && typeof registrationEvent.registration_schema === 'object'
            ? registrationEvent.registration_schema
            : null;

        if (eventRegistrationSchema) {
          const eventGradeFieldConfig =
            eventRegistrationSchema.grade && typeof eventRegistrationSchema.grade === 'object'
              ? eventRegistrationSchema.grade
              : null;

          if (eventGradeFieldConfig) {
            const gradeFromAnswers =
              typeof registrationAnswers.grade === 'string' && registrationAnswers.grade.trim().length
                ? registrationAnswers.grade.trim()
                : null;

            if (!resolvedGrade && gradeFromAnswers) {
              resolvedGrade = gradeFromAnswers;
            }

            const allowedGradeValues = Array.isArray(eventGradeFieldConfig.options)
              ? eventGradeFieldConfig.options
                  .map(option => {
                    if (typeof option === 'string') {
                      return option;
                    }
                    if (option && typeof option === 'object' && typeof option.value === 'string') {
                      return option.value;
                    }
                    return null;
                  })
                  .filter(Boolean)
              : [];

            if (eventGradeFieldConfig.required && !resolvedGrade) {
              await transaction.rollback();
              return res
                .status(400)
                .json({ success: false, message: 'Debes seleccionar un grado para completar el registro' });
            }

            if (resolvedGrade && allowedGradeValues.length && !allowedGradeValues.includes(resolvedGrade)) {
              await transaction.rollback();
              return res.status(400).json({
                success: false,
                message: 'El grado seleccionado no es válido para este evento'
              });
            }

            if (resolvedGrade) {
              parsedAnswers.grade = resolvedGrade;
            }
          }

          // Validar campos adicionales del schema del evento
          const eventAdditionalFields = Array.isArray(eventRegistrationSchema.additionalFields)
            ? eventRegistrationSchema.additionalFields.filter(field => field && typeof field === 'object')
            : [];

          for (const field of eventAdditionalFields) {
            const fieldId =
              typeof field.id === 'string' && field.id.trim().length ? field.id.trim() : null;

            if (!fieldId) {
              continue;
            }

            const rawAnswer = registrationAnswers[fieldId];
            const hasAnswer =
              rawAnswer !== undefined &&
              rawAnswer !== null &&
              !(typeof rawAnswer === 'string' && rawAnswer.trim().length === 0);

            if (field.required && !hasAnswer) {
              await transaction.rollback();
              return res.status(400).json({
                success: false,
                message: `Falta completar el campo requerido: ${field.label ?? fieldId}`
              });
            }

            if (!hasAnswer) {
              continue;
            }

            if (field.type === 'select') {
              if (typeof rawAnswer !== 'string' || rawAnswer.trim().length === 0) {
                await transaction.rollback();
                return res.status(400).json({
                  success: false,
                  message: `El valor seleccionado para ${field.label ?? fieldId} no es válido`
                });
              }

              const allowedValues = Array.isArray(field.options)
                ? field.options
                    .map(option => {
                      if (typeof option === 'string') {
                        return option;
                      }
                      if (option && typeof option === 'object' && typeof option.value === 'string') {
                        return option.value;
                      }
                      return null;
                    })
                    .filter(Boolean)
                : [];

              const trimmedValue = rawAnswer.trim();

              if (allowedValues.length && !allowedValues.includes(trimmedValue)) {
                await transaction.rollback();
                return res.status(400).json({
                  success: false,
                  message: `El valor seleccionado para ${field.label ?? fieldId} no es válido`
                });
              }

              parsedAnswers[fieldId] = trimmedValue;
            } else {
              const normalizedValue =
                typeof rawAnswer === 'string' ? rawAnswer.trim() : String(rawAnswer);
              parsedAnswers[fieldId] = normalizedValue;
            }
          }
        }
      }

      // Siempre validar schema de registro del tenant si existe
      let tenantRegistrationSchema = null;
      if (tenant.registration_schema) {
        if (typeof tenant.registration_schema === 'object') {
          tenantRegistrationSchema = tenant.registration_schema;
        } else if (typeof tenant.registration_schema === 'string') {
          try {
            tenantRegistrationSchema = JSON.parse(tenant.registration_schema);
          } catch {
            tenantRegistrationSchema = null;
          }
        }
      }

      if (tenantRegistrationSchema) {
        const tenantGradeFieldConfig =
          tenantRegistrationSchema.grade && typeof tenantRegistrationSchema.grade === 'object'
            ? tenantRegistrationSchema.grade
            : null;

        if (tenantGradeFieldConfig) {
          const gradeFromAnswers =
            typeof registrationAnswers.grade === 'string' && registrationAnswers.grade.trim().length
              ? registrationAnswers.grade.trim()
              : null;

          if (!resolvedGrade && gradeFromAnswers) {
            resolvedGrade = gradeFromAnswers;
          }

          const allowedGradeValues = Array.isArray(tenantGradeFieldConfig.options)
            ? tenantGradeFieldConfig.options
                .map(option => {
                  if (typeof option === 'string') {
                    return option;
                  }
                  if (option && typeof option === 'object' && typeof option.value === 'string') {
                    return option.value;
                  }
                  return null;
                })
                .filter(Boolean)
            : [];

          if (tenantGradeFieldConfig.required && !resolvedGrade) {
            await transaction.rollback();
            return res
              .status(400)
              .json({ success: false, message: 'Debes seleccionar un grado para completar el registro' });
          }

          if (resolvedGrade && allowedGradeValues.length && !allowedGradeValues.includes(resolvedGrade)) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: 'El grado seleccionado no es válido'
            });
          }

          if (resolvedGrade && !parsedAnswers.grade) {
            parsedAnswers.grade = resolvedGrade;
          }
        }

        // Validar campos adicionales del schema del tenant
        const tenantAdditionalFields = Array.isArray(tenantRegistrationSchema.additionalFields)
          ? tenantRegistrationSchema.additionalFields.filter(field => field && typeof field === 'object')
          : [];

        for (const field of tenantAdditionalFields) {
          const fieldId =
            typeof field.id === 'string' && field.id.trim().length ? field.id.trim() : null;

          if (!fieldId) {
            continue;
          }

          // Solo validar si el campo no fue ya procesado por el schema del evento
          if (parsedAnswers[fieldId] !== undefined) {
            continue;
          }

          const rawAnswer = registrationAnswers[fieldId];
          const hasAnswer =
            rawAnswer !== undefined &&
            rawAnswer !== null &&
            !(typeof rawAnswer === 'string' && rawAnswer.trim().length === 0);

          if (field.required && !hasAnswer) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: `Falta completar el campo requerido: ${field.label ?? fieldId}`
            });
          }

          if (!hasAnswer) {
            continue;
          }

          if (field.type === 'select') {
            if (typeof rawAnswer !== 'string' || rawAnswer.trim().length === 0) {
              await transaction.rollback();
              return res.status(400).json({
                success: false,
                message: `El valor seleccionado para ${field.label ?? fieldId} no es válido`
              });
            }

            const allowedValues = Array.isArray(field.options)
              ? field.options
                  .map(option => {
                    if (typeof option === 'string') {
                      return option;
                    }
                    if (option && typeof option === 'object' && typeof option.value === 'string') {
                      return option.value;
                    }
                    return null;
                  })
                  .filter(Boolean)
              : [];

            const trimmedValue = rawAnswer.trim();

            if (allowedValues.length && !allowedValues.includes(trimmedValue)) {
              await transaction.rollback();
              return res.status(400).json({
                success: false,
                message: `El valor seleccionado para ${field.label ?? fieldId} no es válido`
              });
            }

            parsedAnswers[fieldId] = trimmedValue;
          } else {
            const normalizedValue =
              typeof rawAnswer === 'string' ? rawAnswer.trim() : String(rawAnswer);
            parsedAnswers[fieldId] = normalizedValue;
          }
        }
      }

      const existingUser = await User.findOne({
        where: { email },
        transaction
      });

      if (existingUser) {
        await transaction.rollback();
        return res
          .status(409)
          .json({ success: false, message: AUTH_MESSAGES.EMAIL_ALREADY_TAKEN });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const finalRegistrationAnswers = setGradeInAnswers(parsedAnswers, resolvedGrade);
      
      const newUser = await User.create(
        {
          email,
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          language: language?.toLowerCase() ?? 'es',
          status: 'active',
          is_super_admin: false,
          registration_answers: finalRegistrationAnswers,
          last_login_at: new Date()
        },
        { transaction }
      );

      const membership = await UserTenant.create(
        {
          user_id: newUser.id,
          tenant_id: tenant.id,
          status: 'active'
        },
        { transaction }
      );

      const participantRole = await Role.findOne({
        where: {
          tenant_id: tenant.id,
          scope: 'participant'
        },
        transaction
      });

      if (participantRole) {
        await UserTenantRole.create(
          {
            tenant_id: tenant.id,
            user_tenant_id: membership.id,
            role_id: participantRole.id
          },
          { transaction }
        );
      }

      const registrationPayload =
        Object.keys(parsedAnswers).length > 0 ? parsedAnswers : null;

      if (registrationEvent) {
        await EventRegistration.create(
          {
            tenant_id: tenant.id,
            event_id: registrationEvent.id,
            user_id: newUser.id,
            grade: resolvedGrade ?? null,
            answers: registrationPayload
          },
          { transaction }
        );
      }

      await transaction.commit();

      const freshUser = await User.findByPk(newUser.id, {
        include: [
          {
            model: UserTenant,
            as: 'tenantMemberships',
            include: [
              {
                model: Role,
                as: 'assignedRoles',
                attributes: ['id', 'name', 'scope']
              },
              {
                model: Tenant,
                as: 'tenant',
                attributes: ['id', 'slug', 'name', 'status']
              }
            ]
          }
        ]
      });

      if (!freshUser) {
        return res
          .status(500)
          .json({ success: false, message: AUTH_MESSAGES.REGISTRATION_ERROR });
      }

      const memberships = freshUser.tenantMemberships ?? [];
      const activeMembership =
        memberships.find(
          membershipInstance =>
            Number(membershipInstance.tenant_id) === Number(tenant.id) &&
            membershipInstance.status === 'active'
        ) ?? null;

      await newUser.update({ last_login_at: new Date() }, { transaction: null });

      const tokens = AuthService.generateTokens({
        user: freshUser,
        tenant,
        membership: activeMembership
      });

      return res.status(201).json({
        success: true,
        data: {
          tokens,
          user: freshUser.toSafeJSON(),
          tenant: tenant.toJSON(),
          isSuperAdmin: false,
          memberships: memberships.map(serializeMembership),
          activeMembership: serializeMembership(activeMembership),
          metadata: registrationEvent
            ? {
                registered_event_id: registrationEvent.id,
                grade: resolvedGrade ?? null,
                registration_answers: registrationPayload
              }
            : null
        }
      });
    } catch (error) {
      await transaction.rollback();
      logger.error(AUTH_MESSAGES.REGISTRATION_ERROR, { error: error.message });
      return res
        .status(500)
        .json({ success: false, message: AUTH_MESSAGES.REGISTRATION_ERROR });
    }
  }

  static async login(req, res) {
    try {
      const models = getModels();
      const { Event, EventRegistration, TeamMember, Team } = models;
      const tenant = req.tenant;
      const { email, password, event_id: eventId } = req.body;

      if (!tenant) {
        return res
          .status(400)
          .json({ success: false, message: AUTH_MESSAGES.TENANT_NOT_RESOLVED });
      }

      const authResult = await AuthService.validateCredentials({
        email,
        password,
        tenantId: tenant.id
      });

      if (!authResult || !authResult.user) {
        return res
          .status(401)
          .json({ success: false, message: AUTH_MESSAGES.INVALID_CREDENTIALS });
      }

      const { user, memberships, activeMembership } = authResult;

      if (!user.is_super_admin && !activeMembership) {
        return res.status(403).json({
          success: false,
          message: AUTH_MESSAGES.USER_NOT_IN_TENANT
        });
      }

      if (activeMembership && activeMembership.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: AUTH_MESSAGES.USER_INACTIVE
        });
      }

      // Verificar campos faltantes del schema del tenant
      // Solo se verifica para usuarios que no son super admins ni tenant admins/organizers
      let tenantMissingFields = [];
      let tenantRegistrationSchema = null;
      
      // Obtener los scopes del usuario en el tenant activo
      const userRoleScopes = new Set(
        activeMembership?.assignedRoles?.map(role => role.scope) ?? []
      );
      const isAdminOrOrganizer = userRoleScopes.has('tenant_admin') || userRoleScopes.has('organizer');
      
      // Saltar verificación de campos faltantes para super admins y admins/organizers
      if (!user.is_super_admin && !isAdminOrOrganizer && tenant.registration_schema) {
        if (typeof tenant.registration_schema === 'object') {
          tenantRegistrationSchema = tenant.registration_schema;
        } else if (typeof tenant.registration_schema === 'string') {
          try {
            tenantRegistrationSchema = JSON.parse(tenant.registration_schema);
          } catch {
            tenantRegistrationSchema = null;
          }
        }

        if (tenantRegistrationSchema) {
          tenantMissingFields = checkMissingRequiredFields(tenantRegistrationSchema, {
            registration_answers: user.registration_answers || {}
          });
        }
      }

      // Verificar campos faltantes del schema del evento si se proporciona event_id
      // Solo se verifica si el usuario es miembro o capitán de un equipo en el evento
      let eventMissingFields = [];
      let eventRegistration = null;
      if (eventId) {
        const event = await Event.findOne({
          where: {
            id: eventId,
            tenant_id: tenant.id
          }
        });

        if (event) {
          // Verificar si el usuario es miembro o capitán de un equipo en este evento
          const isTeamMemberOrCaptain = await TeamMember.findOne({
            where: {
              user_id: user.id,
              tenant_id: tenant.id,
              status: 'active',
              role: {
                [Op.in]: ['captain', 'member']
              }
            },
            include: [
              {
                model: Team,
                as: 'team',
                where: {
                  event_id: eventId,
                  tenant_id: tenant.id
                },
                required: true
              }
            ]
          });

          // También verificar si el usuario es capitán de un equipo (a través del campo captain_id)
          const isCaptain = await Team.findOne({
            where: {
              event_id: eventId,
              tenant_id: tenant.id,
              captain_id: user.id
            }
          });

          // Solo verificar campos faltantes si el usuario es miembro o capitán
          if (isTeamMemberOrCaptain || isCaptain) {
            eventRegistration = await EventRegistration.findOne({
              where: {
                event_id: eventId,
                user_id: user.id,
                tenant_id: tenant.id
              }
            });

            const eventRegistrationSchema =
              event.registration_schema && typeof event.registration_schema === 'object'
                ? event.registration_schema
                : null;

            if (eventRegistrationSchema) {
              const eventAnswers = eventRegistration?.answers || {};
              const userAnswers = user.registration_answers || {};
              const combinedAnswers = { ...userAnswers, ...eventAnswers };
              eventMissingFields = checkMissingRequiredFields(eventRegistrationSchema, {
                answers: combinedAnswers
              });
            }
          }
        }
      }

      // Si hay campos faltantes, retornar información para mostrar modal
      if (tenantMissingFields.length > 0 || eventMissingFields.length > 0) {
        const tokens = AuthService.generateTokens({
          user,
          tenant,
          membership: activeMembership ?? null
        });

        try {
          await user.update({ last_login_at: new Date() });
        } catch (updateError) {
          logger.warn('No se pudo registrar el último acceso del usuario', {
            userId: user.id,
            error: updateError.message
          });
        }

        return res.json({
          success: true,
          data: {
            tokens,
            user: user.toSafeJSON(),
            tenant: tenant.toJSON(),
            isSuperAdmin: Boolean(user.is_super_admin),
            memberships: memberships.map(serializeMembership),
            activeMembership: serializeMembership(activeMembership),
            missingFields: {
              tenant: tenantMissingFields.length > 0 ? {
                schema: tenantRegistrationSchema,
                missingFields: tenantMissingFields
              } : null,
              event: eventMissingFields.length > 0 ? {
                eventId: eventId,
                schema: event?.registration_schema || null,
                missingFields: eventMissingFields
              } : null
            }
          }
        });
      }

      try {
        await user.update({ last_login_at: new Date() });
      } catch (updateError) {
        logger.warn('No se pudo registrar el último acceso del usuario', {
          userId: user.id,
          error: updateError.message
        });
      }

      const tokens = AuthService.generateTokens({
        user,
        tenant,
        membership: activeMembership ?? null
      });

      return res.json({
        success: true,
        data: {
          tokens,
          user: user.toSafeJSON(),
          tenant: tenant.toJSON(),
          isSuperAdmin: Boolean(user.is_super_admin),
          memberships: memberships.map(serializeMembership),
          activeMembership: serializeMembership(activeMembership)
        }
      });
    } catch (error) {
      logger.error(AUTH_MESSAGES.LOGIN_ERROR, { error: error.message });
      return res.status(500).json({ success: false, message: AUTH_MESSAGES.LOGIN_ERROR });
    }
  }

  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const tokens = AuthService.refreshToken(refreshToken);
      return res.json({ success: true, data: tokens });
    } catch (error) {
      logger.warn(AUTH_MESSAGES.REFRESH_TOKEN_INVALID, { error: error.message });
      return res
        .status(401)
        .json({ success: false, message: AUTH_MESSAGES.REFRESH_TOKEN_INVALID });
    }
  }

  static async completeRegistration(req, res) {
    const models = getModels();
    const { User, Event, EventRegistration, TeamMember, Team } = models;
    const transaction = await User.sequelize.transaction();
    try {
      const tenant = req.tenant;
      const user = req.user;
      const { grade: rawGrade, registration_answers: rawRegistrationAnswers, event_id: eventId } = req.body;

      if (!tenant) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: AUTH_MESSAGES.TENANT_NOT_RESOLVED });
      }

      if (!user) {
        await transaction.rollback();
        return res
          .status(401)
          .json({ success: false, message: 'Usuario no autenticado' });
      }

      const registrationAnswers =
        rawRegistrationAnswers && typeof rawRegistrationAnswers === 'object' && !Array.isArray(rawRegistrationAnswers)
          ? rawRegistrationAnswers
          : {};
      const gradeFromBody =
        typeof rawGrade === 'string' && rawGrade.trim().length ? rawGrade.trim() : null;
      const currentUserGrade = getUserGrade(user);
      let resolvedGrade = gradeFromBody || currentUserGrade;
      const parsedAnswers = {};

      // Validar schema del tenant
      let tenantRegistrationSchema = null;
      if (tenant.registration_schema) {
        if (typeof tenant.registration_schema === 'object') {
          tenantRegistrationSchema = tenant.registration_schema;
        } else if (typeof tenant.registration_schema === 'string') {
          try {
            tenantRegistrationSchema = JSON.parse(tenant.registration_schema);
          } catch {
            tenantRegistrationSchema = null;
          }
        }
      }

      if (tenantRegistrationSchema) {
        const tenantGradeFieldConfig =
          tenantRegistrationSchema.grade && typeof tenantRegistrationSchema.grade === 'object'
            ? tenantRegistrationSchema.grade
            : null;

        if (tenantGradeFieldConfig && gradeFromBody) {
          const allowedGradeValues = Array.isArray(tenantGradeFieldConfig.options)
            ? tenantGradeFieldConfig.options
                .map(option => {
                  if (typeof option === 'string') {
                    return option;
                  }
                  if (option && typeof option === 'object' && typeof option.value === 'string') {
                    return option.value;
                  }
                  return null;
                })
                .filter(Boolean)
            : [];

          if (allowedGradeValues.length && !allowedGradeValues.includes(gradeFromBody)) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: 'El grado seleccionado no es válido'
            });
          }

          resolvedGrade = gradeFromBody;
        }

        // Validar campos adicionales del tenant
        const tenantAdditionalFields = Array.isArray(tenantRegistrationSchema.additionalFields)
          ? tenantRegistrationSchema.additionalFields.filter(field => field && typeof field === 'object')
          : [];

        for (const field of tenantAdditionalFields) {
          const fieldId =
            typeof field.id === 'string' && field.id.trim().length ? field.id.trim() : null;

          if (!fieldId) {
            continue;
          }

          const rawAnswer = registrationAnswers[fieldId];
          if (rawAnswer === undefined || rawAnswer === null) {
            continue;
          }

          if (field.type === 'select') {
            if (typeof rawAnswer !== 'string' || rawAnswer.trim().length === 0) {
              await transaction.rollback();
              return res.status(400).json({
                success: false,
                message: `El valor seleccionado para ${field.label ?? fieldId} no es válido`
              });
            }

            const allowedValues = Array.isArray(field.options)
              ? field.options
                  .map(option => {
                    if (typeof option === 'string') {
                      return option;
                    }
                    if (option && typeof option === 'object' && typeof option.value === 'string') {
                      return option.value;
                    }
                    return null;
                  })
                  .filter(Boolean)
              : [];

            const trimmedValue = rawAnswer.trim();

            if (allowedValues.length && !allowedValues.includes(trimmedValue)) {
              await transaction.rollback();
              return res.status(400).json({
                success: false,
                message: `El valor seleccionado para ${field.label ?? fieldId} no es válido`
              });
            }

            parsedAnswers[fieldId] = trimmedValue;
          } else {
            const normalizedValue =
              typeof rawAnswer === 'string' ? rawAnswer.trim() : String(rawAnswer);
            parsedAnswers[fieldId] = normalizedValue;
          }
        }
      }

      // Procesar evento si se proporciona
      let registrationEvent = null;
      if (eventId) {
        registrationEvent = await Event.findOne({
          where: {
            id: eventId,
            tenant_id: tenant.id
          },
          transaction
        });

        if (!registrationEvent) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: 'Evento no encontrado'
          });
        }

        // Verificar si el usuario es miembro o capitán de un equipo en este evento
        const isTeamMemberOrCaptain = await TeamMember.findOne({
          where: {
            user_id: user.id,
            tenant_id: tenant.id,
            status: 'active',
            role: {
              [Op.in]: ['captain', 'member']
            }
          },
          include: [
            {
              model: Team,
              as: 'team',
              where: {
                event_id: eventId,
                tenant_id: tenant.id
              },
              required: true
            }
          ],
          transaction
        });

        // También verificar si el usuario es capitán de un equipo (a través del campo captain_id)
        const isCaptain = await Team.findOne({
          where: {
            event_id: eventId,
            tenant_id: tenant.id,
            captain_id: user.id
          },
          transaction
        });

        // Solo permitir completar registro del evento si el usuario es miembro o capitán
        if (!isTeamMemberOrCaptain && !isCaptain) {
          await transaction.rollback();
          return res.status(403).json({
            success: false,
            message: 'Solo los integrantes (miembros o capitanes) de equipos pueden completar el registro del evento'
          });
        }

        const eventRegistrationSchema =
          registrationEvent.registration_schema && typeof registrationEvent.registration_schema === 'object'
            ? registrationEvent.registration_schema
            : null;

        if (eventRegistrationSchema) {
          const eventGradeFieldConfig =
            eventRegistrationSchema.grade && typeof eventRegistrationSchema.grade === 'object'
              ? eventRegistrationSchema.grade
              : null;

          if (eventGradeFieldConfig && gradeFromBody) {
            const allowedGradeValues = Array.isArray(eventGradeFieldConfig.options)
              ? eventGradeFieldConfig.options
                  .map(option => {
                    if (typeof option === 'string') {
                      return option;
                    }
                    if (option && typeof option === 'object' && typeof option.value === 'string') {
                      return option.value;
                    }
                    return null;
                  })
                  .filter(Boolean)
              : [];

            if (allowedGradeValues.length && !allowedGradeValues.includes(gradeFromBody)) {
              await transaction.rollback();
              return res.status(400).json({
                success: false,
                message: 'El grado seleccionado no es válido para este evento'
              });
            }

            resolvedGrade = gradeFromBody;
          }

          // Validar campos adicionales del evento
          const eventAdditionalFields = Array.isArray(eventRegistrationSchema.additionalFields)
            ? eventRegistrationSchema.additionalFields.filter(field => field && typeof field === 'object')
            : [];

          for (const field of eventAdditionalFields) {
            const fieldId =
              typeof field.id === 'string' && field.id.trim().length ? field.id.trim() : null;

            if (!fieldId) {
              continue;
            }

            const rawAnswer = registrationAnswers[fieldId];
            if (rawAnswer === undefined || rawAnswer === null) {
              continue;
            }

            if (field.type === 'select') {
              if (typeof rawAnswer !== 'string' || rawAnswer.trim().length === 0) {
                await transaction.rollback();
                return res.status(400).json({
                  success: false,
                  message: `El valor seleccionado para ${field.label ?? fieldId} no es válido`
                });
              }

              const allowedValues = Array.isArray(field.options)
                ? field.options
                    .map(option => {
                      if (typeof option === 'string') {
                        return option;
                      }
                      if (option && typeof option === 'object' && typeof option.value === 'string') {
                        return option.value;
                      }
                      return null;
                    })
                    .filter(Boolean)
                : [];

              const trimmedValue = rawAnswer.trim();

              if (allowedValues.length && !allowedValues.includes(trimmedValue)) {
                await transaction.rollback();
                return res.status(400).json({
                  success: false,
                  message: `El valor seleccionado para ${field.label ?? fieldId} no es válido`
                });
              }

              parsedAnswers[fieldId] = trimmedValue;
            } else {
              const normalizedValue =
                typeof rawAnswer === 'string' ? rawAnswer.trim() : String(rawAnswer);
              parsedAnswers[fieldId] = normalizedValue;
            }
          }
        }
      }

      // Actualizar registration_answers si hay cambios
      const currentAnswers = user.registration_answers || {};
      const updatedAnswers = setGradeInAnswers({ ...currentAnswers, ...parsedAnswers }, resolvedGrade);
      if (JSON.stringify(updatedAnswers) !== JSON.stringify(currentAnswers)) {
        await user.update({ registration_answers: updatedAnswers }, { transaction });
      }

      // Actualizar o crear EventRegistration si hay evento
      if (registrationEvent) {
        const registrationPayload =
          Object.keys(parsedAnswers).length > 0 ? parsedAnswers : null;

        const [eventRegistration] = await EventRegistration.findOrCreate({
          where: {
            event_id: eventId,
            user_id: user.id,
            tenant_id: tenant.id
          },
          defaults: {
            tenant_id: tenant.id,
            event_id: eventId,
            user_id: user.id,
            grade: resolvedGrade || null,
            answers: registrationPayload,
            status: 'registered'
          },
          transaction
        });

        if (!eventRegistration.isNewRecord) {
          await eventRegistration.update(
            {
              grade: resolvedGrade || eventRegistration.grade || null,
              answers: registrationPayload || eventRegistration.answers || null
            },
            { transaction }
          );
        }
      }

      await transaction.commit();

      // Refrescar usuario
      const freshUser = await User.findByPk(user.id);

      return res.json({
        success: true,
        data: {
          user: freshUser.toSafeJSON(),
          message: 'Campos completados correctamente'
        }
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error completando registro', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Error al completar el registro'
      });
    }
  }

  static async superAdminLogin(req, res) {
    try {
      const { email, password } = req.body;

      const authResult = await AuthService.validateCredentials({
        email,
        password,
        tenantId: null
      });

      if (!authResult || !authResult.user) {
        return res
          .status(401)
          .json({ success: false, message: AUTH_MESSAGES.INVALID_CREDENTIALS });
      }

      const { user, memberships } = authResult;

      if (!user.is_super_admin) {
        return res.status(403).json({
          success: false,
          message: AUTH_MESSAGES.SUPERADMIN_ONLY
        });
      }

      const tokens = AuthService.generateTokens({
        user,
        tenant: null,
        membership: null
      });

      return res.json({
        success: true,
        data: {
          tokens,
          user: user.toSafeJSON(),
          isSuperAdmin: true,
          memberships: memberships.map(serializeMembership)
        }
      });
    } catch (error) {
      logger.error(AUTH_MESSAGES.SUPERADMIN_LOGIN_ERROR, { error: error.message });
      return res.status(500).json({ success: false, message: AUTH_MESSAGES.LOGIN_ERROR });
    }
  }

  static async updateProfile(req, res) {
    try {
      const { user } = req.auth;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      const models = getModels();
      const { User } = models;

      const {
        first_name: rawFirstName,
        last_name: rawLastName,
        email: rawEmail,
        language,
        grade: rawGrade
      } = req.body;

      const updateData = {};

      if (rawFirstName !== undefined) {
        updateData.first_name = String(rawFirstName).trim();
        if (updateData.first_name.length === 0 || updateData.first_name.length > 150) {
          return res.status(400).json({
            success: false,
            message: 'El nombre debe tener entre 1 y 150 caracteres'
          });
        }
      }

      if (rawLastName !== undefined) {
        updateData.last_name = String(rawLastName).trim();
        if (updateData.last_name.length === 0 || updateData.last_name.length > 150) {
          return res.status(400).json({
            success: false,
            message: 'El apellido debe tener entre 1 y 150 caracteres'
          });
        }
      }

      if (rawEmail !== undefined) {
        const email = String(rawEmail).toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({
            success: false,
            message: 'El formato del email no es válido'
          });
        }

        // Verificar que el email no esté en uso por otro usuario
        const existingUser = await User.findOne({
          where: {
            email,
            id: { [Op.ne]: user.id }
          }
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Este email ya está en uso por otro usuario'
          });
        }

        updateData.email = email;
      }

      if (language !== undefined) {
        const validLanguages = ['es', 'en', 'ca'];
        if (!validLanguages.includes(String(language))) {
          return res.status(400).json({
            success: false,
            message: 'Idioma no válido. Debe ser: es, en o ca'
          });
        }
        updateData.language = String(language);
      }

      // Manejar imagen de perfil: puede venir como base64 (profile_image) o como URL (profile_image_url)
      const { profile_image: rawProfileImage, profile_image_url: rawProfileImageUrlFromBody } = req.body;
      if (rawProfileImage !== undefined || rawProfileImageUrlFromBody !== undefined) {
        if (rawProfileImage) {
          // Si viene como base64, subirlo a S3
          try {
            const { decodeBase64Image, uploadUserProfileImage, deleteObjectByUrl } = await import('../services/tenant-assets.service.js');
            const { buffer, mimeType, extension } = decodeBase64Image(rawProfileImage);
            
            // Eliminar imagen anterior si existe
            if (user.profile_image_url) {
              try {
                await deleteObjectByUrl(user.profile_image_url);
              } catch (deleteError) {
                logger.warn('No se pudo eliminar la imagen de perfil anterior', { error: deleteError.message });
              }
            }
            
            const uploadResult = await uploadUserProfileImage({
              userId: user.id,
              buffer,
              contentType: mimeType,
              extension
            });
            
            updateData.profile_image_url = uploadResult.url;
          } catch (error) {
            logger.error('Error subiendo imagen de perfil', { error: error.message });
            return res.status(400).json({
              success: false,
              message: `Error al subir la imagen de perfil: ${error.message}`
            });
          }
        } else if (rawProfileImageUrlFromBody === null) {
          // Si se envía null explícitamente, eliminar la imagen
          if (user.profile_image_url) {
            try {
              const { deleteObjectByUrl } = await import('../services/tenant-assets.service.js');
              await deleteObjectByUrl(user.profile_image_url);
            } catch (deleteError) {
              logger.warn('No se pudo eliminar la imagen de perfil', { error: deleteError.message });
            }
          }
          updateData.profile_image_url = null;
        }
      }

      if (rawGrade !== undefined) {
        const grade = String(rawGrade).trim();
        if (grade.length > 255) {
          return res.status(400).json({
            success: false,
            message: 'El grado no puede exceder 255 caracteres'
          });
        }
        const currentAnswers = user.registration_answers || {};
        updateData.registration_answers = setGradeInAnswers(currentAnswers, grade || null);
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionaron campos para actualizar'
        });
      }

      await user.update(updateData);
      await user.reload();

      logger.info('Perfil de usuario actualizado', {
        userId: user.id,
        updatedFields: Object.keys(updateData)
      });

      return res.json({
        success: true,
        data: {
          user: user.toSafeJSON()
        }
      });
    } catch (error) {
      logger.error('Error al actualizar perfil', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar el perfil'
      });
    }
  }

  /**
   * Refresca la sesión del usuario autenticado, devolviendo información actualizada de membresías y roles
   * Útil después de cambios de roles que no requieren re-login
   */
  static async refreshSession(req, res) {
    try {
      const tenant = req.tenant;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const { UserTenant, Role, Tenant } = getModels();

      // Obtener todas las membresías del usuario con roles actualizados
      const memberships = await UserTenant.findAll({
        where: { user_id: user.id },
        include: [
          {
            model: Tenant,
            as: 'tenant',
            attributes: ['id', 'slug', 'name', 'status']
          },
          {
            model: Role,
            as: 'assignedRoles',
            attributes: ['id', 'name', 'scope'],
            through: { attributes: [] }
          }
        ],
        skipTenant: true
      });

      // Encontrar la membresía activa para el tenant actual
      const activeMembership = tenant
        ? memberships.find(
            membership =>
              Number(membership.tenant_id) === Number(tenant.id) && membership.status === 'active'
          ) ?? null
        : null;

      // Generar nuevos tokens con la información actualizada
      const tokens = AuthService.generateTokens({
        user,
        tenant: tenant ?? null,
        membership: activeMembership
      });

      return res.json({
        success: true,
        data: {
          tokens,
          user: user.toSafeJSON(),
          tenant: tenant ? tenant.toJSON() : null,
          isSuperAdmin: Boolean(user.is_super_admin),
          memberships: memberships.map(serializeMembership),
          activeMembership: serializeMembership(activeMembership)
        }
      });
    } catch (error) {
      logger.error('Error refrescando sesión', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Error al refrescar la sesión'
      });
    }
  }

  /**
   * Endpoint para que superadmin obtenga o cree automáticamente una membresía para un tenant
   * Esto permite que superadmins accedan a cualquier tenant sin necesidad de tener membresía previa
   */
  static async ensureSuperAdminMembership(req, res) {
    try {
      const tenant = req.tenant;
      const user = req.user;

      if (!tenant) {
        return res
          .status(400)
          .json({ success: false, message: AUTH_MESSAGES.TENANT_NOT_RESOLVED });
      }

      if (!user || !Boolean(user.is_super_admin)) {
        return res.status(403).json({
          success: false,
          message: 'Solo superadmins pueden usar este endpoint'
        });
      }

      const { UserTenant, Role, Tenant } = getModels();

      // Buscar o crear membresía para este tenant
      let [membership] = await UserTenant.findOrCreate({
        where: {
          user_id: user.id,
          tenant_id: tenant.id
        },
        defaults: {
          status: 'active'
        },
        skipTenant: true
      });

      // Si la membresía existía pero estaba inactiva, activarla
      if (membership.status !== 'active') {
        membership.status = 'active';
        await membership.save({ skipTenant: true });
      }

      // Cargar la membresía con relaciones
      membership = await UserTenant.findOne({
        where: { id: membership.id },
        include: [
          {
            model: Tenant,
            as: 'tenant',
            attributes: ['id', 'slug', 'name', 'status']
          },
          {
            model: Role,
            as: 'assignedRoles',
            attributes: ['id', 'name', 'scope'],
            through: { attributes: [] }
          }
        ],
        skipTenant: true
      });

      // Obtener todas las membresías del usuario
      const allMemberships = await UserTenant.findAll({
        where: { user_id: user.id },
        include: [
          {
            model: Tenant,
            as: 'tenant',
            attributes: ['id', 'slug', 'name', 'status']
          },
          {
            model: Role,
            as: 'assignedRoles',
            attributes: ['id', 'name', 'scope'],
            through: { attributes: [] }
          }
        ],
        skipTenant: true
      });

      // Generar nuevos tokens con la membresía activa
      const tokens = AuthService.generateTokens({
        user,
        tenant,
        membership
      });

      return res.json({
        success: true,
        data: {
          tokens,
          user: user.toSafeJSON(),
          tenant: tenant.toJSON(),
          isSuperAdmin: true,
          memberships: allMemberships.map(serializeMembership),
          activeMembership: serializeMembership(membership)
        }
      });
    } catch (error) {
      logger.error('Error asegurando membresía de superadmin', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Error al asegurar membresía'
      });
    }
  }

  /**
   * Cambia la contraseña del usuario autenticado
   * Requiere la contraseña actual y la nueva contraseña
   */
  static async changePassword(req, res) {
    try {
      const { user } = req.auth;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere la contraseña actual y la nueva contraseña'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 8 caracteres'
        });
      }

      // Cargar el usuario con la contraseña para validar
      const models = getModels();
      const { User } = models;
      const userWithPassword = await User.scope('withPassword').findByPk(user.id);

      if (!userWithPassword) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Validar la contraseña actual
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password);

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña actual es incorrecta'
        });
      }

      // Verificar que la nueva contraseña sea diferente a la actual
      const isSamePassword = await bcrypt.compare(newPassword, userWithPassword.password);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe ser diferente a la contraseña actual'
        });
      }

      // Hashear y actualizar la contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await userWithPassword.update({ password: hashedPassword });

      logger.info('Contraseña de usuario cambiada', {
        userId: user.id
      });

      return res.json({
        success: true,
        message: 'Contraseña cambiada exitosamente'
      });
    } catch (error) {
      logger.error('Error al cambiar contraseña', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Error al cambiar la contraseña'
      });
    }
  }
}

