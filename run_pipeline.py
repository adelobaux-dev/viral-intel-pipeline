#!/usr/bin/env python3
"""
Script pour exécuter le pipeline viral-intel
"""
import subprocess
import sys
import os
from datetime import datetime

# Ajouter le répertoire du projet au chemin
project_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_dir)

# Importer les modules du pipeline
try:
    from main import run_pipeline
except ImportError as e:
    print(f"❌ Erreur : Impossible d'importer le pipeline : {e}")
    sys.exit(1)

def main():
    """Exécuter le pipeline"""
    print(f"🚀 Démarrage du pipeline Viral Intel - {datetime.now().isoformat()}")
    print("=" * 60)
    
    try:
        # Exécuter le pipeline
        run_pipeline()
        print("=" * 60)
        print(f"✅ Pipeline complété avec succès - {datetime.now().isoformat()}")
        return 0
    except Exception as e:
        print("=" * 60)
        print(f"❌ Erreur lors de l'exécution du pipeline : {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
