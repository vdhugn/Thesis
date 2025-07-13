function getAqiCategory(aqi) {
    const value = parseInt(aqi);
    if (isNaN(value)) return { category: "No Data", color: "#999999", label: "N/A", icon: "❓" };
    if (value <= 50) return { category: "Good", color: "#a8e05f", label: "Good", icon: "🙂" };
    if (value <= 100) return { category: "Moderate", color: "#fdd64b", label: "Moderate", icon: "😐" };
    if (value <= 150) return { category: "Unhealthy for SG", color: "#ff9b57", label: "Unhealthy for Sensitive Groups", icon: "🤧" };
    if (value <= 200) return { category: "Unhealthy", color: "#fe6a69", label: "Unhealthy", icon: "🤒" };
    if (value <= 300) return { category: "Very Unhealthy", color: "#8f3f97", label: "Very Unhealthy", icon: "😷" };
    return { category: "Hazardous", color: "#7e0023", label: "Hazardous", icon: "😖" };
  }

function getPollutantColor(pollutant, value) {
    if (value == null) return "#ccc";
    value = parseFloat(value);

    switch (pollutant) {
      case "pm25":
        if (value <= 12) return "#a8e05f";         // Good
        if (value <= 35.4) return "#fdd64b";        // Moderate
        if (value <= 55.4) return "#ff9b57";        // USG
        if (value <= 150.4) return "#fe6a69";       // Unhealthy
        if (value <= 250.4) return "#a97abc";       // Very Unhealthy
        return "#a87383";                           // Hazardous

      case "pm10":
        if (value <= 54) return "#a8e05f";
        if (value <= 154) return "#fdd64b";
        if (value <= 254) return "#ff9b57";
        if (value <= 354) return "#fe6a69";
        if (value <= 424) return "#a97abc";
        return "#a87383";

      case "no2":
        if (value <= 53) return "#a8e05f";
        if (value <= 100) return "#fdd64b";
        if (value <= 360) return "#ff9b57";
        if (value <= 649) return "#fe6a69";
        if (value <= 1249) return "#a97abc";
        return "#a87383";

      case "co":
        if (value <= 4.4) return "#a8e05f";
        if (value <= 9.4) return "#fdd64b";
        if (value <= 12.4) return "#ff9b57";
        if (value <= 15.4) return "#fe6a69";
        if (value <= 30.4) return "#a97abc";
        return "#a87383";

      default:
        return "#ccc";
    }
  }