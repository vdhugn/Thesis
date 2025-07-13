fetch("/api/stations")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("station-list");

    data.features.forEach(feature => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;

      const card = document.createElement("div");
      card.className = "station-card";
      card.onclick = () => {
        window.location.href = `station.html?uid=${props.uid}`;
      };

      const color = getAqiCategory(props.aqi);

      card.innerHTML = `
        <div class="station-name">${props.name}</div>
        <div class="station-meta">Lat: ${coords[1].toFixed(2)}, Lon: ${coords[0].toFixed(2)}</div>
        <div class="aqi-badge" style="background:${color}">AQI: ${props.aqi}</div>
      `;
      container.appendChild(card);
    });
  });

