import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularLoader,
} from "@dhis2/ui";
import PropTypes from "prop-types";
import "./ResultsTable.css";

/**
 * ResultsTable
 *
 * Displays a table of matched results between schools and their closest destinations
 * (e.g., places, markets, clinics, assigned schools, etc.). It supports custom headers
 * and a loading state while data is being processed.
 *
 * @component
 * @example
 * return (
 *   <ResultsTable
 *     places={[
 *       {
 *         id: '123',
 *         school: 'Chilombo School',
 *         destination: 'Mchinji Market',
 *         distance: 4.32,
 *         time: '45 mins',
 *         travelMode: 'walking'
 *       }
 *     ]}
 *     loading={false}
 *     headers={{
 *       schoolHeader: 'Teacher Name',
 *       placeHeader: 'Assigned School',
 *       distanceHeader: 'Distance (km)',
 *       timeHeader: 'Travel Time',
 *       modeHeader: 'Transport Mode',
 *     }}
 *   />
 * )
 *
 * @param {Object} props
 * @param {Array<Object>} props.places - Array of result objects containing school and destination data.
 * @param {boolean} props.loading - If true, shows a loading indicator instead of data.
 * @param {Object} [props.headers] - Optional overrides for column headers.
 * @param {string} [props.headers.schoolHeader] - Header label for the school column.
 * @param {string} [props.headers.placeHeader] - Header label for the destination/place column.
 * @param {string} [props.headers.distanceHeader] - Header label for the distance column.
 * @param {string} [props.headers.timeHeader] - Header label for the travel time column.
 * @param {string} [props.headers.modeHeader] - Header label for the travel mode column.
 */
export const ResultsTable = ({
  places,
  loading,
  headers = {}
}) => {
  const mergedHeaders = {
    schoolHeader: "School Name",
    placeHeader: "Closest Place",
    distanceHeader: "Distance (km)",
    timeHeader: "Travel Time",
    modeHeader: "Travel Mode",
    ...headers,
  };

  const getRowKey = (place) => {
    if (place.id) return place.id;
    return `${place.school}-${place.place}-${place.distance}-${place.travelMode}`.replace(
      /\s+/g,
      "_"
    );
  };

  React.useEffect(() => {
    if (places.length > 0) {
      console.log(
        "ResultsTable received places:",
        places.map((p) => ({
          school: p.school,
          place: p.destination,
          travelMode: p.travelMode,
          distance: p.distance,
          time: p.time,
        }))
      );
    }
  }, [places]);

  return (
    <div className="results-table-container">
      <Table className="results-table">
        <TableHead>
          <TableRow>
            <TableCell className="table-header-cell">{mergedHeaders.schoolHeader}</TableCell>
            <TableCell className="table-header-cell">{mergedHeaders.placeHeader}</TableCell>
            <TableCell className="table-header-cell">{mergedHeaders.distanceHeader}</TableCell>
            <TableCell className="table-header-cell">{mergedHeaders.timeHeader}</TableCell>
            <TableCell className="table-header-cell">{mergedHeaders.modeHeader}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {places.length > 0 ? (
            places.map((place) => (
              <TableRow key={getRowKey(place)}>
                <TableCell>{place.school || "Unknown School"}</TableCell>
                <TableCell>{place.destination || place.place || "Unknown Place"}</TableCell>
                <TableCell>
                  {typeof place.distance === "number"
                    ? place.distance.toFixed(2)
                    : "N/A"}
                </TableCell>
                <TableCell>{place.time || "N/A"}</TableCell>
                <TableCell>
                  <span
                    className={`travel-mode-badge ${place.travelMode || "unknown"}`}
                  >
                    {place.travelMode
                      ? place.travelMode.charAt(0).toUpperCase() +
                        place.travelMode.slice(1)
                      : "Unknown (API returned no mode)"}
                  </span>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan="5" className="table-cell-centered">
                {loading ? (
                  <div className="loading-indicator">
                    <CircularLoader small />
                    <span>Processing data...</span>
                  </div>
                ) : (
                  "No results yet"
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

ResultsTable.propTypes = {
  places: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      school: PropTypes.string,
      place: PropTypes.string,
      destination: PropTypes.string,
      distance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      time: PropTypes.string,
      travelMode: PropTypes.oneOf([
        "walking",
        "driving",
        "bicycling",
        "transit",
      ]),
      overviewPolyline: PropTypes.string,
      steps: PropTypes.array,
      location: PropTypes.object,
      schoolLocation: PropTypes.object,
    })
  ).isRequired,
  loading: PropTypes.bool.isRequired,
  headers: PropTypes.shape({
    schoolHeader: PropTypes.string,
    placeHeader: PropTypes.string,
    distanceHeader: PropTypes.string,
    timeHeader: PropTypes.string,
    modeHeader: PropTypes.string,
  }),
};

ResultsTable.defaultProps = {
  places: [],
  headers: {},
};
