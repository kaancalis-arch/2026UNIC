
import { supabase } from './src/services/supabaseClient';

async function checkColumns() {
  if (!supabase) {
    console.log("Supabase not initialized");
    return;
  }

  const { data, error } = await supabase
    .from('student_profiles')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log("Columns found:", Object.keys(data[0]));
  } else {
      // Try to get structure via RPC or just assume if no data
      console.log("No data found to check columns. If you just added them, make sure they exist in Supabase Dashboard.");
  }
}

checkColumns();
