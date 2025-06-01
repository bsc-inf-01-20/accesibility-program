import React from 'react'
import { MapHeader } from './MapHeader'
import { MapContainer } from './MapContainer'
import './LeafletMapViewer.css'

/**
 * LeafletMapViewer
 *
 * Renders a popup-style map viewer showing a route from a school to the nearest place (e.g. market or clinic).
 * Includes a header with trip information and a Leaflet map with a visual path.
 *
 * @component
 * @example
 * return (
 *   <LeafletMapViewer
 *     result={selectedResult}
 *     onClose={() => setSelectedResult(null)}
 *   />
 * )
 *
 * @param {Object} props
 * @param {Object} props.result - The proximity result containing route and location data.
 * @param {Function} props.onClose - Callback to close the viewer.
 */
export const LeafletMapViewer = ({ result, onClose }) => {
  
  if (!result) return null

  console.log('MapViewer received:', {
    school: result.school,
    place: result.destination,
    schoolCoords: result.originCoords,
    schoolLocation: result.originLocation,
    placeLocation: result.location,
    polyline: result.overviewPolyline,
    distance: result.distance,
    time: result.time
  })

  /**
   * Gets the coordinates of the school in { lat, lng } format
   *
   * Tries to resolve from schoolLocation, schoolCoords or schoolGeometry.
   * @returns {Object|null} The { lat, lng } object or null if invalid
   */
  const getSchoolLocation = () => {
    if (result.originLocation) {
      return result.originLocation
    }

    if (Array.isArray(result.originCoords)) {
      return {
        lat: result.originCoords[1],
        lng: result.originCoords[0]
      }
    }

    if (result.rawData?.geometry?.coordinates) {
      return {
        lat: result.rawData.geometry.coordinates[1],
        lng: result.rawData.geometry.coordinates[0]
      }
    }

    console.error('No valid school coordinates found')
    return null
  }

  const schoolLocation = getSchoolLocation()

  return (
    <div className="leaflet-popup-container" data-testid="map-container">
      <MapHeader
        school={result.school}
        place={result.destination}
        distance={result.distance}
        time={result.time}
        onClose={onClose}
      />
      <div className="map-content-wrapper">
        <MapContainer
          schoolLocation={schoolLocation}
          schoolName={result.school}
          location={result.location}
          placeName={result.destination}
          overviewPolyline={result.overviewPolyline}
          distance={result.distance}
          time={result.time}
          travelMode={result.travelMode}
        />
      </div>
    </div>
  )
}