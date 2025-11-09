import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';
import { appConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';

let client = null;

function getClient() {
  if (!client) {
    if (!appConfig.mailersend.apiKey) {
      throw new Error('MAILERSEND_API_KEY no configurada');
    }
    client = new MailerSend({
      apiKey: appConfig.mailersend.apiKey
    });
  }
  return client;
}

function resolveRecipientName(user) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return fullName || user.email;
}

function formatExpiresAt(expiresAt) {
  if (!expiresAt) {
    return '';
  }
  return Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(expiresAt);
}

export class MailersendService {
  static async sendPasswordResetCode({ user, tenant, code, expiresAt }) {
    try {
      const api = getClient();

      if (!appConfig.mailersend.senderEmail) {
        throw new Error('MAILERSEND_SENDER_EMAIL no configurado');
      }

      const sentFrom = new Sender(appConfig.mailersend.senderEmail, appConfig.mailersend.senderName);
      const recipients = [new Recipient(user.email, resolveRecipientName(user))];

      const subject = `Código de recuperación para ${tenant.name}`;
      const expiresLabel = formatExpiresAt(expiresAt);

      const textBody = [
        `Hola ${resolveRecipientName(user)},`,
        '',
        `Recibimos una solicitud para restablecer tu contraseña en ${tenant.name}.`,
        `Tu código de verificación es: ${code}.`,
        expiresLabel ? `Caduca el ${expiresLabel}.` : 'Caduca en 1 hora.',
        '',
        'Si no solicitaste este cambio, puedes ignorar este correo.'
      ].join('\n');

      const htmlBody = `
        <p>Hola ${resolveRecipientName(user)},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña en <strong>${tenant.name}</strong>.</p>
        <p style="font-size: 1.5rem; font-weight: bold; letter-spacing: 0.3rem;">${code}</p>
        <p>${expiresLabel ? `Caduca el ${expiresLabel}.` : 'Caduca en 1 hora.'}</p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      `;

      const params = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(subject)
        .setHtml(htmlBody)
        .setText(textBody);

      const tagPrefix = appConfig.mailersend.tagPrefix?.trim();
      if (tagPrefix && tenant?.slug) {
        const formattedTag = `${tagPrefix}-${tenant.slug.toUpperCase()}`;
        params.setTags([formattedTag]);
      }

      await api.email.send(params);
    } catch (error) {
      logger.error('Error al enviar correo de recuperación de contraseña', {
        error: error.message
      });
      throw error;
    }
  }
}


