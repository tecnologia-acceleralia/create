#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${BACKEND_DIR}/.." && pwd)"

ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.dev}"

echo "==> Comprobando servicios externos (DigitalOcean Spaces)"
echo "    - Backend dir: ${BACKEND_DIR}"
echo "    - Archivo de entorno: ${ENV_FILE}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: No se encontró el archivo de entorno en ${ENV_FILE}" >&2
  exit 1
fi

set +u
while IFS= read -r line || [[ -n "${line}" ]]; do
  # Ignorar líneas vacías, comentarios o con formato incompatible
  if [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]]; then
    continue
  fi

  if [[ "${line}" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"

    # Eliminar comillas envolventes (simples o dobles)
    if [[ "${value}" =~ ^\"(.*)\"$ ]]; then
      value="${BASH_REMATCH[1]}"
    elif [[ "${value}" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi

    # Sustituir variables de entorno embebidas (p.ej. ${VAR})
    value="$(eval "echo \"${value}\"")"

    export "${key}"="${value}"
  fi
done < "${ENV_FILE}"
set -u

REQUIRED_VARS=(
  "SPACES_ENDPOINT"
  "SPACES_BUCKET"
  "SPACES_REGION"
  "SPACES_ACCESS_KEY_ID"
  "SPACES_SECRET_ACCESS_KEY"
)

missing_vars=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing_vars+=("${var}")
  fi
done

if (( ${#missing_vars[@]} > 0 )); then
  echo "ERROR: Faltan variables obligatorias de Spaces:"
  for var in "${missing_vars[@]}"; do
    echo "  - ${var}"
  done
  exit 1
fi

echo "==> Variables requeridas detectadas. Probando conexión..."

pushd "${BACKEND_DIR}" >/dev/null

NODE_OUTPUT="$(node --input-type=module <<'NODE'
import { probeSpacesConnection } from './src/services/tenant-assets.service.js';

try {
  const result = await probeSpacesConnection();
  console.log(JSON.stringify({ success: true, result }));
} catch (error) {
  console.error(JSON.stringify({
    success: false,
    error: error?.message ?? 'Error desconocido'
  }));
  process.exitCode = 1;
}
NODE
)"

STATUS=$?
popd >/dev/null

if [[ ${STATUS} -ne 0 ]]; then
  echo "ERROR: Falló la conexión con Spaces."
  echo "${NODE_OUTPUT}"
  exit ${STATUS}
fi

echo "OK: Conexión a Spaces verificada."
echo "${NODE_OUTPUT}"

