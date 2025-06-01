import { DropdownButton, FlyoutMenu, MenuItem } from '@dhis2/ui'
import PropTypes from 'prop-types'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'

/**
 * Prepares exportable data from proximity results.
 * Filters out invalid entries and maps to a user-friendly format.
 *
 * @param {Array<Object>} results - The raw proximity results.
 * @returns {Array<Object>} Cleaned data for export.
 */
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

/**
 * Exports data as CSV file.
 *
 * @param {Array<Object>} data - The cleaned data to export.
 * @param {string} filename - Name of the file (without extension).
 */
const exportCSV = (data, filename) => {
  const header = Object.keys(data[0])
  const rows = data.map(row => header.map(field => `"${row[field] || ''}"`).join(','))
  const csv = [header.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, `${filename}.csv`)
}

/**
 * Exports data as Excel (.xlsx) file.
 *
 * @param {Array<Object>} data - The cleaned data to export.
 * @param {string} filename - Name of the file (without extension).
 */
const exportExcel = (data, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Proximity Results')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  saveAs(blob, `${filename}.xlsx`)
}

/**
 * ExportButton Component
 *
 * A dropdown export button that lets users export proximity results
 * to either CSV or Excel format.
 *
 * @component
 * @example
 * return (
 *   <ExportButton
 *     results={proximityResults}
 *     amenityType={{ key: 'market', label: 'Market' }}
 *     disabled={false}
 *   />
 * )
 *
 * @param {Object} props
 * @param {Array<Object>} props.results - The proximity results to export.
 * @param {Object} props.amenityType - The selected amenity type object.
 * @param {boolean} [props.disabled] - Whether the export button is disabled.
 */
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
  /** Proximity results to be exported */
  results: PropTypes.arrayOf(PropTypes.object).isRequired,
  /** Amenity type object (must include a `key`) */
  amenityType: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string
  }).isRequired,
  /** Disable the export button */
  disabled: PropTypes.bool
}
