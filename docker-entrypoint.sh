#!/bin/bash
set -e

ENV_FILE="/app/env/.env"
LOCK_FILE="/app/env/.env.lock"
LOCK_DIR="/app/env/.generate_lock"

generate_secret_key() {
    python3 -c "import secrets; print(secrets.token_urlsafe(32))"
}

generate_encryption_key() {
    python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
}

is_valid_fernet_key() {
    local key=$1
    python3 -c "
import base64, sys
try:
    k = base64.urlsafe_b64decode(sys.argv[1])
    if len(k) != 32:
        sys.exit(1)
except Exception:
    sys.exit(1)
" "$key" 2>/dev/null
}

is_placeholder() {
    local key=$1
    local value=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-)
    [ -z "$value" ] || echo "$value" | grep -qE "^(change-this|changeme)"
}

needs_regeneration() {
    local key=$1
    if is_placeholder "$key"; then
        return 0
    fi
    if [ "$key" = "ENCRYPTION_KEY" ]; then
        local value=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-)
        if [ -n "$value" ] && ! is_valid_fernet_key "$value"; then
            return 0
        fi
    fi
    return 1
}

replace_key() {
    local key=$1
    local new_value=$2
    if [ -f "$ENV_FILE" ]; then
        if grep -q "^${key}=" "$ENV_FILE"; then
            sed "s|^${key}=.*|${key}=${new_value}|" "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
        else
            echo "${key}=${new_value}" >> "$ENV_FILE"
        fi
    fi
}

generate_keys() {
    if is_placeholder "SECRET_KEY"; then
        echo "Generating SECRET_KEY..."
        SECRET_KEY=$(generate_secret_key)
        replace_key "SECRET_KEY" "$SECRET_KEY"
    fi

    if needs_regeneration "ENCRYPTION_KEY"; then
        echo "Generating ENCRYPTION_KEY..."
        ENCRYPTION_KEY=$(generate_encryption_key)
        replace_key "ENCRYPTION_KEY" "$ENCRYPTION_KEY"
    fi
}

acquire_lock() {
    mkdir "$LOCK_DIR" 2>/dev/null
}

release_lock() {
    rmdir "$LOCK_DIR" 2>/dev/null || true
}

trap release_lock EXIT

acquire_lock || {
    echo "Waiting for another container to generate keys..."
    for i in {1..30}; do
        sleep 1
        if ! needs_regeneration "SECRET_KEY" && ! needs_regeneration "ENCRYPTION_KEY"; then
            break
        fi
    done
}

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env from .env.example..."
    if [ -d "$ENV_FILE" ]; then
        rm -rf "$ENV_FILE" 2>/dev/null || true
    fi
    if [ ! -f "$ENV_FILE" ]; then
        cp /app/.env.example "$ENV_FILE"
    fi
fi

generate_keys

if [ -f "$ENV_FILE" ]; then
    while IFS= read -r line; do
        case "$line" in
            \#*|"") continue ;;
        esac
        key="${line%%=*}"
        value="${line#*=}"
        if [ -z "${!key+x}" ]; then
            export "$key=$value"
        fi
    done < "$ENV_FILE"
fi

echo "Starting application..."
exec "$@"
