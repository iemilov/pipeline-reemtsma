# Pipeline

Repository fuer alle Toolsets und Skills zur AI-gestuetzten Projektimplementierung mit Claude Code.

## Voraussetzungen

- Git (mit Submodule-Support)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installiert (`npm install -g @anthropic-ai/claude-code`)
- Zugriff auf dieses Repository (GitHub: `Lintlinger/ai-project`)

## Setup als Submodule

### Erstmaliges Einrichten

Dieses Repository wird als Git-Submodule im Salesforce CICD Hauptrepo unter dem Pfad `pipeline/` eingebunden.

```bash
# 1. Hauptrepo klonen (falls noch nicht geschehen)
git clone https://dev.azure.com/LottoBW/Salesforce%20CICD/_git/Salesforce%20CICD
cd "Salesforce CICD"

# 2. Submodule initialisieren und pullen
git submodule init
git submodule update

# 3. Setup-Skript ausfuehren (erstellt Symlinks fuer Claude Code)
cd pipeline
./setup.sh
```

Das Setup-Skript erstellt drei Symlinks im Hauptrepo:

| Symlink | Ziel | Zweck |
|---------|------|-------|
| `CLAUDE.md` | `pipeline/CLAUDE.md` | Projektdokumentation fuer Claude Code |
| `.claude/settings.local.json` | `pipeline/.claude/settings.local.json` | Berechtigungen und Einstellungen |
| `.claude/skills` | `pipeline/.claude/skills` | Custom Skills (Slash Commands) |

Diese Symlinks sind in der `.gitignore` des Hauptrepos eingetragen und werden nicht mitcommittet.

### Bestehendes Repo aktualisieren

```bash
# Submodule auf den neuesten Stand bringen
git submodule update --remote pipeline
```

## Claude Code einrichten

### 1. Claude Code starten

```bash
# Im Root des Salesforce CICD Repos ausfuehren
claude
```

Claude Code erkennt automatisch die `CLAUDE.md`, Einstellungen und Skills ueber die Symlinks.

### 2. Atlassian-Plugin aktivieren

Fuer die Jira/Confluence-Integration muss das Atlassian-Plugin einmalig aktiviert werden:

```
/plugin
```

Anschliessend den Anweisungen zur Authentifizierung folgen.

### 3. Verfuegbare Skills

Nach dem Setup stehen folgende Slash Commands zur Verfuegung:

| Command | Beschreibung |
|---------|-------------|
| `/create-story <epic-id>` | Erstellt Jira User Stories aus Meeting-Transkripten |
| `/implement-us <story-key>` | Generiert einen ersten Implementierungsentwurf fuer eine User Story |
| `/deploy-us <story-key> <org>` | Deployed Metadata zu einer Salesforce Org und fuehrt Tests aus |
| `/document-us <epic-id>` | Erstellt eine Confluence-Dokumentationsseite fuer ein Epic |
| `/architecture-overview` | Generiert eine technische Architekturuebersicht auf Confluence |
| `/release-notes <version>` | Erstellt Release Notes aus dem letzten Master-Merge-Commit |

## Verzeichnisstruktur

```
pipeline/
├── CLAUDE.md                          # Projektdokumentation fuer Claude Code
├── README.md                          # Diese Datei
├── setup.sh                           # Symlink-Setup-Skript
└── .claude/
    ├── settings.local.json            # Berechtigungen und Einstellungen
    └── skills/
        ├── 01-create-us/
        │   ├── SKILL.md               # Skill-Definition
        │   └── logs/                  # Ausfuehrungsprotokolle
        ├── 02-implement-us/
        ├── 03-deploy-us/
        ├── 04-document-us/
        ├── 05-architecture-overview/
        └── 06-release-notes/
```

## Hinweise

- **Vertraulichkeit:** Der Kunde hat keinen Zugriff auf dieses Submodule. Sensible Informationen (Skill-Prompts, interne Prozesse) gehoeren ausschliesslich hierher, nicht ins Hauptrepo.
- **Logs:** Jede Skill-Ausfuehrung erzeugt ein Protokoll unter `.claude/skills/<skill>/logs/` im Format `<YYYY-MM-DD>-<identifier>-<skill-name>.txt`.
- **Aenderungen committen:** Aenderungen an Skills oder Einstellungen muessen im Submodule committet und gepusht werden. Anschliessend muss im Hauptrepo die Submodule-Referenz aktualisiert werden:

```bash
# Im pipeline/ Verzeichnis
git add . && git commit -m "Beschreibung" && git push

# Im Hauptrepo-Root
git add pipeline && git commit -m "Update pipeline submodule" && git push
```
