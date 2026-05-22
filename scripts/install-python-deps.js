import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

async function installDeps() {
  console.log('[Setup] Attempting to install Python dependencies for AI...');
  try {
    // Try pip3 first (common on Linux/Mac servers)
    await execPromise('pip3 install -r requirements.txt');
    console.log('[Setup] Python dependencies installed successfully using pip3.');
  } catch (err1) {
    try {
      // Fallback to pip (common on Windows)
      await execPromise('pip install -r requirements.txt');
      console.log('[Setup] Python dependencies installed successfully using pip.');
    } catch (err2) {
      console.warn('[Setup-Warning] Failed to automatically install Python dependencies.');
      console.warn('If you are on a live server, ensure Python is installed and buildpack is configured.');
      console.warn('Error details:', err2.message);
    }
  }
}

installDeps();
