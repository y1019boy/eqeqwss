const fs = require('fs');
fetch('https://raw.githubusercontent.com/Ichihai1415/JMA-GIS-GeoJSON/release/AreaForecastLocalM_1saibun_GIS_20190125_01.geojson')
  .then(res => res.json())
  .then(data => {
    console.log(data.features.slice(0, 10).map(f => f.properties.name));
  });
