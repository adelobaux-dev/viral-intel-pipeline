# Guide de Configuration : Tâche Cron Locale

Ce guide explique comment configurer une tâche cron pour exécuter le pipeline Viral Intel automatiquement chaque vendredi à 18h00.

## 🚀 Installation Rapide (3 étapes)

### Étape 1 : Naviguer vers le répertoire du projet

```bash
cd /home/user/viral-intel-pipeline
```

### Étape 2 : Exécuter le script de configuration

```bash
bash setup_cron.sh
```

### Étape 3 : Suivre les instructions

Le script vous guidera à travers la configuration. Répondez aux questions et c'est tout !

---

## 📋 Configuration Manuelle (Si Préféré)

Si vous préférez configurer manuellement, voici comment faire :

### 1. Créer un script d'exécution

Créez un fichier `run_pipeline.sh` :

```bash
#!/bin/bash
cd /home/user/viral-intel-pipeline
source venv/bin/activate  # Si vous utilisez un virtualenv
python3 main.py >> logs/pipeline.log 2>&1
```

Rendez-le exécutable :

```bash
chmod +x run_pipeline.sh
```

### 2. Ajouter une entrée cron

Ouvrez l'éditeur cron :

```bash
crontab -e
```

Ajoutez cette ligne à la fin :

```
0 18 * * 5 cd /home/user/viral-intel-pipeline && /usr/bin/python3 main.py >> logs/pipeline.log 2>&1
```

**Explication du cron :**
- `0` = Minute 0
- `18` = Heure 18 (6 PM)
- `*` = Tous les jours du mois
- `*` = Tous les mois
- `5` = Vendredi (0=Dimanche, 1=Lundi, ..., 5=Vendredi)

### 3. Vérifier la configuration

```bash
crontab -l
```

Vous devriez voir votre entrée cron.

---

## 🔧 Commandes Utiles

### Voir toutes les tâches cron

```bash
crontab -l
```

### Modifier les tâches cron

```bash
crontab -e
```

### Supprimer toutes les tâches cron

```bash
crontab -r
```

### Voir les logs du pipeline

```bash
tail -f /home/user/viral-intel-pipeline/logs/pipeline.log
```

### Voir les logs système de cron

```bash
# Sur Linux
sudo tail -f /var/log/syslog | grep CRON

# Sur macOS
log stream --predicate 'process == "cron"'
```

---

## ⏰ Horaires Personnalisés

Vous pouvez modifier l'horaire en changeant les valeurs cron :

| Horaire | Cron |
|---------|------|
| Chaque jour à 9h | `0 9 * * *` |
| Chaque lundi à 18h | `0 18 * * 1` |
| Chaque vendredi à 18h | `0 18 * * 5` |
| Chaque dimanche à 22h | `0 22 * * 0` |
| Deux fois par semaine (lun/ven) à 18h | `0 18 * * 1,5` |
| Chaque heure | `0 * * * *` |
| Toutes les 30 minutes | `*/30 * * * *` |

---

## 🐛 Dépannage

### La tâche cron ne s'exécute pas

1. **Vérifiez que cron est actif :**
   ```bash
   sudo systemctl status cron
   ```

2. **Vérifiez les permissions :**
   ```bash
   ls -la /home/user/viral-intel-pipeline/
   ```

3. **Vérifiez les logs :**
   ```bash
   tail -f /var/log/syslog | grep CRON
   ```

### Les dépendances ne sont pas trouvées

Utilisez le chemin complet de Python :

```bash
/usr/bin/python3 /home/user/viral-intel-pipeline/main.py
```

Ou activez le virtualenv dans le script :

```bash
#!/bin/bash
cd /home/user/viral-intel-pipeline
source venv/bin/activate
python main.py
```

### Les fichiers ne sont pas créés

Vérifiez que les répertoires existent :

```bash
mkdir -p /home/user/viral-intel-pipeline/logs
chmod 755 /home/user/viral-intel-pipeline
```

### Les emails ne sont pas envoyés

Vérifiez les variables d'environnement :

```bash
# Ajouter au script cron
export YOUTUBE_API_KEY="votre_clé"
export OPENAI_API_KEY="votre_clé"
export EMAIL_FROM="votre_email"
export EMAIL_TO="destinataire"
```

---

## 📊 Monitoring

### Créer un script de monitoring

Créez `monitor_cron.sh` :

```bash
#!/bin/bash

echo "📊 État du Pipeline Viral Intel"
echo "================================"
echo ""

# Vérifier si cron est actif
echo "✅ Cron Status:"
sudo systemctl status cron | grep "Active"

echo ""
echo "📋 Tâches cron configurées:"
crontab -l | grep -v "^#" | grep -v "^$"

echo ""
echo "📝 Derniers logs:"
tail -20 /home/user/viral-intel-pipeline/logs/pipeline.log

echo ""
echo "⏰ Prochaine exécution:"
# Calculer la prochaine exécution
echo "Vendredi à 18h00"
```

Rendez-le exécutable :

```bash
chmod +x monitor_cron.sh
```

Exécutez-le :

```bash
bash monitor_cron.sh
```

---

## 🎯 Résumé

Une fois configurée, votre tâche cron :

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

Pour plus d'informations sur cron :
- [Cron Wikipedia](https://en.wikipedia.org/wiki/Cron)
- [Crontab Guru](https://crontab.guru/)
- [Linux man pages](https://man7.org/linux/man-pages/man5/crontab.5.html)
