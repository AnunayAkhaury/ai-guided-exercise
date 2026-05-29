import { allAchievements, type EventType } from "@/utils/achievements-db.js";
import { db } from "./Firebase/firebase-service.js";
import { sendNotificationToUsers } from "./notification-service.js";

export async function checkAchievement(event: EventType, payload: any) {
    if (allAchievements[event]!.type === "count") {
        for (const a of allAchievements[event]!.achievements) {        
            const userToAchievementSnapshot = await db
                .collection("users_to_achievements")
                .where("user_id", "==", payload.uid)
                .where("achievement_id", "==", a.id)
                .limit(1)
                .get();

            let achievementDocRef;
            let achievementData;

            // check if the in-progress/completed achievement exists for the user
            if (userToAchievementSnapshot.empty) {
                // create achievement
                achievementDocRef = await db.collection("users_to_achievements").add({
                    user_id: payload.uid,
                    achievement_id: a.id,
                    count: 0,
                    completed: false,
                    created_at: new Date(),
                    updated_at: new Date(),
                });
            } else {
                // extract data from existing achievement
                const existingDoc = userToAchievementSnapshot.docs[0];
                achievementDocRef = existingDoc?.ref;
                achievementData = existingDoc?.data();
            }

            // increment progress count
            let newCount = (achievementData?.count ?? 0) + 1;
            const completed = newCount >= a.count;

            // save updated progress
            await achievementDocRef?.update({
                count: newCount,
                completed,
                updated_at: new Date(),
            });

            // If just completed (not previously completed), send notification
            if (completed && !achievementData?.completed) {
                console.log(
                    `User ${payload.uid} completed achievement ${a.id}`
                );

                sendNotificationToUsers([payload.uid], {
                    title: 'Count Achievement',
                    body: 'Good job!',
                });
            }
        }
    } else if (allAchievements[event]!.type == "thres") {
        for (const a of allAchievements[event]!.achievements) {
            const userToAchievementSnapshot = await db
                .collection("users_to_achievements")
                .where("user_id", "==", payload.uid)
                .where("achievement_id", "==", a.id)
                .limit(1)
                .get();

            if (userToAchievementSnapshot.empty && a.check(payload)) {
                await db.collection("users_to_achievements").add({
                    user_id: payload.uid,
                    achievement_id: a.id,
                    completed: true,
                    created_at: new Date(),
                    updated_at: new Date(),
                })

                console.log(
                    `User ${payload.uid} completed achievement ${a.id}`
                );

                sendNotificationToUsers([payload.uid], {
                    title: 'Threshold Achievement',
                    body: 'Good job!',
                });
            }
        }
    }
}
