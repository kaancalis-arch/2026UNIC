
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://qwualszqafxjorumgttv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3dWFsc3pxYWZ4am9ydW1ndHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDU5MjQsImV4cCI6MjA4OTMyMTkyNH0.cm5J9aQuUz-riX3vBpo-CNp0p5KSFOUT730gbZPXYHk";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    const { data, error } = await supabase
      .from('universities')
      .select(`
        *,
        university_programs (
          id,
          name,
          url,
          language,
          tuition_range,
          main_degree:programs!main_degree_id (name),
          main_degree2:programs!main_degree_2_id (name),
          main_degree3:programs!main_degree_3_id (name)
        )
      `)
      .order('name', { ascending: true });
    
    if (error) {
        console.error('Fetch universities failed:', error);
    } else {
        console.log('Success, data length:', data?.length);
    }
}

testQuery();
