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

export const ResultsTable = ({ places, loading, selectedAmenity }) => {
  const getRowKey = (place) => {
    if (place.id) return place.id;
    return `${place.school}-${place.place}-${place.distance}-${place.travelMode}`.replace(
      /\s+/g,
      "_"
    );
  };

  // Debug log to verify incoming data
  React.useEffect(() => {
    if (places.length > 0) {
      console.log(
        "ResultsTable received places:",
        places.map((p) => ({
          school: p.school,
          place: p.place,
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
            <TableCell className="table-header-cell">School Name</TableCell>
            <TableCell className="table-header-cell">
              Closest {selectedAmenity?.label || "Place"}
            </TableCell>
            <TableCell className="table-header-cell">Distance (km)</TableCell>
            <TableCell className="table-header-cell">Travel Time</TableCell>
            <TableCell className="table-header-cell">Travel Mode</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {places.length > 0 ? (
            places.map((place) => {
              // Additional debug log for each place
              console.log("Rendering place:", {
                school: place.school,
                travelMode: place.travelMode,
                hasTravelMode: !!place.travelMode,
              });

              return (
                <TableRow key={getRowKey(place)}>
                  <TableCell>{place.school || "Unknown School"}</TableCell>
                  <TableCell>{place.place || "Unknown Place"}</TableCell>
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
              );
            })
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
  selectedAmenity: PropTypes.shape({
    label: PropTypes.string,
  }),
};

ResultsTable.defaultProps = {
  places: [],
  selectedAmenity: { label: "Place" },
};
