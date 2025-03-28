import {NoticeBox} from "@dhis2/ui";
import PropTypes from 'prop-types';
import './BatchStatus.css';

export const BatchStatus = ({currentBatch}) => (
    <NoticeBox info title= "Current Batch">
        <ul className="current-batch-list">
            {currentBatch.map((school, i) => (
                <li key={i} className="current-batch-item" >
                    {school}
                </li>
            ))}
        </ul>
    </NoticeBox>
);

BatchStatus.propTypes = {
   currentBatch: PropTypes.array.isRequired 
}