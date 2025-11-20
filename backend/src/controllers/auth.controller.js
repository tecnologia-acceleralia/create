import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { AuthService } from '../services/auth.service.js';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';

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

      let registrationEvent = null;
      let registrationSchema = null;
      if (eventId) {
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

        registrationSchema =
          registrationEvent.registration_schema && typeof registrationEvent.registration_schema === 'object'
            ? registrationEvent.registration_schema
            : null;

        const gradeFieldConfig =
          registrationSchema && typeof registrationSchema.grade === 'object'
            ? registrationSchema.grade
            : null;

        const additionalFieldDefinitions = Array.isArray(registrationSchema?.additionalFields)
          ? registrationSchema.additionalFields.filter(field => field && typeof field === 'object')
          : [];

        if (gradeFieldConfig) {
          const gradeFromAnswers =
            typeof registrationAnswers.grade === 'string' && registrationAnswers.grade.trim().length
              ? registrationAnswers.grade.trim()
              : null;

          if (!resolvedGrade && gradeFromAnswers) {
            resolvedGrade = gradeFromAnswers;
          }

          const allowedGradeValues = Array.isArray(gradeFieldConfig.options)
            ? gradeFieldConfig.options
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

          if (gradeFieldConfig.required && !resolvedGrade) {
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

        for (const field of additionalFieldDefinitions) {
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

        const gradeIsRequired = Boolean(gradeFieldConfig?.required);
        if (gradeIsRequired && !resolvedGrade) {
          await transaction.rollback();
          return res
            .status(400)
            .json({ success: false, message: 'Debes seleccionar un grado para completar el registro' });
        }
      } else {
        const existingOpenRegistration = await Event.findOne({
          where: baseEventFilters,
          transaction
        });

        if (!existingOpenRegistration) {
          await transaction.rollback();
          return res
            .status(403)
            .json({ success: false, message: AUTH_MESSAGES.REGISTRATION_DISABLED });
        }
      }

      if (resolvedGrade && registrationEvent && parsedAnswers.grade === undefined) {
        parsedAnswers.grade = resolvedGrade;
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
      const newUser = await User.create(
        {
          email,
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          language: language?.toLowerCase() ?? 'es',
          status: 'active',
          is_super_admin: false,
          grade: resolvedGrade ?? null,
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
      const tenant = req.tenant;
      const { email, password } = req.body;

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

      try {
        await user.update({ last_login_at: new Date() });
      } catch (updateError) {
        logger.warn('No se pudo registrar el último acceso del usuario', {
          userId: user.id,
          error: updateError.message
        });
      }

      await user.update({ last_login_at: new Date() });

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
        updateData.grade = grade || null;
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
}

