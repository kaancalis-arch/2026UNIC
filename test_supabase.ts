
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://qwualszqafxjorumgttv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3dWFsc3pxYWZ4am9ydW1ndHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDU5MjQsImV4cCI6MjA4OTMyMTkyNH0.cm5J9aQuUz-riX3vBpo-CNp0p5KSFOUT730gbZPXYHk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log("Checking Supabase connection...");
  const tables = ['student_profiles', 'countries', 'universities', 'tuition_list', 'students'];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`Table '${table}': NOT FOUND or error (${error.message})`);
      } else {
        console.log(`Table '${table}': OK (Count: ${count})`);
      }
    } catch (err) {
      console.log(`Table '${table}': Unexpected error`);
    }
  }
}

testConnection();
