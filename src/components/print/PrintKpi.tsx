import React from "react";

interface PrintKpiProps {
  label: string;
  value: string;
  className?: string;
}

export function PrintKpi({ label, value, className = "" }: PrintKpiProps) {
  return (
    <div className={`print-kpi ${className}`}>
      <div className="print-kpi-label">{label}</div>
      <div className="print-kpi-value">{value}</div>
    </div>
  );
}