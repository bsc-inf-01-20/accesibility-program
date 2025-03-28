import { SingleSelect, SingleSelectOption } from '@dhis2/ui';
import PropTypes from 'prop-types';
import './AmenitySelector.css';

export const AmenitySelector = ({ selectedType, onChange, options }) => (
  <SingleSelect
    selected={selectedType.key}
    onChange={({ selected }) => onChange(options.find(t => t.key === selected))}
    label="Select amenity type"
  >
    {options.map(type => (
      <SingleSelectOption key={type.key} value={type.key} label={type.label} />
    ))}
  </SingleSelect>
);

AmenitySelector.propTypes = {
  selectedType: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array.isRequired
};