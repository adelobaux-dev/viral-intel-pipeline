#!/bin/bash

# Script de configuration de la tâche cron pour le pipeline viral-intel
# Exécution : bash setup_cron.sh

set -e

echo "🔧 Configuration de la tâche cron pour Viral Intel Pipeline"
echo "==========================================================="
echo ""

# Déterminer le répertoire du projet
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$PROJECT_DIR/run_pipeline.py"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/pipeline_$(date +%Y%m%d_%H%M%S).log"

# Créer le répertoire des logs
mkdir -p "$LOG_DIR"

echo "📁 Répertoire du projet : $PROJECT_DIR"
echo "📝 Fichier de log : $LOG_FILE"
echo ""

# Créer le script Python pour exécuter le pipeline
cat > "$PYTHON_SCRIPT" << 'PYTHON_SCRIPT_EOF'
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
PYTHON_SCRIPT_EOF

chmod +x "$PYTHON_SCRIPT"
echo "✅ Script Python créé : $PYTHON_SCRIPT"
echo ""

# Créer une entrée cron
CRON_SCHEDULE="0 18 * * 5"  # Vendredi à 18h00
CRON_COMMAND="cd $PROJECT_DIR && /usr/bin/python3 run_pipeline.py >> $LOG_DIR/pipeline.log 2>&1"

echo "📅 Configuration de la tâche cron"
echo "   Horaire : Vendredi à 18h00 (cron: $CRON_SCHEDULE)"
echo "   Commande : $CRON_COMMAND"
echo ""

# Vérifier si l'entrée cron existe déjà
if crontab -l 2>/dev/null | grep -q "viral-intel-pipeline"; then
    echo "⚠️  Une tâche cron pour viral-intel-pipeline existe déjà"
    echo "   Voulez-vous la remplacer ? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        echo "❌ Annulation"
        exit 1
    fi
    # Supprimer l'ancienne entrée
    crontab -l | grep -v "viral-intel-pipeline" | crontab -
    echo "✅ Ancienne tâche supprimée"
fi

# Ajouter la nouvelle entrée cron
(crontab -l 2>/dev/null || true; echo "# Viral Intel Pipeline - Exécution chaque vendredi à 18h00") | crontab -
(crontab -l 2>/dev/null || true; echo "$CRON_SCHEDULE $CRON_COMMAND # viral-intel-pipeline") | crontab -

echo "✅ Tâche cron configurée avec succès"
echo ""

# Afficher la tâche cron configurée
echo "📋 Tâches cron actuelles :"
crontab -l | grep -E "viral-intel|Viral"

echo ""
echo "🎉 Configuration complétée !"
echo ""
echo "📝 Notes :"
echo "   - Le pipeline s'exécutera chaque vendredi à 18h00"
echo "   - Les logs seront sauvegardés dans : $LOG_DIR/"
echo "   - Pour voir les logs : tail -f $LOG_DIR/pipeline.log"
echo "   - Pour modifier la tâche : crontab -e"
echo "   - Pour supprimer la tâche : crontab -r"
echo ""
