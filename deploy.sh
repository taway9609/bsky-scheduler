#!/bin/bash
set -e

# Configuration
REMOTE_USER="youki"
REMOTE_HOST="youki-macbookpro.local"
REMOTE_PASS="youki"
IMAGE_NAME="fastapi-alpha-app"
IMAGE_TAG="latest"
REMOTE_DIR="~/bs-scheduler-deploy"

echo "=== Building Docker image ==="
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

echo "=== Saving Docker image ==="
docker save ${IMAGE_NAME}:${IMAGE_TAG} | gzip > /tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz

echo "=== Transferring image to remote host ==="
sshpass -p "${REMOTE_PASS}" scp /tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz ${REMOTE_USER}@${REMOTE_HOST}:/tmp/

echo "=== Loading image on remote host ==="
sshpass -p "${REMOTE_PASS}" ssh ${REMOTE_USER}@${REMOTE_HOST} "echo '${REMOTE_PASS}' | sudo -S docker load < /tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz && rm /tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz"

echo "=== Starting app service ==="
sshpass -p "${REMOTE_PASS}" ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_DIR} && echo '${REMOTE_PASS}' | sudo -S docker compose up -d app"

echo "=== Deployment complete ==="
sshpass -p "${REMOTE_PASS}" ssh ${REMOTE_USER}@${REMOTE_HOST} "echo '${REMOTE_PASS}' | sudo -S docker compose ps app"

# Cleanup
rm -f /tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz

echo "=== Done ==="
