import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();
const nodeEnv = process.env.NODE_ENV ?? 'development';

const candidateFiles = [];

candidateFiles.push('.env');

const resolvedEnvPath = candidateFiles
  .map(file => resolve(cwd, file))
  .find(filePath => existsSync(filePath));

dotenv.config(
  resolvedEnvPath
    ? { path: resolvedEnvPath, quiet: true }
    : { quiet: true }
);

export const appConfig = {
  nodeEnv,
  port: process.env.PORT ? Number(process.env.PORT) : 5100,
  jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
  databaseUrl: process.env.DATABASE_URL,
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? 'root',
    database: process.env.DB_NAME ?? 'create',
    dialect: 'mysql'
  },
  storage: {
    submissionsPrefix: process.env.SPACES_SUBMISSIONS_PREFIX ?? 'submissions'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    temperature: process.env.OPENAI_TEMPERATURE ? Number(process.env.OPENAI_TEMPERATURE) : 0,
    maxOutputTokens: process.env.OPENAI_MAX_OUTPUT_TOKENS ? Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) : 1200,
    locale: process.env.OPENAI_DEFAULT_LOCALE ?? 'es'
  },
  mailersend: {
    apiKey: process.env.MAILERSEND_API_KEY ?? '',
    senderEmail: process.env.MAILERSEND_SENDER_EMAIL ?? '',
    senderName: process.env.MAILERSEND_SENDER_NAME ?? 'CREATE Platform',
    tagPrefix: process.env.MAILERSEND_TAG_PREFIX ?? ''
  }
};

