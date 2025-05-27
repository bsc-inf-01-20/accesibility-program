import React from 'react';
import { NoticeBox, Button } from '@dhis2/ui';

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