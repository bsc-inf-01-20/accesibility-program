// src/utils/ExportUtils.js

export const generateCSV = (data, amenityType) => {
    const headers = [
      'School Name',
      `Closest ${amenityType.label}`,
      'Distance (km)',
      'Travel Time',
      'School Latitude',
      'School Longitude',
      'Amenity Latitude',
      'Amenity Longitude'
    ];
  
    const csvRows = [
      headers.join(','),
      ...data.map(item => 
        [
          `"${item.school.replace(/"/g, '""')}"`,
          `"${item.place.replace(/"/g, '""')}"`,
          item.distance,
          `"${item.time}"`,
          item.rawData.schoolCoords[1],
          item.rawData.schoolCoords[0],
          item.rawData.placeCoords[1],
          item.rawData.placeCoords[0]
        ].join(',')
      )
    ];
  
    return csvRows.join('\n');
  };
  
  export const generatePDFContent = (data, amenityType) => {
    // This would be implemented using a PDF library like jsPDF
    // Return configuration object for PDF generation
    return {
      title: `School Proximity Analysis - ${amenityType.label}`,
      headers: ['School', amenityType.label, 'Distance', 'Time'],
      rows: data.map(item => [
        item.school,
        item.place,
        item.distance,
        item.time
      ])
    };
  };