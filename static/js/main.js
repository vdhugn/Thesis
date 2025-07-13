document.addEventListener("DOMContentLoaded", function () {
  const map = L.map('map').setView([21.5100534,105.4514288], 7.3);

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
        const rankingList = document.getElementById("ranking-list");
        rankingList.innerHTML = "";

        const markers = L.layerGroup();
        
        const sorted = [...data.features]
          .filter(f => f.properties.aqi !== "-" && f.properties.aqi !== null && !isNaN(parseInt(f.properties.aqi)))
          .sort((a, b) => parseInt(b.properties.aqi) - parseInt(a.properties.aqi))
          .slice(0, 10);

        sorted.forEach((f, i) => {
          const { aqi, name } = f.properties;
          const [lon, lat] = f.geometry.coordinates;
          const { color } = getAqiCategory(aqi);

          const li = document.createElement("li");
          li.className = "ranking-item";

          li.innerHTML = `
            <span class="rank-number">${i + 1}</span>
            <span class="city-name">${name}</span>
            <span class="aqi-badge" style="background-color:${color}">${aqi}</span>
          `;

          li.onclick = () => map.setView([lat, lon], 13);
          rankingList.appendChild(li);
        });

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
  
  
  fetch("/api/province_aqi")
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

document.addEventListener("DOMContentLoaded", () => {
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", () => {
      window.location.href = "map.html";
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const apiKey = "4ca5ef0a07c282e3043855ec422eab4c";
  const wrapper = document.getElementById("weather-wrapper");
  const card = document.getElementById("weather-card");

  const backgrounds = {
    Clear: "#49b6ff",
    Clouds: "#4f6781",
    Rain: "#4e6e81",
    Thunderstorm: "#4a4e69",
    Drizzle: "#7aa0b4",
    Snow: "#b3d0ff",
    Mist: "#b9c0c9",
    Smoke: "#9a9a9a",
    Haze: "#9a9a9a",
    Dust: "#b5895c",
    Fog: "#a4b0be",
    Sand: "#d4a373",
    Ash: "#666666",
    Squall: "#7f8c8d",
    Tornado: "#6c5ce7"
  };

  // Ask for user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`)
        .then(res => res.json())
        .then(weatherData => {
          const weather = weatherData.weather[0];
          const main = weatherData.main;
          const wind = weatherData.wind;
          const visibility = weatherData.visibility;
          const sunrise = new Date(weatherData.sys.sunrise * 1000).toLocaleTimeString();
          const sunset = new Date(weatherData.sys.sunset * 1000).toLocaleTimeString();
          const bg = backgrounds[weather.main] || "#4a4a4a";

          if (wrapper) wrapper.style.setProperty("--bg-color", bg);
          if (card) {
            card.innerHTML = `
              <h2>${weatherData.name}, ${weatherData.sys.country}</h2>
              <div class="weather-general">
                <img class="weather-icon" src="https://openweathermap.org/img/wn/${weather.icon}@2x.png" alt="${weather.description}" />
                <div class="weather-temp">${main.temp.toFixed(0)}°C</div>
                <div class="weather-desc">${weather.description}</div>
              </div>
              <div class="weather-details-grid">
                <div class="weather-detail"><strong>Feels like</strong><br>${main.feels_like}°C</div>
                <div class="weather-detail"><strong>Humidity</strong><br>${main.humidity}%</div>
                <div class="weather-detail"><strong>Pressure</strong><br>${main.pressure} hPa</div>
                <div class="weather-detail"><strong>Wind</strong><br>${wind.speed} m/s</div>
                <div class="weather-detail"><strong>Visibility</strong><br>${(visibility / 1000).toFixed(1)} km</div>
                <div class="weather-detail"><strong>Sunrise</strong><br>${sunrise}</div>
                <div class="weather-detail"><strong>Sunset</strong><br>${sunset}</div>
              </div>
            `;
          }
        })
        .catch(err => {
          console.error("Failed to fetch weather:", err);
          if (card) card.innerHTML = "<p>❌ Failed to load weather data.</p>";
        });
    }, err => {
      console.error("Geolocation error:", err);
      if (card) card.innerHTML = "<p>⚠️ Cannot get your location.</p>";
    });
  } else {
    console.error("Geolocation not supported.");
    if (card) card.innerHTML = "<p>⚠️ Geolocation not supported by your browser.</p>";
  }
});
