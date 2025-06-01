import { SingleSelect, SingleSelectOption } from '@dhis2/ui';
import PropTypes from 'prop-types';
import './AmenitySelector.css';

/**
 * AmenitySelector Component
 *
 * A dropdown selector for choosing an amenity type.
 * Supports customizable options and returns the selected type to the parent via callback.
 *
 * @component
 * @example
 * const options = [
 *   { key: 'market', label: 'Market', queryTag: 'shop', keyword: 'market' },
 *   { key: 'clinic', label: 'Clinic', queryTag: 'healthcare', keyword: 'clinic' }
 * ];
 * return (
 *   <AmenitySelector
 *     selectedType={options[0]}
 *     options={options}
 *     onChange={handleSelect}
 *   />
 * );
 *
 * @param {Object} props
 * @param {{ key: string, label: string }} props.selectedType - The currently selected amenity type.
 * @param {Function} props.onChange - Callback when a new amenity type is selected.
 * @param {Array<{ key: string, label: string, queryTag?: string, keyword?: string }>} props.options - List of amenity options to choose from.
 *
 * @returns {JSX.Element}
 */
export const AmenitySelector = ({ selectedType, onChange, options }) => {
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
      queryTag: PropTypes.string,
      keyword: PropTypes.string
    })
  ).isRequired
};

AmenitySelector.defaultProps = {
  options: []
};
