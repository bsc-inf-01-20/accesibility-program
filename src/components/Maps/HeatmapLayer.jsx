import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import PropTypes from 'prop-types';

const HeatmapLayer = ({ students }) => {
  const map = useMap();

  useEffect(() => {
    if (!students?.length) return;

    const heatData = students
      .filter(student => {
        const coordsValue = student.dataValues?.find(
          dv => dv.dataElement === 'uVwX1234'
        )?.value;
        return coordsValue && JSON.parse(coordsValue);
      })
      .map(student => {
        const coords = JSON.parse(
          student.dataValues.find(dv => dv.dataElement === 'uVwX1234').value
        );
        return [coords[0], coords[1], 0.5];
      });

    const heatLayer = L.layerGroup();
    
    heatData.forEach(point => {
      L.circleMarker([point[0], point[1]], {
        radius: 8,
        fillColor: getColorBasedOnIntensity(point[2]),
        color: '#333',
        weight: 1,
        opacity: 0.7,
        fillOpacity: 0.8
      }).addTo(heatLayer);
    });

    heatLayer.addTo(map);

    return () => map.removeLayer(heatLayer);
  }, [students, map]);

  return null;
};

function getColorBasedOnIntensity(intensity) {
  if (intensity > 0.7) return '#ff0000';
  if (intensity > 0.4) return '#ffff00';
  return '#0000ff';
}

HeatmapLayer.propTypes = {
  students: PropTypes.arrayOf(
    PropTypes.shape({
      dataValues: PropTypes.arrayOf(
        PropTypes.shape({
          dataElement: PropTypes.string,
          value: PropTypes.string
        })
      )
    })
  )
};

export default HeatmapLayer;