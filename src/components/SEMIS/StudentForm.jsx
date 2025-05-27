import React from 'react';
import { InputField, Button, Card, Help } from '@dhis2/ui';

export const StudentForm = ({
  formData,
  onInputChange,
  onSubmit,
  saving,
  success,
  onMapButtonClick,
  isValid
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
          {formData.birthDate && (
            <Help>
              {(() => {
                const today = new Date();
                const birthDate = new Date(formData.birthDate);
                const ageInYears = (today - birthDate) / (1000 * 60 * 60 * 24 * 365);
                
                if (birthDate > today) {
                  return 'Birth date cannot be in the future';
                } else if (ageInYears < 4) {
                  return 'Student must be at least 4 years old';
                }
                return 'Valid birth date';
              })()}
            </Help>
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
        icon={success ? "check" : null}
        className={`submit-button ${isValid ? 'active-button' : ''}`}
        style={{
          cursor: isValid ? 'pointer' : 'not-allowed',
          opacity: isValid ? 1 : 0.7
        }}
      >
        {saving ? 'Registering...' : 'Register Student'}
      </Button>
    </form>
  );
};