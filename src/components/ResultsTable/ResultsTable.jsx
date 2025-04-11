import { Table, TableBody, TableCell, TableHead, TableRow, CircularLoader } from '@dhis2/ui';
import PropTypes from "prop-types";
import './ResultsTable.css';

export const ResultsTable = ({places, loading, selectedAmenity}) => (
    <Table className="results-table">
      <TableHead>
        <TableRow>
          <TableCell className="table-header-cell">School Name</TableCell>
          <TableCell className="table-header-cell">Closest {selectedAmenity.label}</TableCell>
          <TableCell className="table-header-cell">Distance (km)</TableCell>
          <TableCell className="table-header-cell">Travel Time</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {places.length > 0 ? (
          places.map((place) => (
            <TableRow key={place.id}>
              <TableCell>{place.school}</TableCell>
              <TableCell>{place.place}</TableCell>
              <TableCell>{place.distance}</TableCell>
              <TableCell>{place.time}</TableCell>
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
  
  ResultsTable.propTypes = {
    places: PropTypes.array.isRequired,
    loading: PropTypes.bool.isRequired,
    selectedAmenity: PropTypes.object.isRequired
  };