// =============================================================
// FIREBASE CONFIGURATIE
// =============================================================
// Volg de stappen in de README om je eigen Firebase project
// aan te maken en vul hieronder je configuratie in.
// =============================================================

const firebaseConfig = {
    apiKey: "AIzaSyAcBaxmbXjxDVDvV_Ub_fakve8qDmmu8CE",
  authDomain: "sociale-kaart-purmerend.firebaseapp.com",
  projectId: "sociale-kaart-purmerend",
  storageBucket: "sociale-kaart-purmerend.firebasestorage.app",
  messagingSenderId: "956741659381",
  appId: "1:956741659381:web:cb8fc84d03a829275eb3bc"
};

// Wachtwoord-hash voor toegang (SHA-256 hash van het gekozen wachtwoord)
// Genereer een hash via de browser console:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('jouw-wachtwoord'))
//     .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join(''))
//     .then(console.log)
//
// Of gebruik een online SHA-256 generator en plak de hash hieronder.
const PASSWORD_HASH = "a18f1fbb2da7e7473bea92df578894d22f9b96b1cb0dd949327e27fd9429c9fc";

