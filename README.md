# CREATE Platform

Plataforma SaaS multi-tenant para acelerar hackatones, bootcamps y sprints de innovación. Gestiona eventos, fases, tareas, equipos, proyectos, envíos y evaluaciones dentro de un mismo ecosistema.

## 🏗️ Arquitectura

**CREATE** es una plataforma multi-tenant que permite a diferentes organizaciones gestionar sus propios eventos de innovación de forma independiente y segura.

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js (ESM) + Express 5 + Sequelize + MySQL
- **Capas compartidas**: logs centralizados, scripts de migraciones/seeders, Docker y docker-compose para despliegues

## 🚀 Stack Tecnológico

### Frontend
- **Framework**: React 19.2.0 + React Router 7.9.5
- **Lenguaje**: TypeScript estricto
- **Build Tool**: Vite 7.2.2
- **Estilos**: Tailwind CSS 4.1.17 + shadcn/ui
- **Forms**: react-hook-form 7.66.0 + zod 4.1.12
- **Internacionalización**: i18next 25.6.1 + react-i18next 16.2.4 (español, catalán, inglés)
- **Estado/Networking**: Axios 1.13.2 + React Query 5.90.7
- **Notificaciones**: sonner 2.0.7

### Backend
- **Runtime**: Node.js LTS (ES Modules)
- **Framework**: Express 5.1.0
- **Auth**: JWT (jsonwebtoken 9.0.2, access + refresh) + bcryptjs 3.0.3
- **ORM**: Sequelize 6.37.7 con `AsyncLocalStorage` para scoping multi-tenant
- **DB Driver**: mysql2 3.15.3
- **Validación**: express-validator 7.3.0
- **Seguridad**: helmet 8.1.0, cors 2.8.5, morgan 1.10.1
- **Integraciones**: 
  - MailerSend 2.0.1 (envío de correos electrónicos)
  - OpenAI 4.70.0 (evaluación asistida por IA)
- **Storage**: AWS SDK S3 3.927.0, multer 2.0.2
- **Testing**: Jest 29.7.0 + Supertest 7.1.4 (modo experimental ESM)
- **Migraciones**: Umzug 3.8.2

## 📋 Requisitos Previos

- Node.js LTS (v18 o superior)
- MySQL 8.0 o superior
- Docker y Docker Compose (opcional, para desarrollo con contenedores)
- pnpm 10.21.0 (gestor de paquetes)

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd create
```

### 2. Configurar variables de entorno

Copia `env.example` a `.env` y configura las variables necesarias:

```bash
cp env.example .env
```

Edita `.env` con tus valores:

```env
# Backend
PORT=5100
JWT_SECRET=tu-secreto-jwt
JWT_REFRESH_SECRET=tu-secreto-refresh
JWT_EXPIRES_IN=2h
ALLOWED_ORIGINS=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu-password
DB_NAME=create

# Frontend
VITE_API_URL=http://localhost:5100/api

# Storage (DigitalOcean Spaces o AWS S3)
SPACES_ENDPOINT=https://fra1.digitaloceanspaces.com
SPACES_REGION=fra1
SPACES_BUCKET=tu-bucket
SPACES_PUBLIC_BASE_URL=https://tu-bucket.fra1.digitaloceanspaces.com
SPACES_ACCESS_KEY_ID=tu-access-key
SPACES_SECRET_ACCESS_KEY=tu-secret-key
SPACES_SUBMISSIONS_PREFIX=submissions

# OpenAI (opcional, para evaluación asistida por IA)
OPENAI_API_KEY=tu-openai-api-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.1
OPENAI_MAX_OUTPUT_TOKENS=1200
OPENAI_DEFAULT_LOCALE=es

# MailerSend (para envío de correos)
MAILERSEND_API_KEY=tu-mailersend-api-key
MAILERSEND_SENDER_EMAIL=noreply@tudominio.com
MAILERSEND_SENDER_NAME=CREATE Platform
MAILERSEND_TAG_PREFIX=CREATE
```

### 3. Instalar dependencias

```bash
# Backend
cd backend
pnpm install

# Frontend
cd ../frontend
pnpm install
```

### 4. Configurar base de datos

```bash
cd backend

# Ejecutar migraciones
pnpm run migrate

# Ejecutar seeders maestros
pnpm run seed:master

# (Opcional) Ejecutar seeders de prueba
pnpm run seed:test
```

### 5. Iniciar desarrollo

**Opción A: Con Docker Compose**

```bash
# Desde la raíz del proyecto
docker-compose up
```

**Opción B: Manual**

```bash
# Terminal 1 - Backend
cd backend
pnpm run dev

# Terminal 2 - Frontend
cd frontend
pnpm run dev
```

El frontend estará disponible en `http://localhost:5173` y el backend en `http://localhost:5100`.

## 🏛️ Arquitectura Multi-Tenant

CREATE utiliza un modelo multi-tenant con aislamiento completo de datos:

1. **Aislamiento obligatorio**: Todos los modelos operativos tienen columna `tenant_id`
2. **Detección de tenant**: Se acepta `x-tenant-id`, `x-tenant-slug`, subdominio (`{slug}.create.`) o ruta `/tenant/{slug}`
3. **Contexto**: `tenantMiddleware` valida y anexa `req.tenant`; `tenantContextMiddleware` guarda `tenant_id` via `AsyncLocalStorage`
4. **Frontend**: `TenantProvider` detecta slug inicial y configura `apiClient` automáticamente
5. **Super-admin**: Rutas bajo `/api/superadmin` saltan el middleware de tenant y exigen cabecera `x-super-admin-token`

## 📁 Estructura del Proyecto

```
create/
├── backend/
│   ├── src/
│   │   ├── config/                # Configuración (env.js, appConfig)
│   │   ├── controllers/           # Controladores (auth, events, projects...)
│   │   ├── database/              # Base de datos (migrations, seeders)
│   │   ├── middleware/            # Middlewares (tenant, auth, validation)
│   │   ├── models/                # Modelos Sequelize
│   │   ├── routes/                # Rutas (public, superadmin, v1/*)
│   │   ├── services/              # Servicios de negocio
│   │   ├── utils/                 # Utilidades (logger, tenant-scoping)
│   │   └── server.js, index.js
│   ├── scripts/                   # Scripts de base de datos
│   ├── tests/                     # Tests Jest/Supertest
│   └── logs/                      # Logs (montado en Docker)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/            # Componentes comunes reutilizables
│   │   │   └── ui/                # Componentes shadcn/ui
│   │   ├── context/               # Contextos (AuthContext, TenantContext)
│   │   ├── i18n/                  # Internacionalización
│   │   ├── pages/                 # Páginas (admin, participant, evaluator)
│   │   ├── services/              # Servicios HTTP
│   │   ├── utils/                 # Utilidades
│   │   └── App.tsx, main.tsx
│   └── dist/                      # Build de producción
├── docs/                          # Documentación funcional
├── docker-compose.yml
└── env.example
```

## 🧪 Testing

### Backend

```bash
cd backend
pnpm test
pnpm test:watch
pnpm test:coverage
```

Los tests utilizan Jest + Supertest en modo experimental ESM.

### Frontend

Los tests del frontend se encuentran en `frontend/tests/` (configurar Vitest o Jest según necesidad).

## 📝 Scripts Disponibles

### Backend

- `pnpm start`: Inicia el servidor en producción
- `pnpm dev`: Inicia el servidor en modo desarrollo con nodemon
- `pnpm migrate`: Ejecuta migraciones pendientes
- `pnpm migrate:up`: Ejecuta migraciones hacia arriba
- `pnpm migrate:down`: Revierte la última migración
- `pnpm migrate:status`: Muestra el estado de las migraciones
- `pnpm seed:master`: Ejecuta seeders maestros
- `pnpm seed:test`: Ejecuta seeders de prueba
- `pnpm db:reset`: Resetea la base de datos (drop + migrate + seed master)
- `pnpm test`: Ejecuta tests
- `pnpm test:watch`: Ejecuta tests en modo watch
- `pnpm test:coverage`: Ejecuta tests con cobertura

### Frontend

- `pnpm dev`: Inicia servidor de desarrollo
- `pnpm build`: Construye para producción
- `pnpm preview`: Previsualiza build de producción
- `pnpm lint`: Ejecuta linter

## 🌍 Internacionalización

La plataforma soporta tres idiomas:
- Español (es) - Idioma por defecto
- Catalán (ca)
- Inglés (en)

Los archivos de traducción se encuentran en `frontend/src/i18n/locales/`:
- `es.json`
- `ca.json`
- `en.json`

## 🔐 Seguridad

- JWT con access token y refresh token
- Tokens firmados con secretos distintos
- HTTPS requerido en producción
- API keys almacenadas en variables de entorno
- Middleware de autenticación y autorización
- Scoping multi-tenant obligatorio

## 📚 Documentación Adicional

- Ver `.cursorrules` para reglas de desarrollo detalladas
- Ver `docs/` para documentación funcional
- Ver `env.example` para lista completa de variables de entorno

## 🤝 Contribución

1. Crea una rama desde `main`
2. Realiza tus cambios siguiendo las reglas en `.cursorrules`
3. Asegúrate de que los tests pasen
4. Crea un pull request

## 📄 Licencia

ISC

---

**Versión**: 1.0.0  
**Última actualización**: 2025-01-27

