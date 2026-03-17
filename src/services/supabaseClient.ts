
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://qwualszqafxjorumgttv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3dWFsc3pxYWZ4am9ydW1ndHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDU5MjQsImV4cCI6MjA4OTMyMTkyNH0.cm5J9aQuUz-riX3vBpo-CNp0p5KSFOUT730gbZPXYHk";

export const supabase = createClient(supabaseUrl, supabaseKey);
