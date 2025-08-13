-- Fix RLS policies for rateation_types table
-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "types_owner_rw" ON rateation_types;

-- Create separate policies: read for authenticated users, write for owners
CREATE POLICY "rateation_types_read_authenticated" 
ON rateation_types 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "rateation_types_owner_write" 
ON rateation_types 
FOR ALL 
TO authenticated 
USING (owner_uid = auth.uid()) 
WITH CHECK (owner_uid = auth.uid());