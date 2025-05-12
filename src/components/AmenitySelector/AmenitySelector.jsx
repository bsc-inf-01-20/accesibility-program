import { SingleSelect, SingleSelectOption } from '@dhis2/ui';
import PropTypes from 'prop-types';
import './AmenitySelector.css';

export const AmenitySelector = ({ selectedType, onChange, options }) => {
  // Handle the case where options might be undefined
  const availableOptions = options || [];

  return (
    <div className="amenity-selector">
      <label>Amenity Type</label>
      <SingleSelect
        selected={selectedType?.key || ''}
        onChange={({ selected }) => {
          const selectedOption = availableOptions.find(t => t.key === selected);
          if (selectedOption) {
            onChange(selectedOption);
          }
        }}
        label="Select amenity type"
        dataTest="amenity-type-selector"
      >
        {availableOptions.map(type => (
          <SingleSelectOption 
            key={type.key} 
            value={type.key} 
            label={type.label} 
          />
        ))}
      </SingleSelect>
    </div>
  );
};

AmenitySelector.propTypes = {
  selectedType: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      // Add other expected properties here
      queryTag: PropTypes.string,
      keyword: PropTypes.string
    })
  ).isRequired
};

AmenitySelector.defaultProps = {
  options: []
};