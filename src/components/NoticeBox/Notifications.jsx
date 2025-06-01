import React from 'react';
import { NoticeBox } from '@dhis2/ui';

/**
 * Notifications
 *
 * Displays real-time notices for errors, invalid data, missing results, and process completion
 * during the school accessibility analysis process.
 *
 * @component
 * @example
 * return (
 *   <Notifications 
 *     error="Something went wrong"
 *     invalidSchools={['School A']}
 *     noResultsSchools={['School B']}
 *     progress={{ isComplete: true, processed: 10 }}
 *     selectedAmenity={{ label: 'Health Center' }}
 *   />
 * )
 *
 * @param {Object} props
 * @param {string} [props.error] - Error message to display if any.
 * @param {string[]} props.invalidSchools - List of schools with invalid coordinates.
 * @param {string[]} props.noResultsSchools - List of schools with no nearby amenities found.
 * @param {{ isComplete: boolean, processed: number }} props.progress - Progress status object.
 * @param {{ label: string }} props.selectedAmenity - The currently selected amenity (e.g., Market, Clinic).
 */
const Notifications = ({ error, invalidSchools, noResultsSchools, progress, selectedAmenity }) => {
  return (
    <div className="notice-container">
      {error && <NoticeBox error title="Error">{error}</NoticeBox>}

      {invalidSchools.length > 0 && (
        <NoticeBox warning title="Notice">
          {invalidSchools.length} schools skipped due to invalid coordinates
        </NoticeBox>
      )}

      {noResultsSchools.length > 0 && (
        <NoticeBox warning title="Notice">
          No {selectedAmenity.label} found near: {noResultsSchools.join(', ')}
        </NoticeBox>
      )}

      {progress.isComplete && (
        <NoticeBox success title="Complete">
          Processed {progress.processed} schools, found {progress.processed - invalidSchools.length - noResultsSchools.length} results for {selectedAmenity.label}
        </NoticeBox>
      )}
    </div>
  );
};

export default Notifications;
