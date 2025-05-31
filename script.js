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
    
    // Debug del pulsante
    console.log("Pulsante PARLA:", talkButton);
    console.log("Classes del pulsante:", talkButton.className);
    console.log("Disabled?", talkButton.disabled);
    console.log("Style:", talkButton.style.cssText);
    
    // Prova con addEventListener invece di onclick
    talkButton.addEventListener('click', function(e) {
        console.log("===== CLICK EVENT LISTENER =====");
        console.log("Event:", e);
        alert("CLICK DA addEventListener!");
    });
    
    // Prova anche con onclick
    talkButton.onclick = function(e) {
        console.log("===== CLICK ONCLICK =====");
        console.log("Event:", e);
        alert("CLICK DA onclick!");
    };
    
    // Test click immediato su tutto il documento
    document.addEventListener('click', function(e) {
        console.log("===== CLICK NEL DOCUMENTO =====");
        console.log("Target:", e.target);
        console.log("Target ID:", e.target.id);
        console.log("Target class:", e.target.className);
        
        // Se è il pulsante o un suo figlio
        if (e.target.id === 'talkButton' || e.target.closest('#talkButton')) {
            console.log("!!! CLICK SUL PULSANTE RILEVATO DAL DOCUMENT !!!");
            alert("CLICK RILEVATO DAL DOCUMENT!");
        }
    });
    
    // Aggiungi un pulsante di test semplice
    const testBtn = document.createElement('button');
    testBtn.textContent = "TEST BUTTON";
    testBtn.style.cssText = "position: fixed; top: 10px; left: 10px; z-index: 9999; background: red; color: white; padding: 10px;";
    testBtn.onclick = function() {
        alert("TEST BUTTON FUNZIONA!");
    };
    document.body.appendChild(testBtn);
    
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