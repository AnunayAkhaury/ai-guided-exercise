export type EventType = keyof typeof allAchievements;

type CountAchievement = {
  id: string;
  count: number;
};

type ThresholdAchievement = {
  id: string;
  check: (stats: any) => boolean;
};

type AchievementGroup = 
    | 
        {
            type: "count";
            achievements: CountAchievement[];
        } 
    | 
        {
            type: "thres";
            achievements: ThresholdAchievement[];
        };

export const allAchievements : Record<string, AchievementGroup> = {
    "WORKOUT_COMPLETED": {
        type: "count",
        achievements: [
            {
                id: "FIRST_WORKOUT",
                count: 1,
            },
            {
                id: "THREE_WORKOUTS",
                count: 3,
            },
        ]
    },
    "FEEDBACK_SAVED": {
        type: "thres",
        achievements: [
            {
                id: "100_PUSHUP_SCORE",
                check: (stats: any) => stats.pushup >= 100,
            },
            {
                id: "300_LUNGE_SCORE",
                check: (stats: any) => stats.lunge >= 300,
            },
            {
                id: "1000_PUSHUP_SCORE",
                check: (stats: any) => stats.pushup >= 1000,
            },
            {
                id: "1000_SQUAT_SCORE",
                check: (stats: any) => stats.squat >= 1000,
            },
        ]
    },
};
