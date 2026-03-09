# Viral Intel Pipeline

Automated content analysis and generation pipeline that fetches videos from YouTube, generates AI-powered pedagogical analyses, creates derivative content for specific audiences, and synchronizes with a web dashboard.

## 🎯 Features

- **Content Fetching** : Retrieve videos from YouTube channels
- **Transcript Extraction** : Extract and process video transcripts
- **AI Analysis** : Generate 14-section pedagogical analyses using OpenAI
- **Script Generation** : Create YouTube scripts tailored for medical professionals
- **Dashboard Sync** : Synchronize data with MySQL database for web visualization
- **Email Notifications** : Send weekly reports via email
- **Google Drive Integration** : Store analyses as Google Docs
- **Automated Scheduling** : Run weekly via GitHub Actions

## 📋 Prerequisites

- Python 3.11+
- YouTube API key
- OpenAI API key
- Gmail account (for email notifications)
- Google Drive folder (for document storage)
- MySQL database (optional, for dashboard sync)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/viral-intel-pipeline.git
cd viral-intel-pipeline
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
nano .env
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the Pipeline

```bash
python main.py
```

## 🔧 Configuration

Edit `config.yaml` to customize:

- **YouTube channels** to monitor
- **Analysis sections** (14 default or custom)
- **Output format** (web dashboard, Google Docs, email)
- **Scheduling** (day, time, timezone)

## 🤖 GitHub Actions Automation

This repository includes a GitHub Actions workflow that runs the pipeline automatically every Friday at 18:00 UTC.

### Configure Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `YOUTUBE_API_KEY` - Your YouTube Data API key
- `OPENAI_API_KEY` - Your OpenAI API key
- `EMAIL_FROM` - Sender email address
- `EMAIL_TO` - Recipient email address
- `GOOGLE_DRIVE_FOLDER_ID` - Google Drive folder ID
- `DATABASE_URL` - MySQL connection string (optional)

### Manual Trigger

To run the workflow manually:

1. Go to **Actions** tab
2. Select **"Viral Intel Weekly Pipeline"**
3. Click **"Run workflow"** → **"Run workflow"**

### View Logs

1. Go to **Actions** tab
2. Click on the workflow run
3. Click on **"run-pipeline"** job
4. Review the logs for each step

## 📁 Project Structure

```
viral-intel-pipeline/
├── main.py                      # Main orchestrator
├── requirements.txt             # Python dependencies
├── config.yaml                  # Pipeline configuration
├── .env.example                 # Environment template
├── youtube_fetcher.py           # YouTube content fetching
├── transcript_service.py        # Transcript extraction
├── analyzer.py                  # AI-powered analysis
├── script_generator.py          # Script generation
├── google_docs_service.py       # Google Docs integration
├── email_service.py             # Email notifications
├── database.py                  # Database operations
├── database_sync.py             # Dashboard synchronization
├── .github/
│   └── workflows/
│       └── pipeline.yml         # GitHub Actions workflow
└── README.md                    # This file
```

## 📊 Output

The pipeline generates:

1. **Pedagogical Analyses** : 14-section analyses stored as Google Docs
2. **YouTube Scripts** : Full scripts for medical professionals
3. **Email Reports** : Weekly summaries sent via email
4. **Dashboard Data** : Structured data in MySQL database

## 🔍 Analysis Sections

Each analysis includes:

1. **Explain like I'm 12** - Simplified explanation
2. **Visualize** - Visual maps and diagrams
3. **Break into Chunks** - 3-5 main parts
4. **Patterns** - Formulas and rules
5. **Myths** - Debunking misconceptions
6. **Challenges** - Common mistakes
7. **Real Life** - Practical applications
8. **Teach Back** - Teaching explanation
9. **Why Matters** - Key implications
10. **Simulate** - Practical exercises
11. **Story** - Relatable scenarios
12. **Prioritize** - Top 2-3 concepts
13. **Gaps** - Overlooked aspects
14. **Metadata** - Title, duration, themes, scores

## 🛠️ Customization

### Add Custom Content Sources

Edit `config.yaml` to add more YouTube channels:

```yaml
sources:
  - name: "YouTube Channels"
    type: "youtube"
    channels:
      - "UCxxxxxx"  # Channel ID
      - "UCyyyyyy"
    items_per_channel: 3
```

### Modify Analysis Sections

Edit `analyzer.py` to customize prompts and sections:

```python
ANALYSIS_PROMPTS = {
    "explain": "Your custom prompt here...",
    # ... other sections
}
```

### Change Scheduling

Edit `.github/workflows/pipeline.yml` to change the schedule:

```yaml
on:
  schedule:
    - cron: '0 18 * * 5'  # Friday at 18:00 UTC
```

## 📧 Email Configuration

The pipeline sends emails using Gmail SMTP. Ensure:

1. Gmail account is configured
2. `EMAIL_FROM` and `EMAIL_TO` are set in `.env`
3. Gmail app password is generated (if 2FA is enabled)

## 🗄️ Database Schema

### analyses table

```sql
CREATE TABLE analyses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255),
  channel VARCHAR(100),
  videoId VARCHAR(100),
  publishedAt DATETIME,
  explain LONGTEXT,
  visualize LONGTEXT,
  -- ... other sections
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### scripts table

```sql
CREATE TABLE scripts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255),
  theme VARCHAR(255),
  targetAudience VARCHAR(100),
  duration INT,
  scriptContent LONGTEXT,
  viralityScore INT,
  pedagogyScore INT,
  sourceVideoId VARCHAR(100),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🐛 Troubleshooting

### Pipeline fails to run

1. Check GitHub Actions logs
2. Verify all secrets are configured
3. Ensure `requirements.txt` is complete
4. Test locally: `python main.py`

### No data in dashboard

1. Verify database connection
2. Check `database_sync.py` configuration
3. Review logs for sync errors

### Analysis quality issues

1. Customize prompts in `analyzer.py`
2. Adjust analysis sections in `config.yaml`
3. Test with sample content

### Email not sending

1. Verify Gmail credentials
2. Check `EMAIL_FROM` and `EMAIL_TO` in `.env`
3. Review email service logs

## 📚 Documentation

- [GitHub Actions Workflow Setup](./GITHUB_SETUP_GUIDE.md)
- [Content Sources Guide](./references/content_sources.md)
- [Analysis Customization](./references/analysis_customization.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 📞 Support

For issues or questions:

1. Check the troubleshooting section
2. Review GitHub Issues
3. Check logs in GitHub Actions

## 🎉 Acknowledgments

Built with:
- Python 3.11
- OpenAI GPT-4
- YouTube Data API
- Google Drive API
- GitHub Actions

---

**Last Updated** : February 26, 2026  
**Version** : 1.0.0
