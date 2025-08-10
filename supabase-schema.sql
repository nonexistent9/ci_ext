-- Supabase Schema for CI Feature Extractor
-- This schema stores user analyses for later retrieval and comparison

-- Create analyses table to store user's competitive intelligence analyses
CREATE TABLE IF NOT EXISTS analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Analysis metadata
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('feature_extraction', 'pricing_analysis', 'general')),
  
  -- Analysis content
  content TEXT NOT NULL, -- The full analysis report
  page_data JSONB, -- Original page data (title, headings, buttons, etc.)
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Optional user categorization
  tags TEXT[], -- User-defined tags for organization
  category TEXT, -- User-defined category
  is_favorite BOOLEAN DEFAULT FALSE,
  
  -- Analysis metadata
  model_used TEXT, -- OpenAI model used for analysis
  token_count INTEGER, -- Approximate token count
  
  -- Indexes for faster queries
  CONSTRAINT analyses_user_url_unique UNIQUE (user_id, url)
);

-- Create index for efficient querying by user
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_domain ON analyses(domain);
CREATE INDEX IF NOT EXISTS idx_analyses_type ON analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analyses_tags ON analyses USING GIN(tags);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create analysis_sessions table for tracking analysis sessions/projects
CREATE TABLE IF NOT EXISTS analysis_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session metadata
  name TEXT NOT NULL,
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table to group analyses into sessions
CREATE TABLE IF NOT EXISTS session_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(session_id, analysis_id)
);

-- Row Level Security (RLS) policies
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_analyses ENABLE ROW LEVEL SECURITY;

-- Users can only see their own analyses
CREATE POLICY "Users can view own analyses" ON analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses" ON analyses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses" ON analyses
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions" ON analysis_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON analysis_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON analysis_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON analysis_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only manage session_analyses for their own sessions
CREATE POLICY "Users can view own session analyses" ON session_analyses
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session analyses" ON session_analyses
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own session analyses" ON session_analyses
  FOR DELETE USING (
    session_id IN (
      SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
    )
  );

-- Create helpful views
CREATE OR REPLACE VIEW user_analysis_summary AS
SELECT 
  u.id as user_id,
  u.email,
  COUNT(a.id) as total_analyses,
  COUNT(CASE WHEN a.analysis_type = 'feature_extraction' THEN 1 END) as feature_analyses,
  COUNT(CASE WHEN a.analysis_type = 'pricing_analysis' THEN 1 END) as pricing_analyses,
  COUNT(CASE WHEN a.is_favorite = true THEN 1 END) as favorite_analyses,
  MAX(a.created_at) as last_analysis_date,
  COUNT(DISTINCT a.domain) as unique_domains_analyzed
FROM auth.users u
LEFT JOIN analyses a ON u.id = a.user_id
GROUP BY u.id, u.email;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON analyses TO authenticated;
GRANT ALL ON analysis_sessions TO authenticated;
GRANT ALL ON session_analyses TO authenticated;
GRANT SELECT ON user_analysis_summary TO authenticated;

-- =====================
-- Chat storage (dedicated)
-- =====================

-- Threads
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  metadata JSONB,
  model_used TEXT,
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "read own chat threads" ON chat_threads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "insert own chat threads" ON chat_threads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "update own chat threads" ON chat_threads
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "delete own chat threads" ON chat_threads
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "read own chat messages" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "insert own chat messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "delete own chat messages" ON chat_messages
  FOR DELETE USING (auth.uid() = user_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at);

-- Grants
GRANT ALL ON chat_threads TO authenticated;
GRANT ALL ON chat_messages TO authenticated;