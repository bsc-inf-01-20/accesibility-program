import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import PropTypes from 'prop-types'

/**
 * HeatmapLayer component
 *
 * Renders a circle-based heatmap using Leaflet based on students' geolocation data.
 * Intended for visualizing student density or distribution on the map.
 *
 * @component
 * @example
 * return (
 *   <HeatmapLayer students={studentDataArray} />
 * )
 *
 * @param {Object} props
 * @param {Array<Object>} props.students - List of student data with coordinates stored in dataValues.
 */
const HeatmapLayer = ({ students }) => {
  const map = useMap()

  useEffect(() => {
    if (!students?.length) return

    // Extract and validate geolocation coordinates
    const heatData = students
      .filter(student => {
        const coordsValue = student.dataValues?.find(
          dv => dv.dataElement === 'uVwX1234'
        )?.value
        return coordsValue && JSON.parse(coordsValue)
      })
      .map(student => {
        const coords = JSON.parse(
          student.dataValues.find(dv => dv.dataElement === 'uVwX1234').value
        )
        return [coords[0], coords[1], 0.5] // lat, lng, intensity
      })

    // Create and render heat points
    const heatLayer = L.layerGroup()
    heatData.forEach(point => {
      L.circleMarker([point[0], point[1]], {
        radius: 8,
        fillColor: getColorBasedOnIntensity(point[2]),
        color: '#333',
        weight: 1,
        opacity: 0.7,
        fillOpacity: 0.8
      }).addTo(heatLayer)
    })

    heatLayer.addTo(map)

    // Cleanup on unmount
    return () => map.removeLayer(heatLayer)
  }, [students, map])

  return null
}

/**
 * Returns a color string based on the intensity value.
 *
 * @param {number} intensity - The heat point intensity (0–1).
 * @returns {string} Color hex code.
 */
function getColorBasedOnIntensity(intensity) {
  if (intensity > 0.7) return '#ff0000' // red
  if (intensity > 0.4) return '#ffff00' // yellow
  return '#0000ff' // blue
}

HeatmapLayer.propTypes = {
  /** Array of student objects with geolocation stored as a JSON string in `dataValues`. */
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
}

export default HeatmapLayer
