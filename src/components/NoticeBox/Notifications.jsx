const Notifications = ({ error, invalidSchools, noResultsSchools, progress, selectedAmenity }) => (
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
          Processed {progress.processed} schools, found {allResults.length} results for {selectedAmenity.label}
        </NoticeBox>
      )}
    </div>
  );