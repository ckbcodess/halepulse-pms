#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════╗"
echo "║   HalePulse — Production Setup           ║"
echo "╚══════════════════════════════════════════╝"

# 1. Run migrations
echo ""
echo "→ Running database migrations..."
npx prisma migrate deploy
echo "  ✓ Migrations applied"

# 2. Seed (only if no users exist)
echo ""
echo "→ Checking if seed is needed..."
USER_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) as c FROM \"User\";" 2>/dev/null || echo "0")
if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo "  → Seeding database..."
  npx prisma db seed
  echo "  ✓ Seed complete"
else
  echo "  ✓ Database already has data, skipping seed"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Setup complete!                        ║"
echo "║   Start with: npm start                  ║"
echo "║   Or: docker compose up                  ║"
echo "╚══════════════════════════════════════════╝"
