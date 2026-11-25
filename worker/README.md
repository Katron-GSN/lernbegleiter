# Abrufdienst für die Schulanbindung

Dieser kleine Dienst läuft kostenlos bei Cloudflare. Er meldet sich mit Pauls Zugang bei WebUntis an, liest den itslearning-Kalender und gibt der App nur die fertigen Daten weiter. Pauls Passwort liegt dadurch nie im Browser und nie im öffentlichen GitHub-Repo.

Die Einrichtung geht komplett im Browser, ohne Programme auf dem PC. Sie dauert etwa 15 Minuten.

## 1. Cloudflare-Konto

Auf [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) ein kostenloses Konto anlegen.

## 2. Worker aus GitHub anlegen (empfohlen)

So holt sich Cloudflare jede neue Version aus dem Repo automatisch.

1. **Workers & Pages** → **Erstellen** → **Repository importieren** (bzw. „Import a repository“).
2. GitHub verbinden und Zugriff auf `NB-GSN/lernbegleiter` erlauben.
3. Das Repository `lernbegleiter` auswählen.
4. Einstellungen: Projektname `lernbegleiter-sync`, **Root-Verzeichnis `worker`**, Build-Befehl leer, Deploy-Befehl `npx wrangler deploy`.
5. **Bereitstellen**. Die Adresse steht danach oben beim Worker. Test: `<Adresse>/health` im Browser zeigt `{"ok":true,…}`.

**Ohne GitHub-Verbindung:** **Mit Hello World beginnen** → Namen `lernbegleiter-sync` → Bereitstellen → **Code bearbeiten** → den Inhalt von [`src/index.js`](src/index.js) einfügen → Bereitstellen. Dann zusätzlich `ALLOWED_ORIGIN` als Text-Variable eintragen (siehe unten). Updates müssen bei dieser Variante von Hand eingefügt werden.

## 3. Werte eintragen

Beim Worker unter **Einstellungen → Variablen und Geheimnisse** diese Einträge hinzufügen. Alle als Typ **Geheimnis** anlegen. `ALLOWED_ORIGIN` kommt bei der GitHub-Variante schon aus `wrangler.toml` und muss nur bei der Variante ohne GitHub eingetragen werden.

| Name | Was hinein gehört |
| --- | --- |
| `ALLOWED_ORIGIN` | `https://nb-gsn.github.io` (Typ Text, nur ohne GitHub-Verbindung) |
| `APP_KEY` | Ein langes, frei ausgedachtes Passwort. Dasselbe kommt später in die App. |
| `UNTIS_SERVER` | Der Servername aus der WebUntis-Adresszeile, z. B. `nessa.webuntis.com` |
| `UNTIS_SCHOOL` | Optional. Leer lassen, dann sucht der Dienst die Schule selbst. Nur nötig, wenn die App „Schule nicht gefunden“ meldet. |
| `UNTIS_USER` | Pauls WebUntis-Benutzername |
| `UNTIS_PASSWORD` | Pauls WebUntis-Passwort |
| `ITSL_ICAL_URL` | Pauls iCal-Link aus itslearning (Kalender → iCal-Feed abrufen) |

Danach erneut **Bereitstellen**. Die Adresse des Dienstes steht oben beim Worker, z. B. `https://lernbegleiter-sync.<name>.workers.dev`.

## 4. In der App verbinden

In der App unter **Ich → Einstellungen → Schulanbindung** die Adresse des Dienstes und den `APP_KEY` eintragen, dann **Jetzt abrufen**. Danach aktualisiert sich die App beim Öffnen automatisch, höchstens alle 30 Minuten.

## Gut zu wissen

- **Inoffizielle Schnittstelle:** WebUntis bietet für Familien keine offizielle Schnittstelle. Der Dienst nutzt dieselben Wege wie die WebUntis-Webseite. Das kann sich bei Updates ändern.
- **Login über Schulkonto:** Wenn sich Paul bei WebUntis nur über ein Microsoft- oder Schulkonto (Single Sign-on) anmelden kann, funktioniert die Anmeldung mit Benutzername und Passwort nicht. Dann zeigt die App unter „Schulanbindung“ ein Problem bei `webuntis` an.
- **Teilweise Daten:** Klappt nur ein Teil (z. B. Stundenplan ja, Hausaufgaben nein), zeigt die App die Daten, die da sind, und nennt die Quelle mit Problem.
- Ein Abruf wird 10 Minuten zwischengespeichert. **Jetzt abrufen** in der App holt immer frisch.

## Später auf einen eigenen Server umziehen

Der Dienst ist nicht an Cloudflare gebunden. Derselbe Code `src/index.js` läuft auch mit Node.js 18 oder neuer, z. B. auf einem Raspberry Pi, einem NAS oder einem gemieteten Server.

1. Den Ordner `worker` auf den Server kopieren.
2. `.env.example` als `.env` kopieren und dieselben Werte eintragen wie bei Cloudflare.
3. Starten mit `node server.js`, oder per Docker: `docker build -t lernbegleiter-sync .` und `docker run --env-file .env -p 8787:8787 lernbegleiter-sync`.
4. Den Server über HTTPS erreichbar machen (z. B. mit einem Reverse Proxy wie Caddy), weil die App nur HTTPS-Adressen abrufen darf.
5. In der App unter **Ich → Einstellungen → Schulanbindung** nur die Adresse ändern. Daten in der App bleiben erhalten.

Die App selbst ist eine reine statische Webseite mit relativen Pfaden. Sie kann von GitHub Pages auf jeden anderen Webserver umziehen, indem man die Dateien im Hauptordner dorthin kopiert. Dann in `ALLOWED_ORIGIN` die neue Adresse der App eintragen (mehrere durch Komma getrennt). Achtung: Die Daten in der App hängen an der Web-Adresse. Vor einem Adresswechsel unter **Ich → Datensicherung** sichern und auf der neuen Adresse wiederherstellen.
