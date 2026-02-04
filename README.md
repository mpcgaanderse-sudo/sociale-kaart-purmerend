# Sociale Kaart Purmerend - Huisartsenpraktijk De Gors

Een webapplicatie voor het team van Huisartsenpraktijk De Gors om zorgverleners in de regio Purmerend te beheren, doorzoeken en van opmerkingen te voorzien.

## Setup

### Stap 1: Firebase project aanmaken

1. Ga naar [Firebase Console](https://console.firebase.google.com/)
2. Klik **Project toevoegen**
3. Geef het project een naam (bijv. "sociale-kaart-purmerend")
4. Google Analytics mag je uitschakelen (niet nodig)
5. Klik **Project aanmaken**

### Stap 2: Web-app toevoegen

1. Klik in je Firebase project op het **web-icoon** (`</>`) om een web-app toe te voegen
2. Geef het een naam (bijv. "Sociale Kaart")
3. Firebase Hosting hoef je **niet** aan te vinken (we gebruiken GitHub Pages)
4. Klik **App registreren**
5. Je krijgt nu een configuratieblok te zien. Kopieer de waarden.

### Stap 3: Firestore database aanmaken

1. Ga in de Firebase Console naar **Firestore Database** (linker menu)
2. Klik **Database aanmaken**
3. Kies **Start in production mode**
4. Kies een locatie (bijv. `europe-west1` voor Nederland)
5. Klik **Inschakelen**

### Stap 4: Firestore beveiligingsregels instellen

Ga naar **Firestore Database > Regels** en vervang de regels door:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /zorgverleners/{document=**} {
      allow read, write: if true;
    }
  }
}
```

> **Let op:** Deze regels staan iedereen toe om te lezen en schrijven. De app heeft een client-side wachtwoordbeveiliging, maar de database zelf is niet afgeschermd. Dit is voldoende voor intern gebruik maar niet geschikt voor gevoelige gegevens.

### Stap 5: Configuratie invullen

Open `firebase-config.js` en vul je Firebase configuratie in:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "jouw-project.firebaseapp.com",
    projectId: "jouw-project",
    storageBucket: "jouw-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

### Stap 6: Wachtwoord instellen

1. Kies een wachtwoord voor het team
2. Open je browser console (F12 > Console) en voer uit:

```javascript
crypto.subtle.digest('SHA-256', new TextEncoder().encode('jouw-wachtwoord'))
  .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join(''))
  .then(console.log)
```

3. Kopieer de hash die verschijnt
4. Plak deze in `firebase-config.js` bij `PASSWORD_HASH`

### Stap 7: Deployen naar GitHub Pages

1. Maak een GitHub repository aan
2. Push alle bestanden naar de repository
3. Ga naar **Settings > Pages**
4. Kies bij Source: **Deploy from a branch**
5. Kies de **main** branch en klik **Save**
6. Je site is na een paar minuten beschikbaar op `https://jouw-gebruikersnaam.github.io/jouw-repo/`

## Gebruik

- **Zoeken**: Typ in de zoekbalk om te zoeken op naam, specialisatie, label of opmerking
- **Filteren**: Klik op een categorie-chip om te filteren
- **Toevoegen**: Klik op de **+ Toevoegen** knop
- **Details bekijken**: Klik op een kaartje
- **Opmerkingen**: Open een kaartje en plaats een opmerking onderaan
- **Labels**: Voeg labels toe bij het aanmaken/bewerken (druk Enter per label)

## Bestanden

| Bestand | Beschrijving |
|---------|-------------|
| `index.html` | Hoofdpagina met alle HTML |
| `style.css` | Styling |
| `app.js` | Applicatielogica |
| `firebase-config.js` | Firebase configuratie (niet committen met echte keys!) |
