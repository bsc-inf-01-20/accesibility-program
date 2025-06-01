import React from 'react';
import { NoticeBox, Button } from '@dhis2/ui';

/**
 * RegistrationStatus
 *
 * A component that displays registration status messages - either success or error.
 * Shows a success message with student ID when registration succeeds, or an error message
 * when registration fails. Includes a dismiss button for the success state.
 *
 * @component
 * @example
 * // Success state
 * return (
 *   <RegistrationStatus 
 *     success={true}
 *     createdStudentId="STD12345"
 *     onDismiss={() => console.log('Dismissed')}
 *   />
 * )
 *
 * // Error state
 * return (
 *   <RegistrationStatus 
 *     error={{ message: 'Registration failed' }}
 *     onDismiss={() => console.log('Dismissed')}
 *   />
 * )
 *
 * @param {Object} props
 * @param {Object} [props.error] - Error object containing message to display
 * @param {boolean} [props.success] - Whether registration was successful
 * @param {string} [props.createdStudentId] - The ID of the successfully registered student
 * @param {Function} [props.onDismiss] - Callback when dismiss button is clicked
 */
export const RegistrationStatus = ({ 
  error, 
  success, 
  createdStudentId,
  onDismiss 
}) => {
  if (error) {
    return (
      <NoticeBox error title="Registration Error">
        {error.message}
      </NoticeBox>
    );
  }

  if (success) {
    return (
      <NoticeBox 
        success 
        title="Registration Successful" 
        className="success-notice"
      >
        <div className="success-message">
          <p>Student registered successfully!</p>
          {createdStudentId && (
            <div className="student-id">
              <strong>Student ID:</strong> {createdStudentId}
            </div>
          )}
          <Button small onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </NoticeBox>
    );
  }

  return null;
};