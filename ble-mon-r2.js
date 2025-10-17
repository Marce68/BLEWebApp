// UI Elements
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const writeRxButton = document.getElementById('writeRxButton');
const queryForm = document.getElementById('QueryForm');
const radioGetVersion = document.getElementById('radioGetVersion');
const radioGetInfoBoardSN = document.getElementById('radioGetInfoBoardSN');
const radioGetInfoMachineSN = document.getElementById('radioGetInfoMachineSN');
const radioGetInfoBLEName = document.getElementById('radioGetInfoBLEName');
const radioGetInfoParamVersion = document.getElementById('radioGetInfoParamVersion');
const radioGetStatus = document.getElementById('radioGetStatus');
const chekboxPeriodicQuery = document.getElementById('chekboxPeriodicQuery');
// const readModeButton = document.getElementById('readModeButton');
// const writeModeButton = document.getElementById('writeModeButton');
const fwFileInput = document.getElementById('fileInput');
let rxInput = document.getElementById('rxInput');
// const modeInput = document.getElementById('modeInput');
const txValueDisplay = document.getElementById('txValue');
// const modeValueDisplay = document.getElementById('modeValue');
const connectionStatusDisplay = document.getElementById('connectionStatus');
const logDiv = document.getElementById('log');

let query_periodica = false;
let query_infoID = '';
let ack_received = false;
let fw_dowloading = false;

// --- Helper Functions ---
function log(message, type = 'info') {
    if (type == 'info') {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        logDiv.innerHTML += `<p><strong>[${timeString}]</strong> ${message}</p>`;
        logDiv.scrollTop = logDiv.scrollHeight; // Scroll to bottom
    } else if (type == 'monitor') {
        // logDiv.innerHTML += `<p>${message}</p>`;
        logDiv.innerHTML += `${message}\r\n`;
        logDiv.scrollTop = logDiv.scrollHeight; // Scroll to bottom
    }
    console.log(message);
}

function scaricaLog() {
    // 1. Ottieni l'elemento HTML del log
    const logDiv = document.getElementById('log'); // Assicurati che l'ID sia corretto!
    
    if (!logDiv) {
        log("Elemento log-area non trovato!", 'info');
        return;
    }

    // 2. Estrai il contenuto testuale
    // Ottenere innerText è meglio di innerHTML per estrarre solo il testo visibile
    let contenutoLog = logDiv.innerText;

    // 3. Crea un oggetto Blob con il contenuto testuale
    // 'text/plain' è il MIME type per i file di testo
    const blob = new Blob([contenutoLog], { type: 'text/plain' });

    // 4. Crea un URL per il Blob
    const url = URL.createObjectURL(blob);

    // 5. Crea un elemento link (virtuale) per innescare il download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'log_data_' + new Date().toISOString().slice(0, 10) + '.txt'; // Nome del file
    
    // 6. Simula il click sul link per avviare il download
    document.body.appendChild(a); // Aggiungi il link al DOM (necessario per Firefox)
    a.click();
    
    // 7. Pulisci: rimuovi il link e revoca l'URL del Blob
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    log("Log scaricato con successo!", 'info');
}

function updateConnectionStatus(isConnected) {
    if (isConnected) {
        connectionStatusDisplay.textContent = 'Connesso';
        connectionStatusDisplay.className = 'status connected';
        connectButton.disabled = true;
        disconnectButton.disabled = false;
        writeRxButton.disabled = false;
        // readModeButton.disabled = false;
        // writeModeButton.disabled = false;
        document.getElementById('fieldsetQuery').disabled = false;
    } else {
        connectionStatusDisplay.textContent = 'Disconnesso';
        connectionStatusDisplay.className = 'status disconnected';
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        writeRxButton.disabled = true;
        txValueDisplay.textContent = 'Response raw data...';
        // readModeButton.disabled = true;
        // writeModeButton.disabled = true;
        // modeValueDisplay.textContent = 'N/D';
        document.getElementById('fieldsetQuery').disabled = true;
    }
}

function clearDataFields() {
    const fields = [
        'systemState', 'cycleTimeDuration', 'cycleTimeElapsed', 'temperatureProbe',
        'environmentTemp', 'motorCurrent', 'peltierVoltage', 'motorVoltage',
        'motorFilteredCurrent', 'motorDutyCycle', 'motorRealVoltage', 'motorSpeed',
        'motorSwitchPosition', 'scannerConnected', 'flavourCode', 'option'
    ];
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = '';
        }
    });
}

/**
 * Converte due byte consecutivi da un ArrayBuffer o TypedArray in un intero a 16 bit.
 * @param {Uint8Array} dataArray - Il TypedArray contenente i dati.
 * @param {number} offset - La posizione (indice) del primo byte da leggere (il byte più significativo se big-endian, o meno significativo se little-endian).
 * @param {boolean} isLittleEndian - Se TRUE, usa l'ordine little-endian. Altrimenti, usa big-endian.
 * @returns {number} L'intero a 16 bit convertito.
 */
function bytesToSInt(dataArray, offset, size, isLittleEndian = true) {
    let shortInt;
    // 1. Assicurati di avere un ArrayBuffer (necessario per DataView)
    // Se dataArray è un Uint8Array, .buffer e .byteOffset sono i suoi riferimenti.
    const buffer = dataArray.buffer;
    const arrayOffset = dataArray.byteOffset + offset; // L'offset nell'ArrayBuffer completo

    // 2. Crea un DataView per leggere i dati binari
    const dataView = new DataView(buffer, arrayOffset, size); // Leggi size byte

    // 3. Usa getInt8/16/32 per leggere l'intero con segno a 16 bit
    // L'ultimo argomento specifica l'endianness.
    if (size == 1) {
        shortInt = dataView.getInt8(0);
    } else if (size == 2)  {
        shortInt = dataView.getInt16(0, isLittleEndian);
    } else if (size == 4)  {
        shortInt = dataView.getInt32(0, isLittleEndian);
    }
    else {
        log(`bytesToSInt: size non valido (${size}). Deve essere 1, 2 o 4.`);
        return null;
    }
    return shortInt;
}

function updateStatusDataFields(dataArray) {
    const systemState = document.getElementById('systemState');
    const cycleTimeDuration = document.getElementById('cycleTimeDuration');
    const cycleTimeElapsed = document.getElementById('cycleTimeElapsed');
    const temperatureProbe = document.getElementById('temperatureProbe');
    const environmentTemp = document.getElementById('environmentTemp');
    const motorCurrent = document.getElementById('motorCurrent');
    const peltierVoltage = document.getElementById('peltierVoltage');
    const motorVoltage = document.getElementById('motorVoltage');
    const motorFilteredCurrent = document.getElementById('motorFilteredCurrent');
    const motorDutyCycle = document.getElementById('motorDutyCycle');
    const motorRealVoltage = document.getElementById('motorRealVoltage');
    const motorSpeed = document.getElementById('motorSpeed');
    const motorSwitchPosition = document.getElementById('motorSwitchPosition');
    const scannerConnected = document.getElementById('scannerConnected');
    const flavourCode = document.getElementById('flavourCode');
    const option = document.getElementById('option');           
    let strStatusMonitor = '';

    if (dataArray[5] == 0x00 && dataArray[6] >= 0x22) { // 0x0022 == 34 <= data length <= 37 == 0x0025 bytes, false = Big-endian
        // log('Dati ricevuti corrispondono al formato atteso per la versione (byte 5-6 == 0x0025)');
        systemState.value = bytesToSInt(dataArray, 7, 1); // offset 0x00
        strStatusMonitor += systemState.value;
        strStatusMonitor += ';';
        cycleTimeDuration.value = bytesToSInt(dataArray, 8, 4, false)/10;
        strStatusMonitor += cycleTimeDuration.value;
        strStatusMonitor += ';';
        cycleTimeElapsed.value = bytesToSInt(dataArray, 12, 4, false)/10;
        strStatusMonitor += cycleTimeElapsed.value;
        strStatusMonitor += ';';
        temperatureProbe.value = bytesToSInt(dataArray, 16, 2, false)/10;
        strStatusMonitor += temperatureProbe.value;
        strStatusMonitor += ';';
        environmentTemp.value = bytesToSInt(dataArray, 18, 2, false)/10;
        strStatusMonitor += environmentTemp.value;
        strStatusMonitor += ';';
        motorCurrent.value = bytesToSInt(dataArray, 20, 2, false);
        strStatusMonitor += motorCurrent.value;
        strStatusMonitor += ';';
        peltierVoltage.value = bytesToSInt(dataArray, 22, 2, false);
        strStatusMonitor += peltierVoltage.value;
        strStatusMonitor += ';';
        motorVoltage.value = bytesToSInt(dataArray, 24, 2, false);
        strStatusMonitor += motorVoltage.value;
        strStatusMonitor += ';';
        motorFilteredCurrent.value = bytesToSInt(dataArray, 26, 2, false);
        strStatusMonitor += motorFilteredCurrent.value;
        strStatusMonitor += ';';
        motorDutyCycle.value = bytesToSInt(dataArray, 28, 1);
        strStatusMonitor += motorDutyCycle.value;
        strStatusMonitor += ';';
        motorRealVoltage.value = bytesToSInt(dataArray, 29, 2, false);
        strStatusMonitor += motorRealVoltage.value;
        strStatusMonitor += ';';
        motorSpeed.value = bytesToSInt(dataArray, 31, 2, false);
        strStatusMonitor += motorSpeed.value;
        strStatusMonitor += ';';
        motorSwitchPosition.value = bytesToSInt(dataArray, 37, 1);
        strStatusMonitor += motorSwitchPosition.value;
        strStatusMonitor += ';';
        flavourCode.value = dataArray.slice(38, 41).map(b => String.fromCharCode(b)).join('');
        strStatusMonitor += flavourCode.value;
        strStatusMonitor += ';';
        if (dataArray.length >= 42) {
            option.value = bytesToSInt(dataArray, 41, 1);
            strStatusMonitor += option.value;
            strStatusMonitor += ';';
        }
        if (dataArray.length >= 44) {
            scannerConnected.value = bytesToSInt(dataArray, 42, 2, false);
            strStatusMonitor += scannerConnected.value;
            strStatusMonitor += ';';
        }
        if (query_periodica == true) {
            log(strStatusMonitor,'monitor')
        }
    } else {
        log('Dati ricevuti NON corrispondono al formato atteso per la versione (byte 5-6 != 0x0025)', 'info');
        return;
    }

}

function getStringFromData(dataArray, offset, length) {
    // 1. Decodifica la porzione massima in una stringa
    const decoder = new TextDecoder('ascii');
    const fullString = decoder.decode(dataArray.slice(offset, length));
    // 2. Trova e taglia la stringa al terminatore NUL
    const nullIndex = fullString.indexOf('\0');
    if (nullIndex !== -1) {
        return fullString.substring(0, nullIndex);
    } else {
        return fullString;
    }
}


function updateFWVersionDataFields(dataArray) {
    const fwVersion = document.getElementById('fwVersion');
    if (dataArray[5] == 0x00 && dataArray[6] == 0x10) { // data length 16 == 0x0010 bytes, false = Big-endian
        log('Dati ricevuti corrispondono al formato atteso per la versione (byte 5-6 == 0x0010)');
        // fwVersion.value = dataArray.slice(7, 7+16).map(b => String.fromCharCode(b)).join('');
        fwVersion.value = getStringFromData(dataArray, 7, 31);
    } else {
        log('Dati ricevuti NON corrispondono al formato atteso per la versione (byte 5-6 != 0x0010)', 'info');
        return;
    }
}

function querySetInfo (info_txt, id) {
    log(`querySetInfo: Preparing to set info ID ${id} with text "${info_txt}"`, 'info');
    const dataArray = new Uint8Array(7+ 0x21 + 2); // 7 byte header + 33 byte data + 2 byte CRC
    // Header
    dataArray[0] = 0xAA; // Start byte
    dataArray[1] = 0x01; // Master Address (central)
    dataArray[2] = 0x00; // Slave Address (peripheral)
    dataArray[3] = 0x01; // Control code
    dataArray[4] = 0x06; // Function code (Set Info)
    dataArray[5] = 0x00; // Data length LSB (33 bytes)
    dataArray[6] = 0x21; // Data length MSB
    // Data
    dataArray[7] = id; // information ID
    // Fill info_txt into dataArray starting from index 8
    if (info_txt.length > 0) {
        log(`querySetInfo: info_txt length is ${info_txt.length}`, 'info');
        if (id == 0x00) {
            const maxLength = 6;
            log(`querySetInfo: maxLength for ID 0x00 is ${maxLength}`, 'info');
        } else if (id == 0x01) {
            const maxLength = 28;
            log(`querySetInfo: maxLength for ID 0x01 is ${maxLength}`, 'info');
        } else if (id == 0x02) {
            const maxLength = 16;
            log(`querySetInfo: maxLength for ID 0x02 is ${maxLength}`, 'info');
        } else if (id == 0x03) {
            const maxLength = 8;
            log(`querySetInfo: maxLength for ID 0x03 is ${maxLength}`, 'info');
        } else {
            log('querySetInfo: id non valido', 'info');
            return null;
        }
        const encoder = new TextEncoder();
        const utf8Bytes = encoder.encode(info_txt);
        for (let i = 0; i < 32; i++) {
            if (i < utf8Bytes.length) {
                dataArray[8 + i] = utf8Bytes[i];
            } else {
                dataArray[8 + i] = 0x00;
            }
        }
        log(`raw data array`, 'info');
        log(`Data Array: 0x${Array.from(dataArray).map(b => b.toString(16).padStart(2, '0')).join('-')}`, 'info');
        // Calculate CRC
        const crc = CRC16(dataArray.slice(0, 7 + 0x21));
        // Big Endian: MSB first
        dataArray[7 + 0x21] = crc[0];   // CRC MSB
        dataArray[7 + 0x21 + 1] = crc[1]; // CRC LSB
        log(`querySetInfo: Prepared data for ID ${id} with info "${info_txt}"`, 'info');
        log(`Data Array: 0x${Array.from(dataArray).map(b => b.toString(16).padStart(2, '0')).join('-')}`, 'info');
        return Array.from(dataArray).map(b => b.toString(16).padStart(2, '0')).join('-');
    } else {
        log('querySetInfo: info_txt is empty', 'info');
        return null;
    }
}

// Funzione helper per il sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function aggiornaProgress(percentuale) {
    document.getElementById('progressBar').value = percentuale;
    document.getElementById('progressText').textContent = percentuale + '%';
}

async function queryUpdateFW (fw) {
    log('FW Update ...', 'info');

    const fw_size = fw.length;
    log(`Firmware size in bytes: ${fw_size} `, 'info');

    // Il file preparato in multipli di 128 bytes
    const x = fw_size / 128;
    const last_pkt_len = fw_size - 128 * Math.floor(x);  // con '0' padding

    // File pronto per la programmazione
    const padded_fw = new Uint8Array(fw_size + (128 - last_pkt_len));
    padded_fw.set(fw);

    let num_pkt;
    if (last_pkt_len > 0) {
        num_pkt = Math.floor(x) + 1;
    } else {
        num_pkt = Math.floor(x);
    }

    log(`Number of packets: ${num_pkt}`, 'info');
    log(`Tempo stimato: ${num_pkt * 0.1} secondi`, 'info');
    log(`File Heading: 0x${Array.from(fw.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('-')}`, 'info');
    
    // Start FW image download
    ack_received = true;
    const start_fw_image_download = new Uint8Array([0xAA, 0x01, 0x00, 0x02, 0x00, 0x00, 0x06]);
    if (ack_received === true) {
        // Converti fw_size in 4 bytes big-endian
        const fw_size_bytes = new Uint8Array([
            (fw_size >> 24) & 0xFF,
            (fw_size >> 16) & 0xFF,
            (fw_size >> 8) & 0xFF,
            fw_size & 0xFF
        ]);
        
        // Converti num_pkt in 2 bytes big-endian
        const num_pkt_bytes = new Uint8Array([
            (num_pkt >> 8) & 0xFF,
            num_pkt & 0xFF
        ]);
        
        // Concatena gli array
        let msg = new Uint8Array(start_fw_image_download.length + fw_size_bytes.length + num_pkt_bytes.length);
        msg.set(start_fw_image_download);
        msg.set(fw_size_bytes, start_fw_image_download.length);
        msg.set(num_pkt_bytes, start_fw_image_download.length + fw_size_bytes.length);
        
        // Aggiungi CRC16
        const crc = CRC16(msg);
        const msgWithCrc = new Uint8Array(msg.length + crc.length);
        msgWithCrc.set(msg);
        msgWithCrc.set(crc, msg.length);
        msg = msgWithCrc;
        
        ack_received = false;
        await rxCharacteristic.writeValue(msg).then(() => {
            log('Start FW image download command sent', 'info');
        }).catch(error => {
            log(`Error sending start FW image download command: ${error}`, 'info');
        });
    }
    await sleep(10);
    
    // FW download cycle
    fw_dowloading = true;
    let i = 0;
    const download_fw_image = new Uint8Array([0xAA, 0x01, 0x00, 0x02, 0x01, 0x00, 0x82]);

    while (i < num_pkt) {
        if (ack_received === true) {
            const data = padded_fw.slice(i * 128, (i + 1) * 128);
            
            // Converti i in 2 bytes big-endian
            const i_bytes = new Uint8Array([
                (i >> 8) & 0xFF,
                i & 0xFF
            ]);
            
            // Concatena gli array
            let msg = new Uint8Array(download_fw_image.length + i_bytes.length + data.length);
            msg.set(download_fw_image);
            msg.set(i_bytes, download_fw_image.length);
            msg.set(data, download_fw_image.length + i_bytes.length);
            
            // Aggiungi CRC16
            const crc = CRC16(msg);
            const msgWithCrc = new Uint8Array(msg.length + crc.length);
            msgWithCrc.set(msg);
            msgWithCrc.set(crc, msg.length);
            msg = msgWithCrc;
            
            ack_received = false;
            await rxCharacteristic.writeValue(msg).then(() => {
                log(`Sent fw packet number: ${i}`, 'info');
            }).catch(error => {
                log(`Error sending start FW image download command: ${error}`, 'info');
            });
            i = i + 1;
        }
        await sleep(10);
        aggiornaProgress(Math.floor((i / num_pkt) * 100));
    }
    await sleep(100);
    fw_dowloading = false;

    // FW install
    if ((ack_received == true) && (i == num_pkt)) {
        const install_fw_image = new Uint8Array([0xAA, 0x01, 0x00, 0x02, 0x02, 0x00, 0x00]);
        let msg = install_fw_image;
        
        // Aggiungi CRC16
        const crc = CRC16(msg);
        const msgWithCrc = new Uint8Array(msg.length + crc.length);
        msgWithCrc.set(msg);
        msgWithCrc.set(crc, msg.length);
        msg = msgWithCrc;
        
        ack_received = false;
        await rxCharacteristic.writeValue(msg).then(() => {
            log('Sent fw Install ... now flashing', 'info');
        }).catch(error => {
            log(`Error sending start FW image download command: ${error}`, 'info');
        });
        await sleep(500);
    } else {
        log(`Anomalia last ACK: ${ack_received}, last PKT: ${i} / ${num_pkt}`, 'info');
    }
}

function updateInfoDataFields(dataArray) {
    const boardSN = document.getElementById('boardSN');
    const machineSN = document.getElementById('machineSN');
    const bleName = document.getElementById('bleName');
    const paramVersion = document.getElementById('paramVersion');

    if (dataArray[5] == 0x00 && dataArray[6] == 0x20) { // data length 32 == 0x0020 bytes, false = Big-endian
        log('Dati ricevuti corrispondono al formato atteso per Info (byte 5-6 == 0x0020)');
        if (query_infoID == 'radioGetInfoBoardSN') { // Board SN
            boardSN.value = getStringFromData(dataArray, 7, 39);
        } else if (query_infoID == 'radioGetInfoMachineSN') { // Machine SN
            machineSN.value = getStringFromData(dataArray, 7, 39);
        } else if (query_infoID == 'radioGetInfoBLEName') { // BLE Name
            bleName.value = getStringFromData(dataArray, 7, 39);
        } else if (query_infoID == 'radioGetInfoParamVersion') { // Parameter Version
            paramVersion.value = getStringFromData(dataArray, 7, 39);
        } else {
            log('Dati ricevuti NON corrispondono al formato atteso per Info (byte 4 != 0x00/01/02/03)', 'info');
            return;
        }
        query_infoID = '';
    } else {
        log('Dati ricevuti NON corrispondono al formato atteso per Info (byte 5-6 != 0x0020)', 'info');
        return;
    }
}

// Funzione per gestire le notifiche delle caratteristiche, chiamata quando arriva un nuovo valore da XPress-ble.js
function handleCharacteristicValueChange(event, displayElement) {
    const value = event.target.value;
    // DataView.getUint8(0) gets the first byte.
    // You might need to adjust this depending on the actual data format (e.g., TextDecoder, multiple bytes, etc.)
    const receivedData = new Uint8Array(value.buffer);
    const decodedData = new TextDecoder().decode(receivedData); // Attempt to decode as text
    // displayElement.textContent = `0x${Array.from(receivedData).map(b => b.toString(16).padStart(2, '0')).join('')} (ASCII: "${decodedData}")`;
    displayElement.textContent = `0x${Array.from(receivedData).map(b => b.toString(16).padStart(2, '0')).join('')}`;
    if ((query_periodica == false) && (fw_dowloading == false)) {
        log(`Received notification from ${event.target.uuid}: ${decodedData} (Raw: ${receivedData})`);
    } else {
        // formatted log status
    }

    if (receivedData[3] == 0x01 && receivedData[4] == 0x82) {
        updateStatusDataFields(receivedData);
    } else if (receivedData[3] == 0x01 && receivedData[4] == 0x81) {
        updateFWVersionDataFields(receivedData);
    } else if (receivedData[3] == 0x01 && receivedData[4] == 0x87) {
        updateInfoDataFields(receivedData);
    } else if (receivedData[3] == 0x01 && receivedData[4] == 0x86) {
        log('Set Info ACK received', 'info');
    } else if (receivedData[3] == 0x02 && receivedData[4] == 0x80) {
        log('Start FW dowload ACK received', 'info');
        ack_received = true;
    } else if (receivedData[3] == 0x02 && receivedData[4] == 0x81) {
        // log('FW download ACK received', 'info');
        ack_received = true;
    } else if (receivedData[3] == 0x02 && receivedData[4] == 0x82) {
        log('FW Install ACK received', 'info');
        ack_received = true;
    } else {
        log('Dati ricevuti NON corrispondono al formato atteso control-function code', 'info');
    }
}


// --- Event Listeners ---
connectButton.addEventListener('click', connectDevice);
disconnectButton.addEventListener('click', disconnectDevice);
writeRxButton.addEventListener('click', () => writeToCharacteristic(rxCharacteristic, rxInput));
queryForm.addEventListener('click', (event) => {
    const boardSN = document.getElementById('boardSN');
    const machineSN = document.getElementById('machineSN');
    const bleName = document.getElementById('bleName');
    const paramVersion = document.getElementById('paramVersion');
    if (event.target.name === 'sceltaQuery') {
        if ((event.target.id === 'radioGetStatus') || 
        (event.target.id === 'radioGetVersion') || 
        (event.target.id === 'radioGetInfoBoardSN') || 
        (event.target.id === 'radioGetInfoMachineSN') || 
        (event.target.id === 'radioGetInfoBLEName') || 
        (event.target.id === 'radioGetInfoParamVersion')) {
            rxInput.value = event.target.value;
            query_infoID = event.target.id;
        } else if (event.target.id === 'radioSetInfoBoardSN') {
            rxInput.value = querySetInfo(boardSN.value, 0x00);
        } else if (event.target.id === 'radioSetInfoMachineSN') {
            rxInput.value = querySetInfo(machineSN.value, 0x01);
        } else if (event.target.id === 'radioSetInfoBLEName') {
            rxInput.value = querySetInfo(bleName.value, 0x02);
        } else if (event.target.id === 'radioSetInfoParamVersion') {
            rxInput.value = querySetInfo(paramVersion.value, 0x03);
        } else if (event.target.id === 'fwUpdate') {
            rxInput.value = 'FW Update selected. Choose a file.'; // Placeholder
        }
    }
});
chekboxPeriodicQuery.addEventListener('change', (event) => {
    if(event.target.checked) {
        log('Periodic Query abilitata. (Funzionalità da implementare)');
        // Implement periodic query logic if needed
        query_periodica = true
        log('Machine Status Monitor')
        log('Status;Duration;Progress;ProbeT;EnvT;MotI;TECV;LoadsV;MotfI;MotDuty;MotV;Motw;MoPos;Flavour;Opt;Scan','monitor');
        periodicQueryInterval = setInterval(() => {
            if (rxInput.value) {
                writeToCharacteristic(rxCharacteristic, rxInput);
                writeRxButton.disabled = true; // Disable button to prevent manual sends during periodic query
            } else {
                log('Nessuna query selezionata per la periodic query.', 'info');
            }
        }, 1000); // Esempio: ogni 1000 millisecondi
    } else {
        query_periodica = false
        log('Periodic Query disabilitata.');
        // Stop periodic query logic if implemented
        periodicQueryInterval = clearInterval(periodicQueryInterval);
        writeRxButton.disabled = false; // Re-enable button if no query is set
        
    }
});

fwFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        log(`File selezionato per l'aggiornamento firmware: ${file.name} (${file.size} bytes)`, 'info');
        // Implement firmware update logic if needed
        const arrayBuffer = await file.arrayBuffer();
        const fw_uint8Array = new Uint8Array(arrayBuffer);
        log(`Contenuto del file (primi 64 bytes): 0x${Array.from(fw_uint8Array.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join('-')}`, 'info');
        // Further processing of the firmware file can be done here
        queryUpdateFW(fw_uint8Array);
    } else {
        log('Nessun file selezionato.', 'info');
    }
});


// readModeButton.addEventListener('click', () => readCharacteristic(modeCharacteristic, modeValueDisplay));
// writeModeButton.addEventListener('click', () => writeToCharacteristic(modeCharacteristic, modeInput));

// Initial UI state
clearDataFields();
updateConnectionStatus(false);
log('Pronto per la connessione. Assicurati che Web Bluetooth sia abilitato nel tuo browser e che il dispositivo sia in modalità advertising.');
