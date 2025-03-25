import { useState, useCallback, useEffect } from "react";
import { useDataQuery } from "@dhis2/app-runtime";

const query = {
    schools: {
        resource: "organisationUnits",
        params: (variables) => ({
            fields: "displayName,geometry",
            page: variables.page,
            pageSize: 50,
            paging: true,
        }),
    },
};

const useFetchSchools = () => {
    const [schools, setSchools] = useState([]); // Holds schools from the current page
    const [currentPage, setCurrentPage] = useState(1); // Tracks the current page
    const [hasMore, setHasMore] = useState(true); // Tracks if there are more pages
    const [loading, setLoading] = useState(false); // Tracks loading state
    const [error, setError] = useState(null); // Tracks errors

    const { refetch } = useDataQuery(query, { lazy: true });

    const fetchNextPage = useCallback(() => {
        // Fetch schools from the next page only when processing is done
        if (!hasMore || loading) return; // Ensure valid conditions for fetching
        setLoading(true); // Start loading

        refetch({ page: currentPage })
            .then((data) => {
                console.log("Raw API Response:", data); // Log raw response for debugging

                if (!data || typeof data !== "object") {
                    throw new Error("Invalid response from DHIS2 API.");
                }

                const schoolsData = data.schools;
                if (!schoolsData || typeof schoolsData !== "object") {
                    throw new Error("Invalid data structure: schools is missing or not an object.");
                }

                const organisationUnits = schoolsData.organisationUnits || [];
                if (!Array.isArray(organisationUnits)) {
                    throw new Error("organisationUnits is missing or not an array.");
                }

                const pointsOnly = organisationUnits.filter(
                    (school) => school.geometry && school.geometry.type === "Point"
                );

                setSchools(pointsOnly); // Replace schools with the new page's data

                if (!schoolsData.pager?.nextPage) {
                    setHasMore(false); // No more pages available
                } else {
                    setCurrentPage((prev) => prev + 1); // Move to the next page
                }
            })
            .catch((err) => {
                setError(err);
                console.error("Error fetching schools:", err);
            })
            .finally(() => {
                setLoading(false); // Stop loading
            });
    }, [currentPage, hasMore, loading, refetch]);

    useEffect(() => {
        if (schools.length === 0 && hasMore) {
            fetchNextPage(); // Automatically fetch the first page
        }
    }, [schools.length, fetchNextPage, hasMore]);

    return {
        schools, // Holds schools only from the current page
        loading, // Indicates fetch state
        error, // Tracks any errors during fetch
        hasMore, // Tracks whether more pages exist
        fetchNextPage, // Function to fetch the next page of schools
    };
};

export default useFetchSchools;