import { SingleSelect, SingleSelectOption } from '@dhis2/ui';
import PropTypes from 'prop-types';
import './TravelModeSelector.css';

export const TravelModeSelector = ({ selectedMode, onChange }) => {
  const modes = [
    { key: 'walking', label: 'Walking' },
    { key: 'driving', label: 'Driving' }
  ];

  return (
    <div className="travel-mode-selector">
      <label>Travel Mode</label>
      <SingleSelect
        selected={selectedMode}
        onChange={({ selected }) => onChange(selected)}
        dataTest="travel-mode-selector"
      >
        {modes.map(mode => (
          <SingleSelectOption 
            key={mode.key} 
            value={mode.key} 
            label={mode.label} 
          />
        ))}
      </SingleSelect>
    </div>
  );
};

TravelModeSelector.propTypes = {
  selectedMode: PropTypes.oneOf(['walking', 'driving']).isRequired,
  onChange: PropTypes.func.isRequired
};

TravelModeSelector.defaultProps = {
  selectedMode: 'walking'
};