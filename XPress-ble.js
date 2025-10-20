// UUIDs from Python description
const XPRESS_SERVICE_UUID = '331a36f5-2459-45ea-9d95-6142f0c4b307';
const XPRESS_TX_CHARACTERISTIC_UUID = 'a73e9a10-628f-4494-a099-12efaf72258f';
const XPRESS_RX_CHARACTERISTIC_UUID = 'a9da6040-0823-4995-94ec-9ce41ca28833';
const XPRESS_MODE_CHARACTERISTIC_UUID = '75a9f022-af03-4e41-b4bc-9de90a47d50b';

// Global variables for Bluetooth objects
let device;
let xpressService;
let txCharacteristic;
let rxCharacteristic;
let periodicQueryInterval = null;
let modeCharacteristic;

// --- Bluetooth Functions ---
async function connectDevice() {
    if (!navigator.bluetooth) {
        log('Web Bluetooth non supportato in questo browser.', 'info');
        alert('Spiacente, il tuo browser non supporta Web Bluetooth. Prova Chrome.');
        return;
    }

    try {
        log('Richiesta selezione dispositivo Bluetooth...');
        device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [XPRESS_SERVICE_UUID] }],
            // optionalServices: [ // Add any other services if needed
            //     'generic_access',
            // ]
        });
        log(`Dispositivo selezionato: ${device.name || 'Nome Sconosciuto'} (ID: ${device.id})`);

        device.addEventListener('gattserverdisconnected', onDisconnected);

        log('Connessione al server GATT...');
        const server = await device.gatt.connect();
        log('Connesso al server GATT.');

        log('Ottenimento del servizio Xpress...');
        xpressService = await server.getPrimaryService(XPRESS_SERVICE_UUID);
        log('Servizio Xpress trovato.');

        log('Ottenimento delle caratteristiche...');
        txCharacteristic = await xpressService.getCharacteristic(XPRESS_TX_CHARACTERISTIC_UUID);
        rxCharacteristic = await xpressService.getCharacteristic(XPRESS_RX_CHARACTERISTIC_UUID);
        modeCharacteristic = await xpressService.getCharacteristic(XPRESS_MODE_CHARACTERISTIC_UUID);

        // --- Gestione del pairing/bonding ---
        // Alcuni dispositivi richiedono che il pairing sia completato
        // prima di poter accedere a determinate caratteristiche protette.
        // Ecco come possiamo forzare il pairing se necessario.
        // Esempio di caratteristica protetta che richiede pairing ... tentiamo di forzare il pairing
        const protectedCharacteristic = modeCharacteristic; // Sostituisci con la caratteristica effettivamente protetta
        try {
            // 2.b. Tenta di leggere la caratteristica protetta
            // Questo FORZA la richiesta di sicurezza
            await protectedCharacteristic.readValue();

            // Se la lettura riesce, significa che il pairing (e l'eventuale bonding)
            // sono stati completati con successo dal sistema operativo.
            log('Pairing riuscito, caratteristica letta.', 'info');

        } catch (error) {
            // Se la lettura fallisce (ad es. per Insufficient Authentication)
            // e lo stack Bluetooth del sistema operativo è ben implementato,
            // la procedura di pairing/dialogo utente si avvierà qui.
            log('Errore durante l\'accesso alla caratteristica protetta. Potrebbe essere avviato il pairing.', 'info');
            // A questo punto, il sistema operativo dovrebbe mostrare il popup di pairing.
            // La tua app si ricollegherà o riproverà l'accesso una volta completato.
        }

        // log('Caratteristiche ottenute: TX, RX, MODE.');
        log('Caratteristiche ottenute: TX, RX, MODE.');

        // Setup notifications for TX and MODE
        if (txCharacteristic.properties.notify || txCharacteristic.properties.indicate) {
            txCharacteristic.addEventListener('characteristicvaluechanged', (event) => handleCharacteristicValueChange(event, txValueDisplay));
            await txCharacteristic.startNotifications();
            log('Notifiche per XPRESS_TX avviate.');
        } else {
            log('XPRESS_TX non supporta notifiche o indicazioni.');
        }
        /*               
        if (modeCharacteristic.properties.notify || modeCharacteristic.properties.indicate) {
            modeCharacteristic.addEventListener('characteristicvaluechanged', (event) => handleCharacteristicValueChange(event, modeValueDisplay));
            await modeCharacteristic.startNotifications();
            log('Notifiche per XPRESS_MODE avviate.');
            // Read initial value of MODE
            // await readMode();
            await readCharacteristic(modeCharacteristic, modeValueDisplay);
        } else {
            log('XPRESS_MODE non supporta notifiche o indicazioni.');
        }
        */                
        updateConnectionStatus(true);
        log('Connessione e configurazione completate con successo!');

    } catch (error) {
        log(`Errore di connessione: ${error.name}: ${error.message}`, 'info');
        updateConnectionStatus(false);
    }
}

function onDisconnected(event) {
    const disconnectedDevice = event.target;
    log(`Dispositivo ${disconnectedDevice.name || disconnectedDevice.id} disconnesso.`, 'info');
    updateConnectionStatus(false);
    // Clean up characteristic references
    txCharacteristic = null;
    rxCharacteristic = null;
    // modeCharacteristic = null;
    xpressService = null;
    device = null;
}

async function disconnectDevice() {
    if (device && device.gatt.connected) {
        log('Disconnessione dal dispositivo...');
        device.gatt.disconnect();
        // onDisconnected will handle UI updates
    } else {
        log('Nessun dispositivo connesso.', 'info');
        updateConnectionStatus(false);
    }
}

function parseHexString(hexStr) {
    // Rimuovi spazi e converti in maiuscolo
    const cleanStr = hexStr.trim().toUpperCase();
    
    // Splitta sui trattini e filtra elementi vuoti
    const hexBytes = cleanStr.split('-').filter(hex => hex.length > 0);
    
    // Converti ogni byte esadecimale in numero
    const bytes = hexBytes.map(hex => {
        const value = parseInt(hex, 16);
        if (isNaN(value) || value < 0 || value > 255) {
            throw new Error(`Valore esadecimale non valido: ${hex}`);
        }
        return value;
    });
    
    return new Uint8Array(bytes);
}

async function writeToCharacteristic(characteristic, inputElement) {
    if (!characteristic) {
        log('Caratteristica non disponibile. Connettiti prima.', 'info');
        return;
    }
    const value = inputElement.value;
    if (!value) {
        log('Il campo di input è vuoto. Inserisci un valore.', 'info');
        return;
    }

    try {
        // const encoder = new TextEncoder(); // UTF-8 encoder
        // const data = encoder.encode(value);
        const data = parseHexString(value)  
        await characteristic.writeValue(data);
        if (query_periodica == false) {
            log(`Scritto "${value}" su ${characteristic.uuid}.`);
        }
        // inputElement.value = ''; // Clear input after sending
    } catch (error) {
        log(`Errore durante la scrittura su ${characteristic.uuid}: ${error.message}`, 'info');
    }
}

// async function readCharacteristic(characteristic, displayElement) {
//     if (!characteristic) {
//         log('Caratteristica non disponibile. Connettiti prima.', 'info');
//         return;
//     }
//     try {
//         const value = await characteristic.readValue();
//         const receivedData = new Uint8Array(value.buffer);
//         const decodedData = new TextDecoder().decode(receivedData);
//         displayElement.textContent = `0x${Array.from(receivedData).map(b => b.toString(16).padStart(2, '0')).join('')}`;
//         log(`Letto da ${characteristic.uuid}: "${decodedData}" (Raw: ${receivedData}).`);
//     } catch (error) {
//         log(`Errore durante la lettura da ${characteristic.uuid}: ${error.message}`, 'info');
//     }
// }


