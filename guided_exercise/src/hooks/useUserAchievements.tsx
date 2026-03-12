import { useEffect, useState } from "react";
import { getAchievements } from "../api/Firebase/firebase-user";

export default function useUserAchievements() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAchievements () {
            setData(await getAchievements() ?? []);
            setLoading(false);
        }
        
        fetchAchievements();
    }, [])

    return { data, loading };
}