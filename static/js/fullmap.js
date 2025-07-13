document.addEventListener("DOMContentLoaded", function () {
  const map = L.map('map').setView([19.8086935,105.7086531], 6.5);

  L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  function loadAQIData() {
    fetch('http://localhost:5000/api/stations')
      .then(response => response.json())
      .then(data => {
        if (window.aqiLayer) {
          map.removeLayer(window.aqiLayer);
        }

        const markers = L.layerGroup();

        L.geoJSON(data, {
          pointToLayer: function (feature, latlng) {
            const aqi = feature.properties.aqi;
            const hasAQI = aqi !== null && aqi !== "-" && !isNaN(parseInt(aqi));
            const { color } = getAqiCategory(aqi);
            const size = hasAQI ? 28 : 14;

            const icon = L.divIcon({
              className: 'aqi-label',
              html: `<div style="
              background:${color};
              width:${size}px;
              height:${size}px;
              line-height:${size}px;
              border-radius:50%;
              text-align:center;
              font-size:12px;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
              color:#000;
              font-weight:normal;
              ">${hasAQI ? aqi : "?"}</div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2]
            });

            const marker = L.marker(latlng, { icon });
            marker.feature = feature;

            marker.on('click', () => {
              const p = feature.properties;
              const aqiData = getAqiCategory(p.aqi);

              document.getElementById("station-name").textContent = p.name;
              document.getElementById("station-time").textContent = p.time ?? "N/A";

              document.getElementById("aqi-summary").innerHTML = `
                <div class="aqi-card" style="background:${aqiData.color};">
                  <div class="value-row">
                    <div class="value"><span style="font-size:18px;">${aqiData.icon}</span></div>
                    <div class="value"><span style="font-size:32px;font-weight:bold;">${p.aqi ?? "N/A"}</span></div>
                  </div>
                  <div style="font-size:16px;">${aqiData.label}</div>
                  <div><span style="background:#fff;padding:2px 6px;border-radius:4px;font-size:12px;">PM2.5 | ${p.pm25 ?? "N/A"} µg/m³</span></div>
                </div>

                <div class="stats-row">
                  <div class="stat">
                    <span>🌡️ ${p.temperature ?? "N/A"}°C</span>
                  </div>
                  <div class="stat">
                    <span>💧 ${p.humidity ?? "N/A"}%</span>
                  </div>
                  <div class="stat">
                    <span>💨 ${p.wind ?? "N/A"} m/s</span>
                  </div>
                </div>

                <div style="text-align:center; margin-top:10px;">
                  <button onclick="window.location.href='station.html?uid=${p.uid}'"
                          style="padding:6px 12px; background:#3498db; color:white; border:none; border-radius:5px; cursor:pointer;">
                    Xem chi tiết
                  </button>
                </div>
              `;

              document.getElementById("info-panel").style.display = 'block';
            });

            return marker;
          }
        }).eachLayer(m => markers.addLayer(m));

        window.aqiLayer = markers;
        map.addLayer(markers);
        loadChoropleth(map);
      })
      .catch(err => console.error("Error loading data:", err));

  fetch("http://localhost:5000/api/province_aqi")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("province-rows");
    data.forEach(p => {
      const cat = getAqiCategory(p.aqi);

      const row = document.createElement("div");
      row.className = "province-row";

      row.innerHTML = `
        <div class="province-aqi">
          <div class="icon">${cat.icon}</div>
          <div style="font-size: 14px; color: ${cat.color}; font-weight: bold;">${cat.label}</div>
        </div>
        <div class="province-info">
          <div class="name">${p.province}</div>
          <div class="desc">No time data</div>
        </div>
        <div class="province-data">
          <div>
            <span style="color: ${getPollutantColor('pm10', p.pm10)}">${p.pm10?.toFixed(1)}</span> PM₁₀<br>ug/m³
          </div>
          <div>
            <span style="color: ${getPollutantColor('pm25', p.pm25)}">${p.pm25?.toFixed(1)}</span> PM₂.₅<br>ug/m³
          </div>
          <div>
            <span style="color: ${getPollutantColor('co', p.co)}">${p.co?.toFixed(2)}</span> CO<br>ppm
          </div>
          <div>
            <span style="color: ${getPollutantColor('no2', p.no2)}">${p.no2?.toFixed(2)}</span> NO₂<br>ppb
          </div>
        </div>
      `;

      container.appendChild(row);
    });
  })
  .catch(err => console.error("Error loading province data:", err));

  }
  loadAQIData();       
  updateChoroplethAQI();

  setInterval(() => {
    loadAQIData();       
    updateChoroplethAQI();
  }, 300000);
});

document.getElementById("city-search-btn").addEventListener("click", () => {
  const city = document.getElementById("city-search-input").value.trim();
  if (city) {
    const encoded = encodeURIComponent(city);
    window.location.href = `search_result.html?name=${encoded}`;
  }
});