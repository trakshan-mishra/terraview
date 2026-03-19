#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}Starting TerraView...${NC}"

(cd "$DIR/server" && npm run dev) &
S=$!
echo -e "${GREEN}✓ Backend  → http://localhost:3001${NC}"
sleep 2

(cd "$DIR/client" && npm run dev) &
C=$!
echo -e "${GREEN}✓ Frontend → http://localhost:5173${NC}"

echo ""
echo -e "${CYAN}Open → http://localhost:5173${NC}"
echo "Ctrl+C to stop"

trap "kill $S $C 2>/dev/null; echo 'Stopped.'" INT TERM
wait
