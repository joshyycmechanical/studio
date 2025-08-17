
import type { WorkOrderPriority } from '@/types/work-order';

/**
 * Returns Tailwind CSS classes for styling elements based on work order priority.
 * @param priority The priority of the work order.
 * @returns A string of CSS classes.
 */
export const getPriorityClasses = (priority?: WorkOrderPriority | null): string => {
    switch (priority) {
        case 'emergency':
            return 'border-destructive bg-destructive/10 text-destructive-foreground';
        case 'high':
            return 'border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-200';
        case 'medium':
            return 'border-yellow-500 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200';
        case 'low':
            return 'border-blue-500 bg-blue-500/10 text-blue-800 dark:text-blue-200';
        default:
            return 'border-border bg-card';
    }
};
