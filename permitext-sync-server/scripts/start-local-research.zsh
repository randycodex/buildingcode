#!/bin/zsh

set -euo pipefail

script_directory="${0:A:h}"
repository_directory="${script_directory:h}"
keychain_service="permitext-openai-api-key"
openai_key="$(security find-generic-password -a "$USER" -s "$keychain_service" -w 2>/dev/null || true)"

if [[ "$openai_key" != sk-* ]]; then
  print -u2 "Permitext Research is not configured. Save a valid OpenAI API key in macOS Keychain service: $keychain_service"
  exit 1
fi

export OPENAI_API_KEY="$openai_key"
export PERMITEXT_RESEARCH_MODEL="${PERMITEXT_RESEARCH_MODEL:-gpt-5.6-terra}"
export PERMITEXT_CODE_QUESTION_WORKSPACE="${PERMITEXT_CODE_QUESTION_WORKSPACE:-1}"
export PERMITEXT_EVIDENCE_DISCOVERY_BETA="${PERMITEXT_EVIDENCE_DISCOVERY_BETA:-1}"
export PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS="${PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS:-1}"
unset PERMITEXT_RESEARCH_MOCK
unset PERMITEXT_TEST_RESEARCH_MOCK
unset openai_key

cd "$repository_directory"
exec npm start
