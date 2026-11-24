# Lernbegleiter

Eine kleine Lern-App für Klasse 7 als Web-App (PWA). Sie läuft im Safari des iPads und lässt sich auf den Homescreen legen. Ein Mac oder App Store ist nicht nötig.

**Phase 1** funktioniert ganz ohne Schulsysteme, alle Daten bleiben lokal auf dem Gerät. Optional holt die **Schulanbindung** Stundenplan, Ausfälle, Hausaufgaben und Prüfungen aus WebUntis sowie Aufgaben aus itslearning. Einrichtung: [worker/README.md](worker/README.md).

- **Heute:** Briefing mit Vorlese-Button, Stundenplan, Ranzen-Check, fällige Hausaufgaben, nahende Termine, Tages- und Wochenziel
- **Aufgaben:** Hausaufgaben eintragen und abhaken
- **Termine:** eigener Schulkalender für Klassenarbeiten, Tests und Abgaben mit Countdown
- **Plan:** Wochen-Stundenplan, Fächer mit Farben und den Sachen für den Ranzen
- **Ich:** XP, Level, Serie mit Joker, Roboter-Avatar mit freischaltbaren Teilen, Ferien, Datensicherung

## XP-Regeln

| Aktion | XP |
| --- | --- |
| Ranzen-Check erledigt | +5 |
| Briefing gelesen oder gehört | +5 |
| Hausaufgabe erledigt | +10 |
| … pünktlich | +5 |
| … selbst eingetragen | +5 |
| Tagesziel (Ranzen gepackt und alles bis zum nächsten Schultag erledigt) | +20 |
| Wochenziel (Tagesziel an 4 Tagen einer Woche) | +50 |

Die Serie zählt Schultage mit Aktivität. Wochenenden und eingetragene Ferien unterbrechen sie nicht, ein verpasster Tag pro Woche wird vom Joker gerettet. Ab 5 Tagen gibt es ×1,2 auf alle XP. Es gibt keine Abzüge.

## Installation auf dem iPad

1. Die Seite in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. Ab jetzt die App über das Symbol starten. Nur so bleiben die Daten dauerhaft gespeichert.

## Technik

Reines HTML, CSS und JavaScript ohne Build-Schritt, veröffentlicht über GitHub Pages. `sw.js` macht die App offline nutzbar; nach Änderungen dort `VERSION` erhöhen.

Das Konzept steht im Projekt-Dokument „Lernbegleiter – Konzept“.
