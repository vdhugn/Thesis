// Get AQI color by value
function getColor(aqi) {
  if (aqi == null) return "#999999";
  if (aqi <= 50) return "#a8e05f";
  if (aqi <= 100) return "#fdd64b";
  if (aqi <= 150) return "#ff9b57";
  if (aqi <= 200) return "#fe6a69";
  if (aqi <= 300) return "#8f3f97";
  return "#7e0023";
}

async function loadChoropleth(map) {
  const [geoRes, aqiRes] = await Promise.all([
    fetch("static/js/map.geojson"),
    fetch("http://localhost:5000/api/province_aqi")
  ]);

  const geojson = await geoRes.json();
  const aqiData = await aqiRes.json();

  const aqiLookup = {};
  aqiData.forEach(d => {
    aqiLookup[d.province] = d.aqi;
  });

  function getStyle(feature) {
    const name = feature.properties.Name_EN;
    const aqi = aqiLookup[name];
    return {
      fillColor: getColor(aqi),
      fillOpacity: 0.4,
      color: "transparent",
      weight: 0
    };
  }

  const layer = L.geoJSON(geojson, {
    style: getStyle,
    onEachFeature: (feature, layer) => {
      const name = feature.properties.Name_EN;
      const aqi = aqiLookup[name];
      layer.bindPopup(`<strong>${feature.properties.Name_EN}</strong><br>AQI: ${aqi ?? "No data"}`);
    }
  });

  window.provinceLayer = layer;
  window.provinceGeoData = geojson;
  layer.addTo(map);
}

async function updateChoroplethAQI() {
  if (!window.provinceLayer || !window.provinceGeoData) return;

  const aqiRes = await fetch("http://localhost:5000/api/province_aqi");
  const aqiData = await aqiRes.json();

  const aqiLookup = {};
  aqiData.forEach(d => {
    aqiLookup[d.province] = d.aqi;
  });

  window.provinceLayer.eachLayer(layer => {
    const name = layer.feature.properties.Name_EN;
    const aqi = aqiLookup[name];

    layer.setStyle({
      fillColor: getColor(aqi),
      fillOpacity: 0.4,
      color: "transparent",
      weight: 0
    });

    layer.setPopupContent(`<strong>${layer.feature.properties.Name_EN}</strong><br>AQI: ${aqi ?? "No data"}`);
  });
}
