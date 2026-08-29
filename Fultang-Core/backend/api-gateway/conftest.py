import sys
from pathlib import Path

# Permet `from app.tenant.resolver import ...` quel que soit le
# répertoire depuis lequel pytest est lancé.
sys.path.insert(0, str(Path(__file__).resolve().parent))
