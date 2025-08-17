
/**
 * Represents the data structure for platform-wide statistics.
 */
export interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  pausedCompanies: number;
  totalActiveUsers: number;
  subscriptions: { [plan: string]: number };
}
