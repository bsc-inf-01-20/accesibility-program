import React from 'react';
import { InputField, Button, Card, Help } from '@dhis2/ui';


/**
 * StudentForm
 *
 * A comprehensive form component for registering students or teachers.
 * Includes fields for personal information, location selection, and validation.
 * Supports both student and teacher registration modes.
 *
 * @component
 * @example
 * return (
 *   <StudentForm
 *     formData={{
 *       firstName: 'John',
 *       lastName: 'Doe',
 *       gender: 'Male',
 *       birthDate: '2000-01-01',
 *       residence: 'Lilongwe',
 *       coordinates: [-13.966, 33.787],
 *       coordinatesText: '13.966° S, 33.787° E'
 *     }}
 *     onInputChange={(field, value) => console.log(field, value)}
 *     onSubmit={(e) => { e.preventDefault(); console.log('Submitted') }}
 *     saving={false}
 *     onMapButtonClick={() => console.log('Open map')}
 *     isValid={true}
 *     dateError={null}
 *     isTeacher={false}
 *   />
 * )
 *
 * @param {Object} props
 * @param {Object} props.formData - Current form values
 * @param {string} props.formData.firstName - Student's first name
 * @param {string} props.formData.lastName - Student's last name
 * @param {string} [props.formData.specialization] - Teacher's subject specialization (when isTeacher=true)
 * @param {string} props.formData.gender - Selected gender
 * @param {string} props.formData.birthDate - Date of birth in YYYY-MM-DD format
 * @param {string} props.formData.residence - Residence location text
 * @param {Array<number>} [props.formData.coordinates] - Latitude/longitude array
 * @param {string} [props.formData.coordinatesText] - Formatted coordinates text
 * @param {Function} props.onInputChange - Callback when any input field changes (fieldName, value)
 * @param {Function} props.onSubmit - Callback when form is submitted
 * @param {boolean} props.saving - Whether form is currently submitting
 * @param {Function} props.onMapButtonClick - Callback when location map button is clicked
 * @param {boolean} props.isValid - Whether all required fields are valid
 * @param {string|null} props.dateError - Error message for date validation
 * @param {boolean} [props.isTeacher=false] - Whether form is in teacher registration mode
 */
export const StudentForm = ({
  formData,
  onInputChange,
  onSubmit,
  saving,
  onMapButtonClick,
  isValid,
  dateError,
  isTeacher
}) => {
  return (
    <form onSubmit={onSubmit} className="registration-form">
      <Card className="form-card">
        <div className="uniform-field">
          <label className="uniform-label required">First Name</label>
          <input
            type="text"
            className="uniform-input"
            value={formData.firstName}
            onChange={(e) => onInputChange('firstName', e.target.value)}
            required
          />
          {formData.firstName && formData.firstName.trim().length < 2 && (
            <Help error>First name must be at least 2 characters</Help>
          )}
        </div>
      </Card>

      <Card className="form-card">
        <div className="uniform-field">
          <label className="uniform-label required">Last Name</label>
          <input
            type="text"
            className="uniform-input"
            value={formData.lastName}
            onChange={(e) => onInputChange('lastName', e.target.value)}
            required
          />
          {formData.lastName && formData.lastName.trim().length < 2 && (
            <Help error>Last name must be at least 2 characters</Help>
          )}
        </div>
      </Card>

      {isTeacher && (
        <Card className="form-card">
          <div className="uniform-field">
            <label className="uniform-label required">Subject Specialization</label>
            <input
              type="text"
              className="uniform-input"
              value={formData.specialization}
              onChange={(e) => onInputChange('specialization', e.target.value)}
              required
            />
            {formData.specialization && formData.specialization.trim().length < 3 && (
              <Help error>Specialization must be at least 3 characters</Help>
            )}
          </div>
        </Card>
      )}

      <Card className="form-card">
        <div className="uniform-field">
          <label className="uniform-label required">Gender</label>
          <select
            className="uniform-input uniform-select"
            value={formData.gender}
            onChange={(e) => onInputChange('gender', e.target.value)}
            required
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </Card>

      <Card className="form-card">
        <div className="uniform-field">
          <label className="uniform-label required">Date of Birth</label>
          <input
            type="date"
            className="uniform-input"
            value={formData.birthDate}
            onChange={(e) => onInputChange('birthDate', e.target.value)}
            required
            max={new Date().toISOString().split('T')[0]}
          />
          {dateError && (
            <Help error>{dateError}</Help>
          )}
        </div>
      </Card>

      <Card className="location-card">
        <div className="uniform-field">
          <label className="uniform-label required">Place of Residence</label>
          <input
            type="text"
            className="uniform-input"
            value={formData.residence}
            readOnly
            placeholder="Select location on map"
          />
          <Button 
            onClick={onMapButtonClick}
            primary
            className="map-button"
            style={{ marginTop: '8px' }}
          >
            {formData.coordinates ? 'Update Location' : 'Select Location'}
          </Button>
          {!formData.residence && (
            <Help error>Please select a location on the map</Help>
          )}
        </div>

        <div className="uniform-field">
          <label className="uniform-label">Coordinates</label>
          <input
            type="text"
            className="uniform-input coordinates-field"
            value={formData.coordinatesText || ''}
            readOnly
            placeholder="Will update automatically when location is selected"
          />
        </div>
      </Card>

      <Button 
        type="submit" 
        primary 
        loading={saving}
        disabled={!isValid || saving}
        className={`submit-button ${isValid ? 'active-button' : ''}`}
        style={{
          cursor: isValid ? 'pointer' : 'not-allowed',
          opacity: isValid ? 1 : 0.7
        }}
      >
        {saving ? 'Registering...' : `Register ${isTeacher ? 'Teacher' : 'Student'}`}
      </Button>
    </form>
  );
};