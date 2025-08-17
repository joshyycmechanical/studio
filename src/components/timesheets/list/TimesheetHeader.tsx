
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { User, Calendar } from 'lucide-react';
import type { UserProfile } from '@/types/user';

interface TimesheetHeaderProps {
  selectedTechnician: string;
  onTechnicianChange: (value: string) => void;
  dateRange: { from?: Date; to?: Date };
  onDateChange: (dateRange: { from?: Date; to?: Date }) => void;
  users: UserProfile[];
  canViewAllTimesheets: boolean;
}

export function TimesheetHeader({
  selectedTechnician,
  onTechnicianChange,
  dateRange,
  onDateChange,
  users,
  canViewAllTimesheets
}: TimesheetHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
      <div>
        <h1 className="font-semibold text-lg md:text-2xl">Timesheets</h1>
        <p className="text-sm text-muted-foreground">Review, approve, and manage time entries.</p>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {canViewAllTimesheets && (
          <Select value={selectedTechnician} onValueChange={onTechnicianChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <User className="mr-2 h-4"/>
              <SelectValue placeholder="Select Technician" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Technicians</SelectItem>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
         <div className="flex items-center gap-2">
           <Calendar className="h-4 w-4 text-muted-foreground"/>
           <DateRangePicker date={dateRange} onDateChange={onDateChange}/>
         </div>
      </div>
    </div>
  );
}
