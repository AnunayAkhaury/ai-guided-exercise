import { useEffect, useState } from "react";
import { getAchievements } from "../api/Firebase/firebase-user";
import { useUserStore } from "../store/userStore";

export default function useUserAchievements() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const uid = useUserStore((state) => state.uid);

    useEffect(() => {
        async function fetchAchievements () {
            setData(await getAchievements() ?? []);
            setLoading(false);
        }
        
        if (!uid) return;
        fetchAchievements();
    }, [uid])

    return { data, loading };
}