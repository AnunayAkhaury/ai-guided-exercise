import { useEffect, useState } from "react";
import { getAchievements } from "../api/user";

export default function useRecording(id: string) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        async function fetchRecording () {
            setData(await getRecording(id) ?? []);
            setLoading(false);
        }
        
        fetchRecording();
    }, [])

    return { data, loading, error };
}