import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { RateationRow } from '../types';

interface MigrationStatusBadgeProps {
  row: RateationRow;
  onOpenMigration?: () => void;
  onViewTarget?: (targetId: number) => void;
}

export const MigrationStatusBadge: React.FC<MigrationStatusBadgeProps> = ({
  row,
  onOpenMigration,
  onViewTarget
}) => {
  const { rq_migration_status, migrated_debt_numbers, remaining_debt_numbers, rq_target_ids } = row;

  if (!row.is_pagopa || rq_migration_status === 'none') {
    return null;
  }

  const renderMigrationDetails = () => {
    const hasTargets = rq_target_ids && rq_target_ids.length > 0;
    
    return (
      <div className="flex items-center gap-2 mt-1 text-xs">
        {migrated_debt_numbers && migrated_debt_numbers.length > 0 && (
          <span className="text-muted-foreground">
            Migrate: {migrated_debt_numbers.join(', ')}
          </span>
        )}
        {remaining_debt_numbers && remaining_debt_numbers.length > 0 && (
          <span className="text-muted-foreground">
            Residue: {remaining_debt_numbers.join(', ')}
          </span>
        )}
        {hasTargets && (
          <div className="flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            {rq_target_ids.map((targetId, index) => (
              <Button
                key={targetId}
                variant="ghost"
                size="sm"
                className="h-4 px-1 text-xs"
                onClick={() => onViewTarget?.(targetId)}
              >
                RQ #{targetId}
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <Badge 
        variant={rq_migration_status === 'full' ? 'default' : 'secondary'}
        className="cursor-pointer"
        onClick={onOpenMigration}
      >
        {rq_migration_status === 'full' ? 'Migrata a RQ' : 'Parzialmente migrata a RQ'}
      </Badge>
      {renderMigrationDetails()}
    </div>
  );
};