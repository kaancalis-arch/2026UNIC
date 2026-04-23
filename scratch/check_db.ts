
import { createClient } from '@supabase/supabase-client';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking Categories...');
    const { data: cats } = await supabase.from('main_categories').select('*');
    console.log('Categories:', cats?.map(c => ({ id: c.id, name: c.name })));

    console.log('Checking Programs...');
    const { data: progs } = await supabase.from('programs').select('*');
    console.log('Programs:', progs?.map(p => ({ id: p.id, name: p.name })));

    console.log('Checking Junctions...');
    const { data: junctions } = await supabase.from('program_category_junction').select('*');
    console.log('Junctions:', junctions);
}

checkData();
