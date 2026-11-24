# Abrufdienst für die Schulanbindung

Dieser kleine Dienst läuft kostenlos bei Cloudflare. Er meldet sich mit Pauls Zugang bei WebUntis an, liest den itslearning-Kalender und gibt der App nur die fertigen Daten weiter. Pauls Passwort liegt dadurch nie im Browser und nie im öffentlichen GitHub-Repo.

Die Einrichtung geht komplett im Browser, ohne Programme auf dem PC. Sie dauert etwa 15 Minuten.

## 1. Cloudflare-Konto

1. Auf [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) ein kostenloses Konto anlegen.
2. Links **Workers & Pages** öffnen → **Erstellen** → **Worker erstellen**.
3. Als Namen `lernbegleiter-sync` eingeben → **Bereitstellen**.

## 2. Code einfügen

1. Beim neuen Worker auf **Code bearbeiten** klicken.
2. Den gesamten Inhalt der Datei [`src/index.js`](src/index.js) aus diesem Repo kopieren und den Beispielcode damit ersetzen.
3. Oben rechts **Bereitstellen** klicken.

## 3. Werte eintragen

Beim Worker unter **Einstellungen → Variablen und Geheimnisse** diese Einträge hinzufügen. Alle außer `ALLOWED_ORIGIN` als Typ **Geheimnis** anlegen.

| Name | Was hinein gehört |
| --- | --- |
| `ALLOWED_ORIGIN` | `https://nb-gsn.github.io` (Typ Text) |
| `APP_KEY` | Ein langes, frei ausgedachtes Passwort. Dasselbe kommt später in die App. |
| `UNTIS_SERVER` | Der Servername aus der WebUntis-Adresszeile, z. B. `nessa.webuntis.com` |
| `UNTIS_SCHOOL` | Der Schulname wie beim WebUntis-Login (steht in der Adresse hinter `school=`) |
| `UNTIS_USER` | Pauls WebUntis-Benutzername |
| `UNTIS_PASSWORD` | Pauls WebUntis-Passwort |
| `ITSL_ICAL_URL` | Pauls iCal-Link aus itslearning (Kalender → iCal-Feed abrufen) |

Danach erneut **Bereitstellen**. Die Adresse des Dienstes steht oben beim Worker, z. B. `https://lernbegleiter-sync.<name>.workers.dev`.

## 4. In der App verbinden

In der App unter **Ich → Schulanbindung** die Adresse des Dienstes und den `APP_KEY` eintragen, dann **Jetzt abrufen**. Danach aktualisiert sich die App beim Öffnen automatisch, höchstens alle 30 Minuten.

## Gut zu wissen

- **Inoffizielle Schnittstelle:** WebUntis bietet für Familien keine offizielle Schnittstelle. Der Dienst nutzt dieselben Wege wie die WebUntis-Webseite. Das kann sich bei Updates ändern.
- **Login über Schulkonto:** Wenn sich Paul bei WebUntis nur über ein Microsoft- oder Schulkonto (Single Sign-on) anmelden kann, funktioniert die Anmeldung mit Benutzername und Passwort nicht. Dann zeigt die App unter „Schulanbindung“ ein Problem bei `webuntis` an.
- **Teilweise Daten:** Klappt nur ein Teil (z. B. Stundenplan ja, Hausaufgaben nein), zeigt die App die Daten, die da sind, und nennt die Quelle mit Problem.
- Ein Abruf wird 10 Minuten zwischengespeichert. **Jetzt abrufen** in der App holt immer frisch.
