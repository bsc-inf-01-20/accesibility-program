import { useDataQuery } from "@dhis2/app-runtime";
import { useState, useCallback, useEffect } from "react";

// Define types
interface Geometry {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
}

interface OrganisationUnit {
    displayName: string;
    geometry?: Geometry;
}

interface Pager {
    page?: number;
    pageSize?: number;
    total?: number;
    nextPage?: string;
}

interface QueryResponse {
    schools?: {
        organisationUnits?: OrganisationUnit[];
        pager?: Pager;
    };
}

interface QueryVariables {
    page: number;
}

// Define the query correctly
const query = {
    schools: {
        resource: "organisationUnits",
        params: (variables: QueryVariables) => ({
            fields: "displayName,geometry",
            page: variables.page,
            pageSize: 50,
            paging: true,
        }),
    },
};

const useFetchSchools = () => {
    const [schools, setSchools] = useState<OrganisationUnit[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Explicitly type response
    const { refetch } = useDataQuery<QueryResponse>(query, { lazy: true });

    const fetchNextPage = useCallback(() => {
        if (!hasMore || loading) return;
        setLoading(true);

        refetch({ page: currentPage })
            .then((data) => {
                console.log("Raw API Response:", data); // Debugging log

                if (!data || typeof data !== "object") {
                    throw new Error("Invalid response from DHIS2 API.");
                }

                // Ensure schools exist and is an object
                const schoolsData = data.schools as QueryResponse["schools"];
                if (!schoolsData || typeof schoolsData !== "object") {
                    throw new Error("Invalid data structure: schools is missing or not an object.");
                }

                if (!schoolsData.organisationUnits || !Array.isArray(schoolsData.organisationUnits)) {
                    throw new Error("organisationUnits is missing or not an array.");
                }

                const pointsOnly = schoolsData.organisationUnits.filter(
                    (school) => school.geometry && school.geometry.type === "Point"
                );

                setSchools((prev) => [...prev, ...pointsOnly]);

                if (!schoolsData.pager?.nextPage) {
                    setHasMore(false);
                } else {
                    setCurrentPage((prev) => prev + 1);
                }
            })
            .catch((err) => {
                setError(err);
                console.error("Error fetching schools:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [hasMore, loading, currentPage, refetch]);

    useEffect(() => {
        if (schools.length === 0) {
            fetchNextPage();
        }
    }, []);

    return {
        schools,
        loading,
        error,
        hasMore,
        fetchNextPage,
    };
};

export default useFetchSchools;
