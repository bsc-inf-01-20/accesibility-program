// src/utils/exportUtils.js

export const generateCSV = (data = [], amenityType = { label: 'Amenity' }) => {
  // Validate and normalize input
  const safeData = Array.isArray(data) ? data : [];
  const safeAmenity = amenityType?.label ? amenityType : { label: 'Amenity' };

  // CSV Headers (exactly as requested)
  const headers = [
    'School Name',
    `Closest ${safeAmenity.label}`,
    'Distance (km)',
    'Travel Time',
    'School Latitude',
    'School Longitude',
    'Amenity Latitude',
    'Amenity Longitude'
  ];

  // Process each row with guaranteed values
  const csvRows = safeData.map(item => {
    // Extract coordinates with multiple fallbacks
    const schoolCoords = [
      item.schoolLocation?.lat ?? 
      item.rawData?.schoolCoords?.[1] ?? 
      item.schoolCoords?.[1] ?? 
      '',
      item.schoolLocation?.lng ?? 
      item.rawData?.schoolCoords?.[0] ?? 
      item.schoolCoords?.[0] ?? 
      ''
    ];

    const amenityCoords = [
      item.location?.lat ?? 
      item.rawData?.placeCoords?.[1] ?? 
      item.placeCoords?.[1] ?? 
      '',
      item.location?.lng ?? 
      item.rawData?.placeCoords?.[0] ?? 
      item.placeCoords?.[0] ?? 
      ''
    ];

    // Format each value with proper escaping and fallbacks
    return [
      `"${(item.school || 'Unknown School').replace(/"/g, '""')}"`,
      `"${(item.place || 'Unknown ' + safeAmenity.label).replace(/"/g, '""')}"`,
      item.distance ? Number(item.distance).toFixed(2) : '0.00',
      `"${item.time || 'N/A'}"`,
      schoolCoords[0] ? Number(schoolCoords[0]).toFixed(6) : '',
      schoolCoords[1] ? Number(schoolCoords[1]).toFixed(6) : '',
      amenityCoords[0] ? Number(amenityCoords[0]).toFixed(6) : '',
      amenityCoords[1] ? Number(amenityCoords[1]).toFixed(6) : ''
    ].join(',');
  });

  // Combine headers and rows
  return [headers.join(','), ...csvRows].join('\n');
};