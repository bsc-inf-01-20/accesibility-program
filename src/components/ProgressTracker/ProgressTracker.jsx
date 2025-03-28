import PropTypes from 'prop-types';
import './ProgressTracker.css';

export const ProgressTracker = ({ processed, total }) => {
  const progressPercent = Math.min(100, (processed / Math.max(1, total)) * 100);

  return (
    <div className="progress-container">
      <div className="progress-header">
        <span>Progress</span>
        <span>{Math.round(progressPercent)}%</span>
      </div>
      <div className="progress-bar-outer">
        <div 
          className="progress-bar-inner" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

ProgressTracker.propTypes = {
  processed: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired
};