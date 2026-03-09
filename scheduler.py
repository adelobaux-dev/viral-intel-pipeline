import os
import yaml
from apscheduler.schedulers.blocking import BlockingScheduler
from main import run_pipeline

def start_scheduler():
    # Charger la configuration
    with open("config.yaml", "r") as f:
        config = yaml.safe_load(f)
    
    scheduler = BlockingScheduler()
    
    # Planifier l'exécution hebdomadaire (vendredi à 18h)
    scheduler.add_job(
        run_pipeline,
        'cron',
        day_of_week=config['scheduler']['day_of_week'],
        hour=config['scheduler']['hour'],
        minute=config['scheduler']['minute'],
        timezone=config['scheduler']['timezone']
    )
    
    print(f"Planificateur démarré. Prochaine exécution : {config['scheduler']['day_of_week']} à {config['scheduler']['hour']}:{config['scheduler']['minute']} ({config['scheduler']['timezone']})")
    
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        pass

if __name__ == "__main__":
    start_scheduler()
