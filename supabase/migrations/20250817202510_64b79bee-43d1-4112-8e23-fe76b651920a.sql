-- Create table for PDF import profiles (mapping configurations)
CREATE TABLE public.pdf_import_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_uid UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  column_mappings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pdf_import_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own profiles" 
ON public.pdf_import_profiles 
FOR SELECT 
USING (auth.uid() = owner_uid);

CREATE POLICY "Users can create their own profiles" 
ON public.pdf_import_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = owner_uid);

CREATE POLICY "Users can update their own profiles" 
ON public.pdf_import_profiles 
FOR UPDATE 
USING (auth.uid() = owner_uid);

CREATE POLICY "Users can delete their own profiles" 
ON public.pdf_import_profiles 
FOR DELETE 
USING (auth.uid() = owner_uid);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pdf_import_profiles_updated_at
BEFORE UPDATE ON public.pdf_import_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();