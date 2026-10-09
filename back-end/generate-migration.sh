#!/usr/bin/env bash
# Generates the EF Core migration for the new AI entities (AIInterviewPlan,
# AIAnswerEvaluation) and the new AI columns on Report.
#
# This must be run with the .NET SDK installed and a reachable SQL Server
# connection is NOT required (EF Core builds migrations from the model, not
# a live DB). Run this from the back-end/ directory.
#
# Usage:
#   ./generate-migration.sh
#
set -euo pipefail

cd "$(dirname "$0")"

dotnet tool restore 2>/dev/null || true

dotnet ef migrations add AddAIInterviewEntities \
  --project SilentInterview.Infrastructure \
  --startup-project SilentInterview.Api \
  --output-dir Migrations

echo ""
echo "Migration generated. Review the diff, then apply it with:"
echo "  dotnet ef database update --project SilentInterview.Infrastructure --startup-project SilentInterview.Api"
