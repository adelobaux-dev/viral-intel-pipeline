# Guide : Planificateur Python pour Viral Intel

Ce guide explique comment utiliser le planificateur Python pour exécuter le pipeline automatiquement.

## 🚀 Démarrage Rapide

### 1. Installer les dépendances

```bash
cd /home/user/viral-intel-pipeline
pip install -r requirements.txt
```

### 2. Lancer le planificateur

```bash
python3 scheduler_daemon.py
```

### 3. Laisser s'exécuter en arrière-plan

Pour laisser le planificateur s'exécuter en arrière-plan, utilisez `nohup` ou `screen` :

**Avec nohup :**
```bash
nohup python3 scheduler_daemon.py > logs/scheduler.log 2>&1 &
```

**Avec screen :**
```bash
screen -S viral-intel-scheduler
python3 scheduler_daemon.py
# Appuyez sur Ctrl+A puis D pour détacher
```

**Avec tmux :**
```bash
tmux new-session -d -s viral-intel-scheduler "python3 scheduler_daemon.py"
```

---

## 📋 Utilisation

### Exécution Hebdomadaire (Défaut)

Le planificateur exécute le pipeline **chaque vendredi à 18h00** par défaut.

```bash
python3 scheduler_daemon.py
```

### Exécution Quotidienne

Modifiez `scheduler_daemon.py` :

```python
# Ligne à modifier
scheduler.schedule_weekly()

# Remplacez par :
scheduler.schedule_daily(hour=18, minute=0)  # Chaque jour à 18h00
```

### Exécution à Intervalle Régulier

Modifiez `scheduler_daemon.py` :

```python
# Ligne à modifier
scheduler.schedule_weekly()

# Remplacez par :
scheduler.schedule_interval(minutes=60)  # Toutes les 60 minutes
```

---

## 🔍 Monitoring

### Voir les logs en temps réel

```bash
tail -f logs/scheduler.log
```

### Voir les processus Python actifs

```bash
ps aux | grep scheduler_daemon.py
```

### Arrêter le planificateur

```bash
# Trouver le PID
ps aux | grep scheduler_daemon.py

# Arrêter le processus
kill <PID>
```

---

## 🐛 Dépannage

### Le planificateur ne démarre pas

Vérifiez que les dépendances sont installées :

```bash
pip install schedule
```

### Le pipeline ne s'exécute pas à l'heure prévue

1. Vérifiez l'heure du système :
   ```bash
   date
   ```

2. Vérifiez les logs :
   ```bash
   tail -f logs/scheduler.log
   ```

3. Testez le pipeline manuellement :
   ```bash
   python3 main.py
   ```

### Les fichiers ne sont pas créés

Vérifiez les permissions :

```bash
chmod 755 /home/user/viral-intel-pipeline
mkdir -p /home/user/viral-intel-pipeline/logs
chmod 755 /home/user/viral-intel-pipeline/logs
```

---

## 🔧 Configuration Avancée

### Créer un service systemd (Recommandé)

Créez `/etc/systemd/system/viral-intel-scheduler.service` :

```ini
[Unit]
Description=Viral Intel Pipeline Scheduler
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/user/viral-intel-pipeline
ExecStart=/usr/bin/python3 /home/user/viral-intel-pipeline/scheduler_daemon.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Activez le service :

```bash
sudo systemctl daemon-reload
sudo systemctl enable viral-intel-scheduler
sudo systemctl start viral-intel-scheduler
```

Vérifiez l'état :

```bash
sudo systemctl status viral-intel-scheduler
```

Voir les logs :

```bash
sudo journalctl -u viral-intel-scheduler -f
```

### Créer un script de démarrage

Créez `start_scheduler.sh` :

```bash
#!/bin/bash

PROJECT_DIR="/home/user/viral-intel-pipeline"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$PROJECT_DIR/scheduler.pid"

# Créer le répertoire des logs
mkdir -p "$LOG_DIR"

# Vérifier si le planificateur est déjà en cours d'exécution
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "❌ Le planificateur est déjà en cours d'exécution (PID: $OLD_PID)"
        exit 1
    fi
fi

# Démarrer le planificateur
echo "🚀 Démarrage du planificateur..."
nohup python3 "$PROJECT_DIR/scheduler_daemon.py" > "$LOG_DIR/scheduler.log" 2>&1 &
NEW_PID=$!

# Sauvegarder le PID
echo $NEW_PID > "$PID_FILE"

echo "✅ Planificateur démarré (PID: $NEW_PID)"
echo "📝 Logs : $LOG_DIR/scheduler.log"
```

Rendez-le exécutable :

```bash
chmod +x start_scheduler.sh
```

Démarrez-le :

```bash
./start_scheduler.sh
```

---

## 📊 Monitoring Avancé

### Créer un script de monitoring

Créez `monitor_scheduler.sh` :

```bash
#!/bin/bash

PROJECT_DIR="/home/user/viral-intel-pipeline"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$PROJECT_DIR/scheduler.pid"

echo "📊 État du Planificateur Viral Intel"
echo "===================================="
echo ""

# Vérifier si le planificateur est actif
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "✅ Planificateur actif (PID: $PID)"
    else
        echo "❌ Planificateur inactif"
    fi
else
    echo "❌ Planificateur non démarré"
fi

echo ""
echo "📝 Derniers logs :"
tail -20 "$LOG_DIR/scheduler.log"

echo ""
echo "⏰ Prochaine exécution :"
echo "Vendredi à 18h00"
```

Rendez-le exécutable et exécutez-le :

```bash
chmod +x monitor_scheduler.sh
./monitor_scheduler.sh
```

---

## 🎯 Résumé

Une fois le planificateur lancé :

✅ S'exécute **automatiquement chaque vendredi à 18h00**
✅ Récupère les vidéos YouTube
✅ Génère les analyses pédagogiques
✅ Crée les scripts YouTube
✅ Envoie les emails
✅ Synchronise avec Google Drive
✅ Crée les entrées dans la base de données

**Aucune intervention manuelle requise !**

---

## 📞 Support

Pour plus d'informations :
- [Documentation schedule](https://schedule.readthedocs.io/)
- [Documentation APScheduler](https://apscheduler.readthedocs.io/)
