#!/bin/bash
# ============================================================
#  TerraView v2 — One-command setup
# ============================================================
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${CYAN}"
echo "  ████████╗███████╗██████╗ ██████╗  █████╗ ██╗   ██╗██╗███████╗██╗    ██╗"
echo "     ██║   ██╔════╝██╔══██╗██╔══██╗██╔══██╗██║   ██║██║██╔════╝██║    ██║"
echo "     ██║   █████╗  ██████╔╝██████╔╝███████║██║   ██║██║█████╗  ██║ █╗ ██║"
echo "     ██║   ██╔══╝  ██╔══██╗██╔══██╗██╔══██║╚██╗ ██╔╝██║██╔══╝  ██║███╗██║"
echo "     ██║   ███████╗██║  ██║██║  ██║██║  ██║ ╚████╔╝ ██║███████╗╚███╔███╔╝"
echo "     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝ ╚══╝╚══╝"
echo -e "${NC}"
echo -e "${GREEN}  v2 — GPS Navigation · Live Flights · AI Intelligence${NC}"
echo "  ──────────────────────────────────────────────────────"
echo ""

# Check Node
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found → https://nodejs.org (need v18+)${NC}"; exit 1
fi
echo -e "${GREEN}✓ Node $(node -v)${NC}"

echo ""
echo -e "${YELLOW}━━━ API Keys ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Get OpenRouter key free at: https://openrouter.ai/keys"
echo ""
read -p "  OpenRouter API Key: " OR_KEY
read -p "  Cesium Ion Token (optional, press Enter to skip): " CES_TOKEN
read -p "  Backend port [3001]: " BP; BP=${BP:-3001}
read -p "  Frontend port [5173]: " FP; FP=${FP:-5173}

echo ""
echo -e "${CYAN}Installing server packages…${NC}"
cd "$DIR/server" && npm install --silent
echo -e "${GREEN}✓ Server ready${NC}"

echo -e "${CYAN}Installing client packages…${NC}"
cd "$DIR/client" && npm install --silent
echo -e "${GREEN}✓ Client ready${NC}"

# Write .env files
cat > "$DIR/server/.env" << EOF
PORT=$BP
OPENROUTER_API_KEY=$OR_KEY
OPENSKY_BASE=https://opensky-network.org/api
NODE_ENV=development
EOF

cat > "$DIR/client/.env" << EOF
VITE_BACKEND_URL=http://localhost:$BP
VITE_WS_URL=http://localhost:$BP
VITE_CESIUM_TOKEN=$CES_TOKEN
EOF

echo -e "${GREEN}✓ Environment configured${NC}"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Setup complete!${NC}"
echo ""
echo -e "  Start:    ${CYAN}bash start.sh${NC}"
echo -e "  Open:     ${CYAN}http://localhost:$FP${NC}"
echo ""
echo -e "  Deploy free:"
echo -e "    Frontend → ${CYAN}cd client && npx vercel deploy${NC}"
echo -e "    Backend  → ${CYAN}cd server && npx railway up${NC}"
echo ""
