const fs = require('fs');

function loadEnv(path = '.env') {
  try {
    // Read the .env file
    const envContent = fs.readFileSync(path, 'utf8');
    
    // Split into lines and filter out comments and empty lines
    const envLines = envContent
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'));
    
    // Parse each line into key-value pairs
    const envVars = {};
    envLines.forEach(line => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      
      // Add to process.env and return object
      process.env[key.trim()] = cleanValue;
      envVars[key.trim()] = cleanValue;
    });
    
    return envVars;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`No ${path} file found`);
      return {};
    }
    throw error;
  }
}

module.exports = loadEnv;