import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  label?: string;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  label = 'Date Range'
}: DateRangePickerProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <span className="text-xs font-bold text-brand-dark px-1">{label}</span>}
      <div className="flex items-center gap-2 bg-brand-bg border border-brand-outline rounded-xl p-1 focus-within:border-brand-primary transition-colors">
        <div className="pl-2">
          <Calendar className="w-4 h-4 text-brand-gray" />
        </div>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="flex-1 h-10 bg-transparent text-sm font-semibold text-brand-dark focus:outline-none min-w-0"
          placeholder="Start"
        />
        <span className="text-brand-gray font-bold text-sm px-1">-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="flex-1 h-10 bg-transparent text-sm font-semibold text-brand-dark focus:outline-none min-w-0"
          placeholder="End"
        />
      </div>
    </div>
  );
}
