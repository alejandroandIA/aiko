// AIKO TEST SCRIPT - VERSIONE MINIMA
console.log("===== AIKO TEST SCRIPT CARICATO =====");

// Test immediato
document.addEventListener('DOMContentLoaded', function() {
    console.log("===== DOM PRONTO =====");
    
    // Cerca il pulsante
    const talkButton = document.getElementById('talkButton');
    const endButton = document.getElementById('endButton');
    const statusDiv = document.getElementById('status');
    
    console.log("Elementi trovati:", {
        talkButton: talkButton ? "SI" : "NO",
        endButton: endButton ? "SI" : "NO", 
        statusDiv: statusDiv ? "SI" : "NO"
    });
    
    if (!talkButton) {
        alert("ERRORE CRITICO: Pulsante PARLA non trovato!");
        return;
    }
    
    // Click handler semplice
    talkButton.onclick = function() {
        console.log("===== CLICK SU PARLA =====");
        alert("Click registrato! Ora testo le API...");
        
        // Disabilita pulsanti
        talkButton.disabled = true;
        endButton.disabled = false;
        statusDiv.textContent = "Test API in corso...";
        
        // Test API
        testAPIs();
    };
    
    endButton.onclick = function() {
        console.log("===== CLICK SU CHIUDI =====");
        talkButton.disabled = false;
        endButton.disabled = true;
        statusDiv.textContent = "";
    };
    
    console.log("===== EVENT LISTENERS AGGIUNTI =====");
});

// Test delle API
async function testAPIs() {
    const statusDiv = document.getElementById('status');
    
    try {
        // Test 1: Context Summary
        statusDiv.textContent = "Test generateContextSummary...";
        console.log("Test API 1: generateContextSummary");
        
        const resp1 = await fetch('/api/generateContextSummary');
        console.log("Response status:", resp1.status);
        
        if (resp1.ok) {
            const data1 = await resp1.json();
            console.log("Context data:", data1);
            alert("✅ API generateContextSummary funziona!");
        } else {
            const error1 = await resp1.text();
            console.error("Errore:", error1);
            alert("❌ Errore generateContextSummary: " + resp1.status);
            return;
        }
        
        // Test 2: Session
        statusDiv.textContent = "Test session API...";
        console.log("Test API 2: session");
        
        const resp2 = await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contextSummary: "Test context" })
        });
        console.log("Response status:", resp2.status);
        
        if (resp2.ok) {
            const data2 = await resp2.json();
            console.log("Session data:", data2);
            if (data2.client_secret) {
                alert("✅ API session funziona! Token ricevuto!");
                statusDiv.textContent = "API funzionanti! Pronto per implementazione completa.";
            } else {
                alert("⚠️ API session risponde ma nessun token");
            }
        } else {
            const error2 = await resp2.text();
            console.error("Errore:", error2);
            alert("❌ Errore session: " + resp2.status + "\n" + error2);
        }
        
    } catch (error) {
        console.error("ERRORE CRITICO:", error);
        alert("💥 ERRORE CRITICO: " + error.message);
        statusDiv.textContent = "Errore critico: " + error.message;
    }
}

console.log("===== SCRIPT COMPLETATO ====="); 