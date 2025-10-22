import facturaStorage from './services/facturaStorage.js';

// Actualizar stats para BCO240821BG5
async function updateStats() {
    console.log('Actualizando stats para BCO240821BG5...');
    await facturaStorage.actualizarStatsEmpresa('BCO240821BG5');
    console.log('✓ Stats actualizados');
    process.exit(0);
}

updateStats();
