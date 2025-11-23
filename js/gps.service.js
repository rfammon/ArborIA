// js/gps.service.js

import * as state from './state.js';
import * as utils from './utils.js';

export async function handleGetGPS() {
  const gpsStatus = document.getElementById('gps-status');
  const coordXField = document.getElementById('risk-coord-x');
  const coordYField = document.getElementById('risk-coord-y');
  const getGpsBtn = document.getElementById('get-gps-btn');

  if (!navigator.geolocation) {
    if(gpsStatus) { 
        gpsStatus.textContent = "Sem GPS disponível."; 
        gpsStatus.className = 'instruction-text text-center error'; 
    }
    return;
  }
  
  const CAPTURE_TIME_MS = 10000;
  const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
  let readings = [];
  let watchId = null;
  let timerInterval = null;
  let startTime = Date.now();
  
  if(getGpsBtn) getGpsBtn.disabled = true;

  const cleanup = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timerInterval !== null) clearInterval(timerInterval);
      const btn = document.getElementById('get-gps-btn'); 
      if (btn) { btn.disabled = false; btn.innerHTML = '🛰️ Capturar GPS Preciso'; }
  };

  const updateUI = () => {
      const btn = document.getElementById('get-gps-btn');
      if (!btn) { cleanup(); return; } 

      const elapsed = Date.now() - startTime;
      const remaining = Math.ceil((CAPTURE_TIME_MS - elapsed) / 1000);
      
      let batteryIcon = '📡'; 
      btn.innerHTML = `${batteryIcon} Calibrando... ${remaining}s`;
      
      if (elapsed >= CAPTURE_TIME_MS) finishCapture();
  };

  const finishCapture = () => {
      cleanup();
      if (readings.length === 0) {
          utils.showToast("Sem sinal de satélite.", "error");
          return;
      }

      let sumLat = 0, sumLon = 0, sumAcc = 0;
      readings.forEach(r => { sumLat += r.latitude; sumLon += r.longitude; sumAcc += r.accuracy; });
      
      const avgLat = sumLat / readings.length;
      const avgLon = sumLon / readings.length;
      const avgAcc = sumAcc / readings.length;

      const utmCoords = utils.convertLatLonToUtm(avgLat, avgLon); 

      if (utmCoords) {
          if(coordXField) coordXField.value = utmCoords.easting.toFixed(0);
          if(coordYField) coordYField.value = utmCoords.northing.toFixed(0);
          
          if(state.setLastUtmZone) state.setLastUtmZone(utmCoords.zoneNum, utmCoords.zoneLetter);
          
          const dz = document.getElementById('default-utm-zone');
          if (dz) dz.value = `${utmCoords.zoneNum}${utmCoords.zoneLetter}`;
          
          const gs = document.getElementById('gps-status');
          if(gs) {
              const color = avgAcc <= 5 ? 'var(--color-forest)' : '#E65100';
              gs.innerHTML = `Precisão: <span style="color:${color}">±${avgAcc.toFixed(1)}m</span>`;
          }
          utils.showToast("Coordenadas capturadas!", "success");
      } else {
          utils.showToast("Erro na conversão UTM.", "error");
      }
  };

  watchId = navigator.geolocation.watchPosition(
      (pos) => { if (pos.coords.accuracy < 150) readings.push(pos.coords); },
      (err) => console.warn("GPS:", err),
      options
  );
  timerInterval = setInterval(updateUI, 1000);
  updateUI();
}
