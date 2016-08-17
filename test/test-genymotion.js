import androidlib from '../src/index';
import appc from 'node-appc';
import del from 'del';
import fs from 'fs-extra';
import path from 'path';
import temp from 'temp';

temp.track();

const genymotion = androidlib.genymotion;

// in our tests, we need to wipe the PATH environment variable so that JDKs
// other than our mocks are found, but on Windows, we need to leave
// C:\Windows\System32 in the path so that we can query the Windows registry
const tempPATH = process.platform !== 'win32' ? '' : (function () {
	const windowsDir = appc.path.expand('%SystemRoot%');
	return process.env.PATH
		.split(path.delimiter)
		.filter(p => p.indexOf(windowsDir) === 0)
		.join(path.delimiter);
}());

describe('genymotion', () => {
	beforeEach(function () {
		this.PATH        = process.env.PATH;
		process.env.PATH = '';
		process.env.NODE_APPC_SKIP_GLOBAL_SEARCH_PATHS = 1;
		process.env.NODE_APPC_SKIP_GLOBAL_ENVIRONMENT_PATHS = 1;
		process.env.NODE_APPC_SKIP_GLOBAL_EXECUTABLE_PATH = 1;
	});

	afterEach(function () {
		process.env.PATH = this.PATH;
		delete process.env.NODE_APPC_SKIP_GLOBAL_SEARCH_PATHS;
		delete process.env.NODE_APPC_SKIP_GLOBAL_ENVIRONMENT_PATHS;
		delete process.env.NODE_APPC_SKIP_GLOBAL_EXECUTABLE_PATH;
		genymotion.resetCache(true);
	});

	describe('Genymotion', () => {
		it('should error if directory is invalid', () => {
			expect(() => {
				new genymotion.Genymotion();
			}).to.throw(TypeError, 'Expected directory to be a valid string');

			expect(() => {
				new genymotion.Genymotion(123);
			}).to.throw(TypeError, 'Expected directory to be a valid string');

			expect(() => {
				new genymotion.Genymotion('');
			}).to.throw(TypeError, 'Expected directory to be a valid string');
		});

		it('should error if directory does not exist', () => {
			expect(() => {
				new genymotion.Genymotion(path.join(__dirname, 'mocks', 'doesnotexist'));
			}).to.throw(Error, 'Directory does not exist');
		});

		it('should error if directory does not contain Genymotion', () => {
			expect(() => {
				new genymotion.Genymotion(path.join(__dirname, 'mocks', 'empty'));
			}).to.throw(Error, 'Directory does not contain Genymotion');
		});

		//
	});

	describe('detect()', () => {
		it('should detect Genymotion using defaults', function (done) {
			this.timeout(10000);
			this.slow(5000);

			process.env.PATH = this.PATH;
			delete process.env.NODE_APPC_SKIP_GLOBAL_SEARCH_PATHS;
			delete process.env.NODE_APPC_SKIP_GLOBAL_ENVIRONMENT_PATHS;
			delete process.env.NODE_APPC_SKIP_GLOBAL_EXECUTABLE_PATH;

			genymotion.detect()
				.then(result => {
					if (typeof result !== 'undefined') {
						validateResult(result);
					}
					done();
				})
				.catch(done);
		});

		it('should detect mock Genymotion', function (done) {
			this.timeout(10000);
			this.slow(5000);

			const mockDir = path.resolve('./test/mocks/genymotion');

			const player = process.platform === 'darwin'
				? path.join(mockDir, 'player.app', 'Contents', 'MacOS', 'player')
				: path.join(mockDir, `player${appc.subprocess.exe}`);

			genymotion.detect({ paths: mockDir })
				.then(result => {
					validateResult(result);
					expect(result.path).to.equal(mockDir);
					expect(result.executables).to.deep.equal({
						genymotion: path.join(mockDir, `genymotion${appc.subprocess.exe}`),
						player
					});
					done();
				})
				.catch(done);
		});

		it('should not detect anything in empty directory', function (done) {
			this.timeout(10000);
			this.slow(5000);

			genymotion.detect({ paths: path.resolve('./test/mocks/empty') })
				.then(result => {
					expect(result).to.be.undefined;
					done();
				})
				.catch(done);
		});
	});

	describe('watch()', () => {
		beforeEach(function () {
			this.cleanup            = [];
			this.watcher            = null;
		});

		afterEach(function () {
			temp.cleanupSync();
			this.watcher && this.watcher.stop();
			del.sync(this.cleanup, { force: true });
		});

		it('should watch using defaults', function (done) {
			this.timeout(10000);
			this.slow(6000);

			this.watcher = genymotion
				.watch()
				.on('results', result => {
					if (typeof result !== 'undefined') {
						validateResult(result);
					}
				})
				.on('ready', () => {
					done();
				})
				.on('error', done);
		});

		it('should watch directory for Genymotion to be added', function (done) {
			this.timeout(10000);
			this.slow(5000);

			let count = 0;
			const src = path.resolve('./test/mocks/genymotion');
			const dest = temp.path('androidlib-test-');
			this.cleanup.push(dest);

			const player = process.platform === 'darwin'
				? path.join(dest, 'player.app', 'Contents', 'MacOS', 'player')
				: path.join(dest, `player${appc.subprocess.exe}`);

			this.watcher = genymotion
				.watch({ paths: dest })
				.on('results', result => {
					count++;
					if (count === 1) {
						validateResult(result);
						expect(result.path).to.equal(dest);
						expect(result.executables).to.deep.equal({
							genymotion: path.join(dest, `genymotion${appc.subprocess.exe}`),
							player
						});
						setTimeout(() => del([dest], { force: true }), 250);

					} else if (count === 2) {
						expect(result).to.equal.undefined;
						this.watcher.stop();
						done();
					}
				})
				.on('ready', () => {
					fs.copySync(src, dest);
				})
				.on('error', done);
		});
	});
});

function validateResult(result) {
	expect(result).to.be.an.Object;
	expect(result).to.have.keys('path', 'home', 'executables');

	expect(result.path).to.be.a.String;
	expect(appc.fs.isDir(result.path)).to.be.true;

	expect(result.home).to.be.a.String;
	if (result.home !== null) {
		expect(appc.fs.isDir(result.home)).to.be.true;
	}

	expect(result.executables).to.be.an.Object;
	expect(result.executables).to.have.keys('genymotion', 'player');
	expect(result.executables.genymotion).to.be.a.String;
	expect(appc.fs.isFile(result.executables.genymotion)).to.be.true;
	expect(result.executables.player).to.be.a.String;
	expect(appc.fs.isFile(result.executables.player)).to.be.true;
}
