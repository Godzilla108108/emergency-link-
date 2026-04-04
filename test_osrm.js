const data = "77.2090,28.6139;77.3910,28.5355";
fetch(`https://router.project-osrm.org/table/v1/driving/${data}?sources=0&annotations=distance,duration`)
  .then(r => r.json())
  .then(d => {
    console.log("OSRM Distance (m):", d.distances[0][1]);
    console.log("OSRM Distance (km):", d.distances[0][1] / 1000);
  });
