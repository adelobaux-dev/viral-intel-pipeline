#!/usr/bin/env python3
"""
Planificateur Python pour exécuter le pipeline Viral Intel
Exécution : python3 scheduler_daemon.py
"""

import schedule
import time
import subprocess
import sys
import os
from datetime import datetime
import logging

# Configuration du logging
log_dir = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(log_dir, exist_ok=True)

log_file = os.path.join(log_dir, 'scheduler.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class PipelineScheduler:
    """Planificateur pour le pipeline Viral Intel"""
    
    def __init__(self, project_dir):
        self.project_dir = project_dir
        self.main_script = os.path.join(project_dir, 'main.py')
        logger.info(f"Planificateur initialisé - Répertoire : {project_dir}")
    
    def run_pipeline(self):
        """Exécuter le pipeline"""
        logger.info("=" * 60)
        logger.info("🚀 Démarrage du pipeline Viral Intel")
        logger.info("=" * 60)
        
        try:
            # Changer le répertoire courant
            os.chdir(self.project_dir)
            
            # Exécuter le script principal
            result = subprocess.run(
                [sys.executable, self.main_script],
                capture_output=True,
                text=True,
                timeout=3600  # Timeout de 1 heure
            )
            
            # Afficher la sortie
            if result.stdout:
                logger.info("STDOUT:")
                logger.info(result.stdout)
            
            if result.stderr:
                logger.warning("STDERR:")
                logger.warning(result.stderr)
            
            if result.returncode == 0:
                logger.info("=" * 60)
                logger.info("✅ Pipeline complété avec succès")
                logger.info("=" * 60)
            else:
                logger.error("=" * 60)
                logger.error(f"❌ Pipeline échoué avec le code {result.returncode}")
                logger.error("=" * 60)
        
        except subprocess.TimeoutExpired:
            logger.error("❌ Pipeline a dépassé le timeout (1 heure)")
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'exécution du pipeline : {e}")
            import traceback
            logger.error(traceback.format_exc())
    
    def schedule_weekly(self):
        """Planifier l'exécution hebdomadaire (vendredi à 18h00)"""
        schedule.every().friday.at("18:00").do(self.run_pipeline)
        logger.info("📅 Pipeline planifié pour chaque vendredi à 18h00")
    
    def schedule_daily(self, hour=18, minute=0):
        """Planifier l'exécution quotidienne"""
        schedule.every().day.at(f"{hour:02d}:{minute:02d}").do(self.run_pipeline)
        logger.info(f"📅 Pipeline planifié pour chaque jour à {hour:02d}:{minute:02d}")
    
    def schedule_interval(self, minutes=60):
        """Planifier l'exécution à intervalle régulier"""
        schedule.every(minutes).minutes.do(self.run_pipeline)
        logger.info(f"📅 Pipeline planifié toutes les {minutes} minutes")
    
    def run_scheduler(self):
        """Exécuter le planificateur en boucle"""
        logger.info("🎯 Planificateur démarré - Attente des tâches planifiées...")
        logger.info(f"Heure actuelle : {datetime.now().isoformat()}")
        
        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # Vérifier toutes les minutes
        except KeyboardInterrupt:
            logger.info("⏹️  Planificateur arrêté par l'utilisateur")
        except Exception as e:
            logger.error(f"❌ Erreur du planificateur : {e}")
            import traceback
            logger.error(traceback.format_exc())

def main():
    """Fonction principale"""
    # Déterminer le répertoire du projet
    project_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Créer le planificateur
    scheduler = PipelineScheduler(project_dir)
    
    # Planifier l'exécution hebdomadaire (vendredi à 18h00)
    scheduler.schedule_weekly()
    
    # Exécuter le planificateur
    scheduler.run_scheduler()

if __name__ == "__main__":
    main()
