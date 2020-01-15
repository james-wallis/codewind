const utils = require('./utils/sharedFunctions');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const Logger = require('./utils/Logger');
const fs = require('fs-extra');
const path = require('path');

const log = new Logger(__filename);
const extensionsDir = '/extensions';
const extensionsPattern = /^(\S+)-(\d+\.\d+\.\d+|latest)\.zip$/; // e.g. extension-name-0.0.1.zip
const odoExtensionName = "codewind-odo-extension";

const SUFFIX_OLD = '__old';

/**
 * Install (unzip) built-in extensions that are stored in /extensions to the
 * given target directory
 * 
 * @param {string} targetDir, the target directory to install extensions to 
 */
async function installBuiltInExtensions(targetDir) {

  // get the zips from the /extensions directory
  const entries = await fs.readdir(extensionsDir, { withFileTypes: true });

  for (let entry of entries) {
    
    let match;

    // look for files with names matching the expected pattern
    if (entry.isFile() && (match = extensionsPattern.exec(entry.name))) {
        
      const name = match[1];
      const version = match[2];

      if ((name == odoExtensionName) && (process.env.ON_OPENSHIFT != 'true')) {
        continue;
      }

      const source = path.join(extensionsDir, entry.name);
      const target = path.join(targetDir, name);
      const targetWithVersion = target + '-' + version;

      try {
        if (await prepForUnzip(target, version)) {
          await exec(`unzip ${source} -d ${targetDir}`);

          // top-level directory in zip will have the version suffix
          // rename to remove the version
          await fs.rename(targetWithVersion, target);
        }
      }
      catch (err) {
        log.warn(`Failed to install ${entry.name}`);
        log.warn(err);
      }
      finally {
        // to be safe, try to remove directory with version name if it still exist
        await utils.forceRemove(targetWithVersion);
      }
    }
  }
}

/**
 * Get the version of the given target extension.
 * 
 * @param {string} target extension location
 * @returns A version string, such as 0.0.1
 */
async function getVersion(target) {

  try {
    const result = await exec(`grep -P "^version: \\d+\\.\\d+\\.\\d+$" ${target}/codewind.yaml`);
    if (result.stdout)
      return result.stdout.substring(9).trimRight();
  }
  catch (err) {
    log.warn(err.message);
  }
  
  // couldn't figure out, return a default
  return '0.0.0';
}
  
/**
   * Performs a version check, returns true if version is newer than existingVersion.
   * 
   * @param {string} version The version to check
   * @param {string} existingVersion The existing version
   * @returns True if version is newer than existingVersion
   */
function isNewer(version, existingVersion) {
  
  const versions = version.split('.', 3);
  const existingVersions = existingVersion.split('.', 3);
  
  for (let i = 0; i < 3; i++) {
  
    const v = parseInt(versions[i]);
    const e = parseInt(existingVersions[i]);
  
    if (v != e)
      return v > e;
  }
  
  return false;
}
  
/**
   * Prepare the directory where an extension will be unzipped to. If directory
   * exists with the same name, it will be renamed by appending the "__old" suffix to it.
   * 
   * @param {string} target, the target directory to unzip to
   * @param {string} version, the version we are trying to unzip
   * @returns True if the install should proceed, false otherwise
   */
async function prepForUnzip(target, version) {
    
  if (await utils.fileExists(target)) {
    
    const existingVersion = await getVersion(target);
  
    if (!isNewer(version, existingVersion))
      return false;
  
    const targetOld = target + SUFFIX_OLD;
  
    // try to remove previous backup that may or may not exist before rename
    await utils.forceRemove(targetOld);
    await fs.rename(target, targetOld);
  }
  
  return true;
}

module.exports = {
  installBuiltInExtensions,
  SUFFIX_OLD
}