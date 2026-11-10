# Bonnies Tabata 💗

Personlig intervall-/Tabata-timer som progressiv webbapp (PWA) för iPhone och iPad.
Ren HTML/CSS/JS utan byggsteg – allt i repot serveras som det är.

## Installera på iPhone/iPad
1. Öppna appens adress i **Safari**.
2. Tryck på **Dela** → **Lägg till på hemskärmen**.
3. Starta från ikonen – appen körs i helskärm och fungerar offline.

## Köra lokalt
```sh
npm start        # http://localhost:8080
npm test         # enhetstester för timer-motorn
```

## Struktur
| Fil | Ansvar |
| --- | --- |
| `js/timer.js` | Schema + tidsbaserad klocka (exakt även efter låst skärm) |
| `js/sounds.js` | Syntetiserade ljudsignaler via Web Audio |
| `js/store.js` | Sparade pass och inställningar (localStorage) |
| `js/app.js` | Skärmar och routing (`#/`, `#/workouts`, `#/new`, `#/edit/:id`, `#/run/:id`, `#/settings`) |
| `sw.js` | Offline-cache. **Höj `VERSION` vid varje release.** |

## Status v0.1
Klart: timer (arbete/vila/rundor/set/nedräkning), start/paus/fortsätt/starta om/avsluta/hoppa,
sparade pass (skapa, namnge, redigera, radera, starta), ljudval med förhandslyssning,
färginställningar, skärmlås-skydd (Wake Lock), iPhone/iPad stående och liggande.

Inte med än: inbyggd Spotify-styrning (se nedan).

## Kända begränsningar på iOS
- **Låst skärm:** iOS pausar webbappar när skärmen låses. Tiden räknas rätt när du låser upp, men signaler under låst skärm uteblir. Appen håller därför skärmen tänd under passet.
- **Ljudlös-knappen:** med "Sänk musiken vid signal" avstängt mixas signalerna in i musiken och tystas av ljudlös-läget.
- **Spotify:** Spotifys Web Playback SDK fungerar inte i mobil Safari. Styrning måste gå via Spotify Web API (OAuth + Premium + registrerad Spotify-app) och styr då Spotify-appen på telefonen.
