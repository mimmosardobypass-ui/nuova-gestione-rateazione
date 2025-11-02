-- Create free_notes table for generic reminders (not linked to rateations)
CREATE TABLE public.free_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT free_notes_title_min_length CHECK (char_length(title) >= 1),
  CONSTRAINT free_notes_title_max_length CHECK (char_length(title) <= 100),
  CONSTRAINT free_notes_content_min_length CHECK (char_length(content) >= 1),
  CONSTRAINT free_notes_content_max_length CHECK (char_length(content) <= 2000)
);

-- Enable Row Level Security
ALTER TABLE public.free_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own free notes"
  ON public.free_notes FOR SELECT
  USING (owner_uid = auth.uid());

CREATE POLICY "Users can create their own free notes"
  ON public.free_notes FOR INSERT
  WITH CHECK (owner_uid = auth.uid());

CREATE POLICY "Users can update their own free notes"
  ON public.free_notes FOR UPDATE
  USING (owner_uid = auth.uid());

CREATE POLICY "Users can delete their own free notes"
  ON public.free_notes FOR DELETE
  USING (owner_uid = auth.uid());

-- Index for performance (ordered by updated_at DESC for recent notes)
CREATE INDEX idx_free_notes_owner_updated 
  ON public.free_notes(owner_uid, updated_at DESC);

-- Trigger for automatic updated_at timestamp
CREATE TRIGGER update_free_notes_updated_at
  BEFORE UPDATE ON public.free_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.free_notes IS 'Free-form notes/reminders not linked to specific rateations';
COMMENT ON COLUMN public.free_notes.title IS 'Note title (max 100 chars)';
COMMENT ON COLUMN public.free_notes.content IS 'Note content (max 2000 chars)';