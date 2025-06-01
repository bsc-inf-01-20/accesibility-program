import React from 'react';
import PropTypes from 'prop-types';
import './ProgressTracker.css';

/**
 * ProgressTracker
 *
 * A visual progress indicator that displays how many schools have been processed
 * out of the total number. It shows both a percentage and a progress bar.
 *
 * @component
 * @example
 * return (
 *   <ProgressTracker processed={30} total={100} />
 * )
 *
 * @param {Object} props
 * @param {number} props.processed - The number of schools that have been processed so far.
 * @param {number} props.total - The total number of schools to be processed.
 */
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
