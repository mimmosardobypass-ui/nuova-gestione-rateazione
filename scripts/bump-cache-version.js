#!/usr/bin/env node

/**
 * Automatically bump cache version when view/schema changes
 * Usage: npm run cache:bump [reason]
 */

import fs from 'fs';
import path from 'path';

const CACHE_FILE = 'src/constants/cache.ts';
const reason = process.argv[2] || 'Schema/mapping update';

function bumpCacheVersion() {
  try {
    const cachePath = path.resolve(CACHE_FILE);
    let content = fs.readFileSync(cachePath, 'utf8');
    
    // Extract current version
    const versionMatch = content.match(/RATEATIONS_CACHE_KEY = "rateations:list_ui:v(\d+)"/);
    if (!versionMatch) {
      console.error('❌ Could not find cache key version');
      process.exit(1);
    }
    
    const currentVersion = parseInt(versionMatch[1]);
    const newVersion = currentVersion + 1;
    
    // Update version
    content = content.replace(
      /RATEATIONS_CACHE_KEY = "rateations:list_ui:v\d+"/,
      `RATEATIONS_CACHE_KEY = "rateations:list_ui:v${newVersion}"`
    );
    
    // Update version history
    const today = new Date().toISOString().split('T')[0];
    content = content.replace(
      /\/\/ Version history:/,
      `// Version history:\n// v${newVersion}: ${reason} (${today})`
    );
    
    fs.writeFileSync(cachePath, content);
    
    console.log(`🚀 Cache version bumped: v${currentVersion} → v${newVersion}`);
    console.log(`📝 Reason: ${reason}`);
    console.log('⚠️  Remember to test with fresh data after deployment!');
    
  } catch (error) {
    console.error('❌ Failed to bump cache version:', error.message);
    process.exit(1);
  }
}

bumpCacheVersion();