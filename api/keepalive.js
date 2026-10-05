import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mmvxgenubpvzopshuvpl.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdnhnZW51YnB2em9wc2h1dnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMzYxODAsImV4cCI6MjEwNTYxMjE4MH0.eQuUMJzYTbOP1oSfaAbMCfPIwb9GwWC7kxTB0gFQXEI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();
  try {
    // 執行真實 SQL 查詢保活 Supabase 免費專案，防止 7 天閒置自動休眠
    const { data, error } = await supabase
      .from('rooms')
      .select('id, status')
      .limit(1);

    const elapsedMs = Date.now() - startTime;

    if (error) {
      const isPaused = /fetch failed|ENOTFOUND|ECONNREFUSED|503/i.test(error.message || '');
      return res.status(isPaused ? 503 : 500).json({
        status: isPaused ? 'paused' : 'error',
        project: 'classqna',
        database: 'supabase',
        elapsedMs,
        error: error.message,
        hint: isPaused ? 'Supabase 專案處於休眠狀態，請至 Supabase 控制台點擊 Restore project 喚醒' : undefined,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      status: 'healthy',
      project: 'classqna',
      database: 'supabase_active',
      elapsedMs,
      message: 'ClassQnA Supabase keepalive heartbeat successful.',
      data,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const elapsedMs = Date.now() - startTime;
    const isPaused = /fetch failed|ENOTFOUND|ECONNREFUSED/i.test(err.message || '');
    return res.status(isPaused ? 503 : 500).json({
      status: isPaused ? 'paused' : 'error',
      project: 'classqna',
      database: 'supabase',
      elapsedMs,
      error: err.message,
      hint: isPaused ? 'Supabase 專案處於休眠狀態，請至 Supabase 控制台點擊 Restore project 喚醒' : undefined,
      timestamp: new Date().toISOString()
    });
  }
}
