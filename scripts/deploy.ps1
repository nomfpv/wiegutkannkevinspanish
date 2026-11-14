# Deployt die gebaute Seite in den nginx-LXC zu Hause (siehe DEPLOY.md).
#
#   npm run build
#   .\scripts\deploy.ps1
#
# Kopiert per scp ueber das LAN direkt in den Container - nicht durch den
# WireGuard-Tunnel. Nur die Dateien, die die Seite wirklich braucht:
# node_modules, src, scripts, app.js.map und public/images bleiben lokal.
#
# Hinweis: Diese Datei ist bewusst reines ASCII und liegt als UTF-8 mit BOM vor.
# Windows PowerShell 5.1 liest BOM-lose UTF-8-Skripte als ANSI - Sonderzeichen
# wie "->" oder Gedankenstriche zerfallen dann in Anfuehrungszeichen und
# zerlegen den Parser.

$ErrorActionPreference = 'Stop'

# --- anpassen -------------------------------------------------------------
$Server = 'root@192.168.0.62'      # LAN-IP des LXC (eth0, am 13.08.2026 geprueft)
$Target = '/var/www/kevin'
# --------------------------------------------------------------------------

$root  = Split-Path $PSScriptRoot -Parent
# og.png ist das Vorschaubild fuer Discord, WhatsApp und X, favicon.svg und
# apple-touch-icon.png sind die Symbole. Alle drei erzeugt 'npm run og'.
# styles.css ist seit 13.08.2026 dabei: Tailwind wird gebaut statt im
# Browser compiliert. Fehlt die Datei hier, referenziert index.html eine
# URL, die es auf dem Server nicht gibt - die Seite waere komplett ungestylt.
$files = @('index.html', 'app.js', 'styles.css', 'favicon.svg', 'og.png', 'apple-touch-icon.png')

foreach ($f in $files) {
    $p = Join-Path $root $f
    if (-not (Test-Path $p)) {
        throw "$f fehlt. Erst 'npm run build' laufen lassen."
    }
}

# sql-wasm.wasm (645 KB) braucht nur der Anki-Import. Solange der in
# src/app.jsx auskommentiert ist, landet sql.js nicht im Bundle und die Datei
# waere toter Ballast. Wird der Import reaktiviert, referenziert app.js sie
# wieder - dann geht sie automatisch mit hoch.
if (Select-String -Path (Join-Path $root 'app.js') -Pattern 'sql-wasm' -Quiet) {
    if (-not (Test-Path (Join-Path $root 'sql-wasm.wasm'))) {
        throw "app.js braucht sql-wasm.wasm, die Datei fehlt aber."
    }
    $files += 'sql-wasm.wasm'
}

# Warnen, wenn app.js aelter ist als der Quelltext - sonst deployt man still
# das Bundle von vorgestern.
$built = (Get-Item (Join-Path $root 'app.js')).LastWriteTime
$newestSrc = Get-ChildItem (Join-Path $root 'src') -Recurse -File |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($newestSrc -and $newestSrc.LastWriteTime -gt $built) {
    Write-Warning "app.js ist aelter als $($newestSrc.Name) - 'npm run build' vergessen?"
}

# Abbrechen, wenn 'npm run dev' das Bundle zuletzt gebaut hat. Der Watcher aus
# scripts/dev.mjs schreibt unminifiziert MIT Sourcemap (1,3 MB statt 250 KB) und
# ueberschreibt dabei still den Produktions-Build. Der Dev-Build haengt eine
# sourceMappingURL an, der Produktions-Build nicht - daran erkennt man ihn.
if (Select-String -Path (Join-Path $root 'app.js') -Pattern 'sourceMappingURL' -Quiet) {
    throw "app.js ist ein DEV-Bundle. Laeuft noch 'npm run dev'? Watcher beenden, dann 'npm run build'."
}

# Gleiche Warnung fuer das Vorschaubild: Es traegt die Wortzahl als Text im
# Bild. Nach einem Datenlauf zeigt ein altes og.png in jeder geteilten
# Vorschau die alte Zahl - 'npm run og' baut es samt Meta-Block neu.
$og   = Get-Item (Join-Path $root 'og.png')
$data = Get-Item (Join-Path $root 'src\lib\data.js')
if ($data.LastWriteTime -gt $og.LastWriteTime) {
    Write-Warning "og.png ist aelter als data.js - 'npm run og' vergessen? Die Vorschau zeigt sonst die alte Wortzahl."
}

Write-Host "-> ${Server}:${Target}" -ForegroundColor Cyan
$paths = $files | ForEach-Object { Join-Path $root $_ }
& scp @paths "${Server}:${Target}/"
if ($LASTEXITCODE -ne 0) { throw "scp fehlgeschlagen (Exit $LASTEXITCODE)" }

# Die Schriften liegen seit 13.08.2026 im Repo statt bei Google. Eigener
# Aufruf, weil sie in ein Unterverzeichnis gehoeren. Bewusst kein --delete:
# in assets/ liegen auch Dateien, die nicht aus dem Repo kommen (Globus-
# Texturen, Flaggen, borders.json).
$fontDir = Join-Path $root 'assets\fonts'
$fonts   = Get-ChildItem -Path $fontDir -Filter '*.woff2' -ErrorAction SilentlyContinue
if (-not $fonts) { throw "assets/fonts/*.woff2 fehlen - ohne sie faellt die Seite auf Systemschriften zurueck." }

& ssh $Server "mkdir -p ${Target}/assets/fonts"
if ($LASTEXITCODE -ne 0) { throw "ssh mkdir fehlgeschlagen (Exit $LASTEXITCODE)" }
& scp @($fonts.FullName) "${Server}:${Target}/assets/fonts/"
if ($LASTEXITCODE -ne 0) { throw "scp der Schriften fehlgeschlagen (Exit $LASTEXITCODE)" }

Write-Host "OK - deployt. Pruefen: https://wiegutkannkevinspanisch.de" -ForegroundColor Green
