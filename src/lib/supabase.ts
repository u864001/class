import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mmvxgenubpvzopshuvpl.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdnhnZW51YnB2em9wc2h1dnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMzYxODAsImV4cCI6MjEwNTYxMjE4MH0.eQuUMJzYTbOP1oSfaAbMCfPIwb9GwWC7kxTB0gFQXEI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});
