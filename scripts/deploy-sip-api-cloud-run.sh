#!/usr/bin/env bash

set -euo pipefail

# Required vars:
#   GCP_PROJECT_ID
#   GCP_REGION                 (e.g. europe-west3)
#   SIP_API_SERVICE_NAME       (e.g. sip-editor-api)
#   CORS_ORIGINS               (comma separated)
#
# Optional vars:
#   FIREBASE_PROJECT_ID
#   FIREBASE_SERVICE_ACCOUNT_JSON_SECRET  (Secret Manager secret name)
#   CLOUD_RUN_TIMEOUT          (default: 30s)
#   CLOUD_RUN_MEMORY           (default: 512Mi)
#   CLOUD_RUN_CPU              (default: 1)
#   CLOUD_RUN_CONCURRENCY      (default: 80)
#   CLOUD_RUN_MIN_INSTANCES    (default: 0)
#   CLOUD_RUN_MAX_INSTANCES    (default: 10)

: "${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
: "${GCP_REGION:?GCP_REGION is required}"
: "${SIP_API_SERVICE_NAME:?SIP_API_SERVICE_NAME is required}"
: "${CORS_ORIGINS:?CORS_ORIGINS is required}"

CLOUD_RUN_TIMEOUT="${CLOUD_RUN_TIMEOUT:-30s}"
CLOUD_RUN_MEMORY="${CLOUD_RUN_MEMORY:-512Mi}"
CLOUD_RUN_CPU="${CLOUD_RUN_CPU:-1}"
CLOUD_RUN_CONCURRENCY="${CLOUD_RUN_CONCURRENCY:-80}"
CLOUD_RUN_MIN_INSTANCES="${CLOUD_RUN_MIN_INSTANCES:-0}"
CLOUD_RUN_MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-10}"

IMAGE_URI="gcr.io/${GCP_PROJECT_ID}/${SIP_API_SERVICE_NAME}:$(date +%Y%m%d-%H%M%S)"

echo "==> Set gcloud project: ${GCP_PROJECT_ID}"
gcloud config set project "${GCP_PROJECT_ID}"

echo "==> Build and push image via Cloud Build: ${IMAGE_URI}"
gcloud builds submit \
  --config apps/api/cloudbuild.yaml \
  --substitutions "_IMAGE_URI=${IMAGE_URI}" \
  .

echo "==> Deploy Cloud Run service: ${SIP_API_SERVICE_NAME}"
DEPLOY_ARGS=(
  run deploy "${SIP_API_SERVICE_NAME}"
  --image "${IMAGE_URI}"
  --platform managed
  --region "${GCP_REGION}"
  --allow-unauthenticated
  --port 8080
  --timeout "${CLOUD_RUN_TIMEOUT}"
  --memory "${CLOUD_RUN_MEMORY}"
  --cpu "${CLOUD_RUN_CPU}"
  --concurrency "${CLOUD_RUN_CONCURRENCY}"
  --min-instances "${CLOUD_RUN_MIN_INSTANCES}"
  --max-instances "${CLOUD_RUN_MAX_INSTANCES}"
  --set-env-vars "^@^NODE_ENV=production@CORS_ORIGINS=${CORS_ORIGINS}"
)

if [[ -n "${FIREBASE_PROJECT_ID:-}" ]]; then
  DEPLOY_ARGS+=(--set-env-vars "FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}")
fi

if [[ -n "${FIREBASE_SERVICE_ACCOUNT_JSON_SECRET:-}" ]]; then
  DEPLOY_ARGS+=(--set-secrets "FIREBASE_SERVICE_ACCOUNT_JSON=${FIREBASE_SERVICE_ACCOUNT_JSON_SECRET}:latest")
fi

gcloud "${DEPLOY_ARGS[@]}"

RUN_URL="$(gcloud run services describe "${SIP_API_SERVICE_NAME}" \
  --region "${GCP_REGION}" \
  --format='value(status.url)'
)"

echo "==> Cloud Run URL"
echo "${RUN_URL}"

echo "==> Smoke: DELETE /api/projects (ожидается 401 без x-sip-user-id, не 404 Route)"
DEL_CODE="$(curl -sS -o /tmp/sip-api-del-smoke.body -w "%{http_code}" \
  -X DELETE "${RUN_URL}/api/projects/__smoke_route_check__" \
  --max-time 20)"
if [[ "${DEL_CODE}" == "401" ]]; then
  echo "OK: маршрут DELETE зарегистрирован (401 Unauthorized)."
elif [[ "${DEL_CODE}" == "404" ]]; then
  echo "ОШИБКА: 404 — маршрут DELETE не найден в развёрнутом образе. Проверьте, что репозиторий с registerProjectRoutes и apps/api/Dockerfile задеплоен."
  head -c 400 /tmp/sip-api-del-smoke.body || true
  echo ""
  exit 1
else
  echo "Предупреждение: DELETE вернул HTTP ${DEL_CODE} (ожидали 401)."
  head -c 400 /tmp/sip-api-del-smoke.body || true
  echo ""
fi
