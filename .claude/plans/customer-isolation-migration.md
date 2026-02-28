# Migrationsplan: Kunden-Isolation im Pipeline-Submodule

## Problem

Das `pipeline`-Repo enthält Config-Daten aller Kunden (`customers/lotto-bw/`, `customers/drKade/`, `customers/cloudrise/`). Jeder mit Repo-Zugang sieht Cloud IDs, Jira-Credentials und Domain-Wissen aller Kunden.

## Gewählter Ansatz: Ein Pipeline-Repo pro Kunde

Jeder Kunde bekommt ein **eigenständiges Pipeline-Repo**, das alle Skills + nur die eigene Config enthält. Skill-Updates werden über ein Template-Repo synchronisiert.

### Zielstruktur

```
GitHub:
  Lintlinger/pipeline-template    ← Skills, CLAUDE.md, _template/ (kein Kunden-Config)
  Lintlinger/pipeline-lottobw     ← Skills + nur customers/lotto-bw/
  Lintlinger/pipeline-drkade      ← Skills + nur customers/drKade/
  Lintlinger/pipeline-cloudrise   ← Skills + nur customers/cloudrise/

Projekt-Repo (z.B. CloudRise):
  .gitmodules → pipeline = pipeline-cloudrise
```

## Migrationsschritte

### Schritt 1: Template-Repo vorbereiten

1. Aktuelles `pipeline`-Repo auf GitHub umbenennen: `pipeline` → `pipeline-template`
2. Im Template alle Kunden-Ordner entfernen (nur `_template/` behalten):
   ```bash
   cd pipeline-template
   git rm -r customers/lotto-bw customers/drKade customers/cloudrise
   git commit -m "remove customer configs, keep template only"
   git push
   ```
3. Ergebnis: `pipeline-template` enthält nur Skills, CLAUDE.md, `customers/_template/`, setup.sh

### Schritt 2: Kunden-Repos erstellen (pro Kunde)

Für jeden Kunden (Beispiel: `lotto-bw`):

1. Neues leeres Repo erstellen: `pipeline-lottobw`
2. Template als Basis klonen und History übernehmen:
   ```bash
   git clone https://github.com/Lintlinger/pipeline-template.git pipeline-lottobw
   cd pipeline-lottobw
   git remote rename origin template
   git remote add origin https://github.com/Lintlinger/pipeline-lottobw.git
   ```
3. Kunden-Config aus der alten History wiederherstellen:
   ```bash
   # Aus dem letzten Commit vor der Migration holen
   git checkout template/main~1 -- customers/lotto-bw/
   git commit -m "add lotto-bw customer config"
   ```
4. Symlinks anpassen (zeigen jetzt nur auf den einen Kunden):
   ```bash
   ln -sf customers/lotto-bw/config.md customer.config.md
   ln -sf customers/lotto-bw/domain-knowledge.md customer.domain.md
   ln -sf customers/lotto-bw/stack.config.md stack.config.md
   ln -sf customers/lotto-bw/testdata.config.md testdata.config.md
   git add -A && git commit -m "configure symlinks for lotto-bw"
   ```
5. Push:
   ```bash
   git push -u origin main
   ```
6. Wiederholen für `drKade` und `cloudrise`

### Schritt 3: setup.sh anpassen

Da jedes Kunden-Repo nur einen Kunden enthält, wird `setup.sh` vereinfacht. Der Customer-Parameter entfällt — das Repo IST der Kunde:

```bash
#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SUBMODULE_NAME="$(basename "$SCRIPT_DIR")"

# Auto-detect: einziger Ordner in customers/ (ohne _template)
CUSTOMER=$(ls -1 "$SCRIPT_DIR/customers/" | grep -v '^_' | head -1)
CUSTOMER_DIR="$SCRIPT_DIR/customers/$CUSTOMER"

if [ ! -d "$CUSTOMER_DIR" ]; then
  echo "Error: No customer folder found in customers/"
  exit 1
fi

mkdir -p "$REPO_ROOT/.claude"
ln -sf "../$SUBMODULE_NAME/.claude/settings.local.json" "$REPO_ROOT/.claude/settings.local.json"
ln -sf "../$SUBMODULE_NAME/.claude/skills" "$REPO_ROOT/.claude/skills"
ln -sf "$SUBMODULE_NAME/CLAUDE.md" "$REPO_ROOT/CLAUDE.md"
ln -sf "customers/$CUSTOMER/config.md" "$SCRIPT_DIR/customer.config.md"
ln -sf "customers/$CUSTOMER/domain-knowledge.md" "$SCRIPT_DIR/customer.domain.md"
ln -sf "customers/$CUSTOMER/stack.config.md" "$SCRIPT_DIR/stack.config.md"
ln -sf "customers/$CUSTOMER/testdata.config.md" "$SCRIPT_DIR/testdata.config.md"

echo "Claude Code symlinks created (customer: $CUSTOMER)"
```

### Schritt 4: Hauptprojekte umstellen

In jedem Kunden-Hauptprojekt das Submodule auf das neue Repo umbiegen:

```bash
# Im Hauptprojekt (z.B. CloudRise)
git submodule set-url pipeline https://github.com/Lintlinger/pipeline-cloudrise.git
git submodule sync
cd pipeline && git fetch && git checkout main
cd .. && git add .gitmodules pipeline
git commit -m "switch pipeline submodule to customer-specific repo"
```

### Schritt 5: Skill-Updates synchronisieren

Wenn Skills im Template aktualisiert werden, in jedes Kunden-Repo mergen:

```bash
cd pipeline-lottobw
git fetch template
git merge template/main
# Konflikte nur bei Kunden-spezifischen Änderungen möglich
git push origin main
```

**Tipp:** Automatisierbar als GitHub Action — Template-Push triggert PRs in Kunden-Repos.

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `pipeline/setup.sh` | Vereinfacht (auto-detect statt Parameter) |
| `pipeline/CLAUDE.md` | "Customer Switching"-Abschnitt entfernen |
| `.gitmodules` | URL pro Hauptprojekt anpassen |
| `pipeline/customers/` | Pro Repo nur 1 Kunde + `_template/` |

## Vorteile

- Saubere Zugriffskontrolle über GitHub Repo-Permissions
- Kein Kunde sieht Config eines anderen Kunden
- Skills bleiben zentral wartbar (Template als Upstream)
- Bestehender Workflow (Symlinks, setup.sh) bleibt fast identisch
- Einfaches Onboarding: Template klonen, Config ausfüllen, fertig

## Nachteile / Risiken

- Skill-Updates müssen in N Repos gemergt werden (mitigierbar durch Automation)
- Mehr GitHub-Repos zu verwalten (1 Template + N Kunden statt 1)
- Einmalige Migration aller Hauptprojekte nötig (.gitmodules)

## Reihenfolge

1. Template-Repo vorbereiten (Schritt 1)
2. Kunden-Repos erstellen (Schritt 2) — parallel für alle 3 Kunden
3. setup.sh + CLAUDE.md anpassen (Schritt 3) — im Template committen, dann in Kunden-Repos mergen
4. Hauptprojekte umstellen (Schritt 4) — eines nach dem anderen, testen
5. Altes `pipeline`-Repo archivieren
