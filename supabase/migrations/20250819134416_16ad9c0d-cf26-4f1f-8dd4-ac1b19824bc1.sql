-- Fix RLS security issue for installment_payments table
ALTER TABLE installment_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for installment_payments table
CREATE POLICY "Users can view their own installment payments" 
ON installment_payments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM installments i 
  WHERE i.id = installment_payments.installment_id 
  AND i.owner_uid = auth.uid()
));

CREATE POLICY "Users can create payments for their installments" 
ON installment_payments 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM installments i 
  WHERE i.id = installment_payments.installment_id 
  AND i.owner_uid = auth.uid()
));

CREATE POLICY "Users can update their own installment payments" 
ON installment_payments 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM installments i 
  WHERE i.id = installment_payments.installment_id 
  AND i.owner_uid = auth.uid()
));

CREATE POLICY "Users can delete their own installment payments" 
ON installment_payments 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM installments i 
  WHERE i.id = installment_payments.installment_id 
  AND i.owner_uid = auth.uid()
));