import appc from 'node-appc';
import debug from 'debug';
import fs from 'fs';
import path from 'path';

const log = debug('androidlib:genymotion');

const platformPaths = {
	darwin: [
		'/Applications/Genymotion.app/Contents/MacOS',
		'~/Applications/Genymotion.app/Contents/MacOS'
	],
	linux: [
		'/opt',
		'/usr',
		'~'
	],
	win32: [
		'%ProgramFiles%\\Genymobile\\Genymotion',
		'%ProgramFiles%\\Genymotion',
		'%ProgramFiles(x86)%\\Genymobile\\Genymotion',
		'%ProgramFiles(x86)%\\Genymotion'
	]
};

const engine = new appc.detect.Engine({
	depth:     1,
	exe:       `genymotion${appc.subprocess.exe}`,
	multiple:  false,
	checkDir:  checkDir,
	paths:     platformPaths[process.platform]
});

/**
 * Resets the internal result cache. This is intended for testing purposes.
 */
export function resetCache() {
	appc.util.clearCache('androidlib:genymotion');
}

/**
 * Genymotion information object.
 */
export class Genymotion extends appc.gawk.GawkObject {
	constructor(dir) {
		if (typeof dir !== 'string' || !dir) {
			throw new TypeError('Expected directory to be a valid string');
		}

		dir = appc.path.expand(dir);
		if (!appc.fs.existsSync(dir)) {
			throw new Error('Directory does not exist');
		}

		const values = {
			path: dir,
			home: null,
			executables: {
				genymotion: path.join(dir, `genymotion${appc.subprocess.exe}`),
				player: process.platform === 'darwin'
					? path.join(dir, 'player.app', 'Contents', 'MacOS', 'player')
					: path.join(dir, `player${appc.subprocess.exe}`)
			}
		};

		if (!appc.fs.isFile(values.executables.genymotion) || !appc.fs.isFile(values.executables.player)) {
			throw new Error('Directory does not contain Genymotion');
		}

		const homeDirs = process.platform === 'win32'
			? [ '~/AppData/Local/Genymobile/Genymotion' ]
			: [ '~/.Genymobile/Genymotion', '~/.Genymotion' ];
		for (let homeDir of homeDirs) {
			if (appc.fs.isDir(homeDir = appc.path.expand(homeDir))) {
				values.home = homeDir;
				break;
			}
		}

		super(values);
	}
}

/**
 * Detects installed VirtualBox.
 *
 * @param {Object} [opts] - An object with various params.
 * @param {Boolean} [opts.force=false] - When true, bypasses cache and
 * re-detects the Android NDKs.
 * @param {Boolan} [opts.gawk] - If true, returns the raw internal GawkArray,
 * otherwise returns a JavaScript array.
 * @param {Array} [opts.paths] - One or more paths to known Android NDKs.
 * @returns {Promise} Resolves an array or GawkArray containing the values.
 */
export function detect(opts = {}) {
	return new Promise((resolve, reject) => {
		engine
			.detect(opts)
			.on('results', resolve)
			.on('error', reject);
	});
}

/**
 * Detects installed VirtualBox and watches for changes.
 *
 * @param {Object} [opts] - An object with various params.
 * @param {Boolean} [opts.force=false] - When true, bypasses cache and
 * re-detects the Android NDKs.
 * @param {Boolan} [opts.gawk] - If true, returns the raw internal GawkArray,
 * otherwise returns a JavaScript array.
 * @param {Array} [opts.paths] - One or more paths to known Android NDKs.
 * @returns {Handle}
 */
export function watch(opts = {}) {
	opts.watch = true;
	opts.redetect = true;
	return engine
		.detect(opts);
}

/**
 * Determines if the specified directory contains a Android SDK and if so,
 * returns the SDK info.
 *
 * @param {String} dir - The directory to check.
 * @returns {Promise}
 */
function checkDir(dir) {
	return Promise.resolve()
		.then(() => new Genymotion(dir))
		.catch(err => {
			log('checkDir()', err, dir);
			return Promise.resolve();
		});
}
