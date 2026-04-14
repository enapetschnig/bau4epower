# BAU4YOU Angebots-App – Projektinstruktionen

## Sprache
SPRACHE: Alle Kommunikation mit dem User (Erklärungen, Zusammenfassungen, Rückfragen) erfolgt auf Deutsch. Code-Kommentare können auf Englisch bleiben.

## Projektübersicht
KI-gestützte Angebots-App für BAU4YOU Baranowski Bau GmbH. Kein vollständiges Angebotssystem – ein intelligentes Kalkulations-Vorbereitungstool für die Hero Handwerkersoftware.

## Tech-Stack
- **Frontend:** React 18 + Vite (PWA)
- **Styling:** Tailwind CSS v3
- **Backend:** Supabase (Auth + PostgreSQL + Storage)
- **KI:** Claude API (claude-sonnet-4-20250514)
- **Speech-to-Text:** Web Speech API (de-AT)
- **Hosting:** Vercel (Frontend) + Supabase (Backend)

## Branding
- Primärfarbe: #c0392b (BAU4YOU Rot)
- Sekundär: #2c3e50 (Dunkelgrau), #f5f6f8 (Hellgrau)
- Logo: Rotes Haus mit weißer "4", graue Schrift "BAU YOU", darunter "Baranowski Bau GmbH"

## Umgebungsvariablen (.env)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Supabase Tabellen
```sql
-- users
create table users (
  id uuid references auth.users primary key,
  email text unique not null,
  name text,
  role text check (role in ('admin', 'bauleiter')) default 'bauleiter',
  created_at timestamptz default now()
);

-- offers
create table offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  betreff text,
  ursache text,
  gewerke_json jsonb,
  gesamtsumme numeric,
  status text default 'draft',
  created_at timestamptz default now()
);

-- catalog
create table catalog (
  id uuid primary key default gen_random_uuid(),
  data_json jsonb not null,
  uploaded_at timestamptz default now(),
  uploaded_by uuid references users(id)
);

-- prompts
create table prompts (
  id uuid primary key default gen_random_uuid(),
  type integer check (type in (1, 2)),
  active_version integer default 1,
  created_at timestamptz default now()
);

-- prompt_versions
create table prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references prompts(id),
  version_number integer,
  text text,
  created_at timestamptz default now()
);
```

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
- **Admin (Lukasz):** Alles – Angebote, Preisliste, Prompts, User
- **Bauleiter:** Angebote erstellen und eigene bearbeiten

## Entwicklungshinweise
- Alle Komponenten sollen auch ohne Backend-Keys funktionieren (Mock-Daten)
- Touch-optimiertes UI für Baustellen-Bedienung
- Mikrofon-Button als zentrales UI-Element (groß, pulsierend während Aufnahme)
- Speech API: de-AT

## Deployment
DEPLOYMENT: Nach JEDER Code-Änderung IMMER diese Schritte ausführen:
1. npm run build (Build prüfen)
2. git add -A
3. git commit -m 'Beschreibung'
4. git push origin master
Niemals Code ändern ohne danach zu committen und pushen.
