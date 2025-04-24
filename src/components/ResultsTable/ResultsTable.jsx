import { Table, TableBody, TableCell, TableHead, TableRow, CircularLoader } from '@dhis2/ui';
import PropTypes from "prop-types";
import './ResultsTable.css';

export const ResultsTable = ({ places, loading, selectedAmenity }) => {
  // Generate a stable unique key for each place
  const getRowKey = (place) => {
    // Try to use existing ID first
    if (place.id) return place.id;
    
    // Fallback to composite key if no ID exists
    return `${place.school}-${place.place}-${place.distance}`.replace(/\s+/g, '_');
  };

  return (
    <Table className="results-table">
      <TableHead>
        <TableRow>
          <TableCell className="table-header-cell">School Name</TableCell>
          <TableCell className="table-header-cell">Closest {selectedAmenity?.label || 'Place'}</TableCell>
          <TableCell className="table-header-cell">Distance (km)</TableCell>
          <TableCell className="table-header-cell">Travel Time</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {places.length > 0 ? (
          places.map((place) => (
            <TableRow key={getRowKey(place)}>
              <TableCell>{place.school || 'Unknown School'}</TableCell>
              <TableCell>{place.place || 'Unknown Place'}</TableCell>
              <TableCell>
                {typeof place.distance === 'number' ? place.distance.toFixed(2) : 'N/A'}
              </TableCell>
              <TableCell>{place.time || 'N/A'}</TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan="4" className="table-cell-centered">
              {loading ? (
                <div className="loading-indicator">
                  <CircularLoader small />
                  <span>Processing data...</span>
                </div>
              ) : 'No results yet'}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

ResultsTable.propTypes = {
  places: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      school: PropTypes.string,
      place: PropTypes.string,
      distance: PropTypes.number,
      time: PropTypes.string
    })
  ).isRequired,
  loading: PropTypes.bool.isRequired,
  selectedAmenity: PropTypes.shape({
    label: PropTypes.string
  }).isRequired
};

ResultsTable.defaultProps = {
  places: []
};