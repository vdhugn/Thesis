document.addEventListener("DOMContentLoaded", async () => {
  const cityName = new URLSearchParams(window.location.search).get("name");
  const cityDisplay = document.getElementById("city-name");
  const input = document.getElementById("city-search-input");
  const button = document.getElementById("city-search-btn");
  cityDisplay.textContent = cityName || "Unknown";
  
  if (input && cityName) {
    input.value = cityName;
  }

  if (input && button) {
    button.addEventListener("click", () => {
      const newCity = input.value.trim();
      if (newCity) {
        window.location.href = `/search_result.html?name=${encodeURIComponent(newCity)}`;
      }
    });
  }

  if (!cityName) return;

  // Handle Vietnamese accent
  function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .trim();
  }

  const slugifiedName = slugify(cityName);
  const openWeatherKey = "4ca5ef0a07c282e3043855ec422eab4c";

  try {
    // Get coordinates
    const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(slugifiedName)},VN&limit=1&appid=${openWeatherKey}`);
    const geoData = await geoRes.json();

    if (!geoData || geoData.length === 0) {
      cityDisplay.textContent = "City not found";
      return;
    }

    const { lat, lon } = geoData[0];

    // Get AQI from OpenWeather
    const airRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${openWeatherKey}`);
    const airData = await airRes.json();
    const air = airData.list[0];

    const aqi = air.main.aqi;
    document.getElementById("aqi-value").textContent = aqi;
    document.getElementById("aqi-label").textContent = getAqiLabel(aqi);
    document.getElementById("pm25").textContent = air.components.pm2_5 ?? "--";
    document.getElementById("pm10").textContent = air.components.pm10 ?? "--";
    document.getElementById("no2").textContent = air.components.no2 ?? "--";
    document.getElementById("o3").textContent = air.components.o3 ?? "--";

    // Get weather data
    const weatherWrapper = document.getElementById("weather-wrapper");
    const weatherCard = document.getElementById("weather-card");

    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${openWeatherKey}`)
      .then(res => res.json())
      .then(weatherData => {
        const weather = weatherData.weather[0];
        const main = weatherData.main;
        const wind = weatherData.wind;
        const visibility = weatherData.visibility;
        const sunrise = new Date(weatherData.sys.sunrise * 1000).toLocaleTimeString();
        const sunset = new Date(weatherData.sys.sunset * 1000).toLocaleTimeString();

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
        const bg = backgrounds[weather.main] || "#4a4a4a";

        if (weatherWrapper) weatherWrapper.style.setProperty("--bg-color", bg);
        if (weatherCard) {
          weatherCard.innerHTML = `
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
        if (weatherCard) weatherCard.innerHTML = "<p>❌ Failed to load weather data.</p>";
      });
  } catch (err) {
    console.error("Error fetching OpenWeather AQI:", err);
  }

  // Search stations from backend
  try {
    const res = await fetch('http://localhost:5000/api/stations');
    const geo = await res.json();
    const list = document.getElementById("station-list");

    const matches = geo.features.filter(f =>
      f.properties.name.toLowerCase().includes(cityName.toLowerCase())
    );

    if (matches.length === 0) {
      list.innerHTML = "<li>No monitoring stations found.</li>";
    } else {
      for (const station of matches) {
        const name = station.properties.name;
        const aqi = station.properties.aqi;
        const uid = station.properties.uid;
        
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = `/station.html?uid=${uid}`;
        link.textContent = `${name} — AQI: ${aqi ?? "--"}`;
        li.appendChild(link);
        list.appendChild(li);
      }
    }
  } catch (err) {
    console.error("Failed to fetch station list:", err);
  }

});

function getAqiLabel(aqi) {
  const labels = {
    1: "Good",
    2: "Fair",
    3: "Moderate",
    4: "Poor",
    5: "Very Poor"
  };
  return labels[aqi] || "Unknown";
}

