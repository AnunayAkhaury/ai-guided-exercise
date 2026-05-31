import type { EventType } from "@/utils/achievements-db.js";
import { checkAchievement } from "./achievement-service.js";

class EventBus {
    emit(event: EventType, payload: any) {
        checkAchievement(event, payload)
        // Future, add analytics or other event-dependent services
    }
}

export const eventBus = new EventBus()
