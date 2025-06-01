import { SingleSelect, SingleSelectOption } from '@dhis2/ui';
import PropTypes from 'prop-types';
import './TravelModeSelector.css';

/**
 * TravelModeSelector
 *
 * A dropdown selector component for choosing between different travel modes (walking/driving).
 * Provides a clean UI for selecting transportation methods with proper type validation.
 *
 * @component
 * @example
 * return (
 *   <TravelModeSelector
 *     selectedMode="walking"
 *     onChange={(mode) => console.log('Selected mode:', mode)}
 *   />
 * )
 *
 * @param {Object} props
 * @param {'walking'|'driving'} [props.selectedMode="walking"] - Currently selected travel mode
 * @param {Function} props.onChange - Callback when travel mode is changed (receives new mode as argument)
 */
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
  /** Currently selected travel mode */
  selectedMode: PropTypes.oneOf(['walking', 'driving']).isRequired,
  /** Callback when travel mode is changed */
  onChange: PropTypes.func.isRequired
};

TravelModeSelector.defaultProps = {
  selectedMode: 'walking'
};