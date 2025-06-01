import { NoticeBox } from "@dhis2/ui";
import PropTypes from 'prop-types';
import './BatchStatus.css';

/**
 * BatchStatus Component
 *
 * Displays a list of school names that are currently being processed in a batch.
 * Rendered inside a NoticeBox with informational styling.
 *
 * @component
 * @example
 * return (
 *   <BatchStatus currentBatch={["School A", "School B"]} />
 * )
 *
 * @param {Object} props
 * @param {string[]} props.currentBatch - Array of school names in the current batch.
 */
export const BatchStatus = ({ currentBatch }) => (
    <NoticeBox info title="Current Batch">
        <ul className="current-batch-list">
            {currentBatch.map((school, i) => (
                <li key={i} className="current-batch-item">
                    {school}
                </li>
            ))}
        </ul>
    </NoticeBox>
);

BatchStatus.propTypes = {
    /** Array of school names in the current batch */
    currentBatch: PropTypes.arrayOf(PropTypes.string).isRequired
};
