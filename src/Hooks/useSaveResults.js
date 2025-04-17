import { useState } from 'react'

export const useSaveResults = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)

  const save = async (results, selectedAmenity) => {
    setLoading(true)
    setError(null)
    const programId = 'ejitA2KBITf'
    const token = process.env.REACT_APP_DHIS2_PAT
    const dhis2Url = process.env.REACT_APP_DHIS2_URL

    const events = results.map((r) => ({
      program: programId,
      orgUnit: r.rawData.orgUnit,
      eventDate: new Date().toISOString(),
      status: 'COMPLETED',
      dataValues: [
        { dataElement: 'AqOtFClPCQZ', value: r.school },
        { dataElement: 'NrXEKgCUl0t', value: r.place },
        { dataElement: 'Uq054liD617', value: r.distance },
        { dataElement: 'Idha4EUfeer', value: r.time },
        { dataElement: 'GEVgvLyVThn', value: selectedAmenity.label }
      ]
    }))

    try {
      const res = await fetch(`${dhis2Url}/api/events`, {
        method: 'POST',
        headers: {
          'Authorization': `ApiToken ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events })
      })

      const text = await res.text()
      let json

      try {
        json = JSON.parse(text)
      } catch {
        json = { raw: text || 'No response body' }
      }

      if (!res.ok) throw new Error(JSON.stringify(json))

      setResponse(json)
      return json
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    save,
    loading,
    error,
    response
  }
}
