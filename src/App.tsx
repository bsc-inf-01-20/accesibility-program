import React, { useEffect } from 'react';
import useFetchSchools from './Hooks/useFetchSchools';


const App: React.FC = () => {
    const { schools, loading, error, hasMore, fetchNextPage } = useFetchSchools();

    useEffect(() => {
        // Trigger the first fetch only on mount
        if (schools.length === 0) {
            fetchNextPage();
        }
    }, [schools.length, fetchNextPage]);

    return (
        <div className="app-container">
            <header>
                <h1>School Finder App</h1>
            </header>
            <main>
                {error && <p>Error: {error.message}</p>}
                <ul>
                    {schools.map((school, index) => (
                        <li key={index}>
                            <strong>{school.displayName}</strong>
                            {school.geometry ? (
                                <p>
                                    Lat: {school.geometry.coordinates[1]}, Lon: {school.geometry.coordinates[0]}
                                </p>
                            ) : (
                                <p>Coordinates not available</p>
                            )}
                        </li>
                    ))}
                </ul>
                {loading && <p>Loading...</p>}
                {hasMore && !loading && (
                    <button onClick={fetchNextPage}>Load More</button>
                )}
                {!hasMore && <p>All schools loaded.</p>}
            </main>
        </div>
    );
};

export default App;
