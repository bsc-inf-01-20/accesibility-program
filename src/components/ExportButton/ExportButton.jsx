import { DropdownButton, FlyoutMenu, MenuItem } from '@dhis2/ui'
import PropTypes from 'prop-types'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'

const prepareExportData = (results) =>
  results
    .filter(r => r && r.school && r.place && r.distance && r.time)
    .map(r => ({
      'School Name': r.school,
      'Closest Amenity': r.place,
      'Distance (km)': r.distance,
      'Travel Time': r.time,
      'Amenity Type': r.rawData?.amenityType || ''
    }))

const exportCSV = (data, filename) => {
  const header = Object.keys(data[0])
  const rows = data.map(row => header.map(field => `"${row[field] || ''}"`).join(','))
  const csv = [header.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, `${filename}.csv`)
}

const exportExcel = (data, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Proximity Results')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  saveAs(blob, `${filename}.xlsx`)
}

export const ExportButton = ({ results, amenityType, disabled }) => {
  const cleanData = prepareExportData(results)
  const filename = `Proximity_Results_${amenityType.key}`

  const handleExport = (format) => {
    if (!cleanData.length) {
      alert('No valid results to export.')
      return
    }
    if (format === 'csv') exportCSV(cleanData, filename)
    else if (format === 'excel') exportExcel(cleanData, filename)
  }

  return (
    <DropdownButton
      name="download"
      component={
        <FlyoutMenu>
          <MenuItem label="Export as CSV" onClick={() => handleExport('csv')} />
          <MenuItem label="Export as Excel (.xlsx)" onClick={() => handleExport('excel')} />
        </FlyoutMenu>
      }
      disabled={disabled}
    >
      Download Results
    </DropdownButton>
  )
}

ExportButton.propTypes = {
  results: PropTypes.array.isRequired,
  amenityType: PropTypes.object.isRequired,
  disabled: PropTypes.bool
}
