
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://xifvgwyskhfbnsvydobg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnZnd3lza2hmYm5zdnlkb2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1OTMsImV4cCI6MjA3OTMwNzU5M30.P-eXiEQZOXP4fIyaguoGLvmSn1HY_Q3ij0sWqXCAM1M";

export const supabase = createClient(supabaseUrl, supabaseKey);
