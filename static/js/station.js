document.addEventListener("DOMContentLoaded", () => {
  const uid = new URLSearchParams(window.location.search).get("uid");

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

  if (uid) {
    fetch(`http://localhost:5000/api/station_detail/${uid}`)
      .then(res => res.json())
      .then(data => {
        // AQI Display
        document.getElementById("station-name").textContent = data.name;
        const aqi = data.aqi;
        const cat = getAqiCategory(aqi);

        const aqiBlock = document.getElementById("aqi-container");
        aqiBlock.style.background = cat.color;
        document.getElementById("aqi-value").textContent = aqi ?? "--";
        document.getElementById("aqi-label").textContent = cat.label;
        document.getElementById("aqi-icon").textContent = cat.icon;
        document.getElementById("aqi-recommendation").textContent = getAqiRecommendation(aqi);
        document.getElementById("aqi-summary").innerHTML =
          `AQI: <span style="background:${cat.color}">${aqi} - ${cat.label}</span>`;

        const updateDate = new Date(data.last_update);
        const now = new Date();
        const diffHours = Math.round((now - updateDate) / (1000 * 60 * 60));
        const localString = updateDate.toLocaleString("en-US", {
          timeZone: "Asia/Bangkok",  // explicitly use GMT+7
          hour12: false
        });
        document.getElementById("last-update").textContent =
          `Update ${diffHours} hours ago (${localString})`;

        if (data.forecast && Array.isArray(data.forecast)) {
          const forecastTable = document.querySelector("#forecast-table tbody");
          forecastTable.innerHTML = "";

          data.forecast.forEach(item => {
            const category = getAqiCategory(item.avg_pm25);
            const row = document.createElement("tr");
            row.innerHTML = `
              <td>${item.date}</td>
              <td>
                <span class="pm25-value" style="color: ${category.color}; font-weight: bold;">
                  ${item.avg_pm25}
                </span>
              </td>
            `;

            forecastTable.appendChild(row);
          });
        }

        // Weather from station coordinates
        if (data.latitude && data.longitude) {
          fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${data.latitude}&lon=${data.longitude}&units=metric&appid=${apiKey}`)
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
        }

        // Load AQI historical chart
        fetch(`http://localhost:5000/api/station_history/${uid}`)
          .then(res => res.json())
          .then(history => {
            // Sort by datetime descending
            const last24 = history.recent ?? [];
            const last12Months = history.daily ?? [];

            drawChart("aqi-24h", "Last 24 hours", last24);
            drawChart("aqi-12months", "Last 30 Days", last12Months);
          })
          .catch(err => {
            console.error("Failed to load AQI history:", err);
          });

      })
      .catch(err => {
        console.error("Failed to load station data:", err);
      });
  }
  function drawChart(canvasId, title, data) {
    const ctx = document.getElementById(canvasId).getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(d => d.time),
        datasets: [{
          label: "AQI",
          backgroundColor: data.map(d => {
            if (d.aqi <= 50) return "#a8e05f";       // Good
            else if (d.aqi <= 100) return "#fdd64b"; // Moderate
            else if (d.aqi <= 150) return "#ff9b57"; // Unhealthy for Sensitive Groups
            else if (d.aqi <= 200) return "#fe6a69"; // Unhealthy
            else if (d.aqi <= 300) return "#a97abc"; // Very Unhealthy
            else return "#a87383";                   // Hazardous
          }),
          data: data.map(d => d.aqi),
          fill: false,
          borderColor: "#000",
          tension: 0.3,
          borderRadius: 8,
          barPercentage: 0.6,
          categoryPercentage: 0.8,
        }]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: title
          }
        },
        scales: {
          x: { display: true, title: { display: true, text: 'Time' }},
          y: { beginAtZero: true, title: { display: true, text: 'AQI' }}
        }
      }
    });
  }

  function getAqiRecommendation(aqi) {
    if (aqi <= 50) return "Good air quality. No health precautions needed.";
    else if (aqi <= 100) return "Moderate. Unusually sensitive individuals should consider limiting outdoor exertion.";
    else if (aqi <= 150) return "Unhealthy for sensitive groups. People with respiratory or heart issues should limit outdoor activities.";
    else if (aqi <= 200) return "Unhealthy. Everyone should reduce prolonged outdoor exertion.";
    else if (aqi <= 300) return "Very unhealthy. Avoid outdoor activity. Sensitive groups should stay indoors.";
    else return "Hazardous. Remain indoors and avoid all physical activity outside.";
  }
});

document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const chart = btn.getAttribute('data-chart');

    // Toggle active button
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Toggle chart visibility
    document.getElementById('aqi-24h').style.display = chart === '24h' ? 'block' : 'none';
    document.getElementById('aqi-12months').style.display = chart === '12months' ? 'block' : 'none';
  });
});
