
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data, error } = await supabase
        .from('university_programs')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('Error fetching university_programs:', error);
    } else {
        console.log('Sample row from university_programs:', data[0]);
        console.log('Available columns:', Object.keys(data[0] || {}));
    }
}

checkColumns();
