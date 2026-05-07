# ET KÖNIG GmbH Angebots-App – Projektinstruktionen

## Sprache
SPRACHE: Alle Kommunikation mit dem User (Erklärungen, Zusammenfassungen, Rückfragen) erfolgt auf Deutsch. Code-Kommentare können auf Englisch bleiben.

## Projektübersicht
KI-gestützte Angebots-App für ET KÖNIG GmbH Kein vollständiges Angebotssystem – ein intelligentes Kalkulations-Vorbereitungstool für die Hero Handwerkersoftware.

## Tech-Stack
- **Frontend:** React 18 + Vite (PWA)
- **Styling:** Tailwind CSS v3
- **Backend:** Supabase (Auth + PostgreSQL + Storage)
- **KI:** Claude API (claude-sonnet-4-20250514)
- **Speech-to-Text:** OpenAI Whisper (via Supabase Edge Function)
- **Hosting:** Vercel (Frontend) + Supabase (Backend)

## Branding
- Primärfarbe: #f68714 (ET KÖNIG Orange)
- Sekundär: #1f2937 (Anthrazit), #f5f5f5 (Hellgrau)
- Logo: ET KÖNIG GmbH (orange/schwarz, Logo-Datei: /public/logo-etk.png)

## Umgebungsvariablen (.env)
```
VITE_SUPABASE_URL=https://qwpjhxkcgovvpkpzqyta.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Supabase Tabellen
Siehe `supabase/complete_setup.sql` für die vollständige Datenbankstruktur (12 Tabellen + RLS + Storage + Auth-Trigger).

## 3 Funktionsmodi

### Modus 1: Variable Position
- Spracheingabe → Claude API + Preisliste
- Falls Position in Preisliste: übernehmen
- Falls nicht: neu kalkulieren (Material + 30% Aufschlag + Lohnkosten)
- Ausgabe: einzelne Position mit allen Pflichtfeldern

### Modus 2: Kleines Angebot
- Eine Sprachansage → vollständiges Angebot
- Pflicht-Gewerke: Gemeinkosten (Anfang), Abdeckarbeiten (nach Gemeinkosten), Reinigung (Ende)

### Modus 3: Großes Angebot
- Mehrere Sprachansagen → je ein Gewerk-Block
- Blöcke zusammenfügen mit Gesamtberechnung
- Gewerke-Reihenfolge IMMER wie Preisliste

## Pflichtfelder pro Position
1. Positionsnummer
2. Kurztext
3. Langtext (fließender Satz)
4. Menge
5. Einheit
6. Einzelpreis (€ netto)
7. Gesamtpreis (€ netto)
8. Materialanteil (€ + %)
9. Zeit pro Einheit (Minuten)
10. Stundensatz (€/h)
11. Lohnkosten (€)

## Stundensätze (€/h netto)
| Gewerk | Satz |
|--------|------|
| Techniker/Bauleiter | 112 |
| Designplanung | 135 |
| Entrümpelung | 50 |
| Abbruch | 60 |
| Bautischler | 82 |
| Glaser | 82 |
| Elektriker | 85 |
| Elektriker+Helfer | 150 |
| Installateur | 85 |
| Installateur+Helfer | 150 |
| Baumeister | 70 |
| Trockenbau | 70 |
| Maler | 65 |
| Anstreicher | 65 |
| Fliesenleger | 70 |
| Bodenleger/Parkett | 82 |
| Reinigung | 55 |
| Fassade | 75 |
| Allgemeine Kalkulation | 70 |
| Fahrer mit LKW | 150 |

## Berechnungslogik
- Positionsgesamt = Menge × Einzelpreis (netto)
- Gewerk-Zwischensumme = Summe aller Positionen im Gewerk
- Netto = Summe aller Gewerke
- MwSt = 20% auf Netto
- Brutto = Netto + MwSt
- Alle Werte manuell anpassbar

## Copy-to-Clipboard
- Jedes Feld einzeln per Klick kopierbar
- Preise als reine Zahl (z.B. "196.00")
- Visuelles Feedback: Toast "Kopiert!"

## Benutzerrollen
- **Admin (Christoph):** Alles – Angebote, Preisliste, Prompts, User
- **Bauleiter:** Angebote erstellen und eigene bearbeiten

## Entwicklungshinweise
- Alle Komponenten sollen auch ohne Backend-Keys funktionieren (Mock-Daten)
- Touch-optimiertes UI für Baustellen-Bedienung
- Mikrofon-Button als zentrales UI-Element (groß, pulsierend während Aufnahme)
- Speech-to-Text: OpenAI Whisper via Supabase Edge Function (whisper-proxy)
- E-Mail-Versand: Über Vercel Proxy `/api/send-email` → Make.com Webhook

## Deployment
DEPLOYMENT: Nach JEDER Code-Änderung IMMER diese Schritte ausführen:
1. npm run build (Build prüfen)
2. git add -A
3. git commit -m 'Beschreibung'
4. git push origin master
Niemals Code ändern ohne danach zu committen und pushen.
