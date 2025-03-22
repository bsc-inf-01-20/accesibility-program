import React from "react";
import { useSchools } from "../Hooks/useSchools";

const SchoolList = () => {
    const { schools, loading, error } = useSchools();

    if (loading) return <p>Loading schools...</p>;
    if (error) return <p className="text-red-500">Error: {error.message}</p>;

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Schools</h2>
            <ul className="list-disc pl-5">
                {schools.map((school, index) => (
                    <li key={index}>{school.name}</li>
                ))}
            </ul>
        </div>
    );
};

export default SchoolList;
