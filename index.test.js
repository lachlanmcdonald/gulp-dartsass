const Vinyl = require('vinyl');
const fs = require('fs');
const path = require('path');
const sass = require('sass');
const { async, sync } = require('.');

const TEST_DIR = path.join(__dirname, 'tests');

/**
 * Normalises newlines and trims whitespace from the beginning and
 * end of the provided string or buffer.
 *
 * @param {string|Buffer} input
 */
const normalise = input => {
	return input.toString().replace(/[\r\n]+/gu, '\n').trim();
};

/**
 * Creates a new Vinyl file from `input.scss` in the provided directory,
 * then passes that to the plugin to be compiled. Results are compared
 * with `expected.css` from the provided directory.
 *
 * @param {(sass: any, options: any) => internal.Transform} compiler
 * @param {string} testDirectory
 * @param {sass.Options<"sync" | "async">} options
 */
const compileTestDirectory = (compiler, testDirectory, options = {}) => {
	const filePath = path.join(testDirectory, 'input.scss');

	const file = new Vinyl({
		cwd: TEST_DIR,
		base: testDirectory,
		path: filePath,
		contents: fs.readFileSync(filePath),
		stat: fs.statSync(filePath),
	});

	return new Promise((resolve, reject) => {
		const stream = compiler(sass, {
			style: 'compressed',
			...options,
		}).on('error', error => {
			reject(error);
		});

		// eslint-disable-next-line no-undefined
		stream.write(file);
		stream.end(() => {
			resolve(file);
		});
	});
};

const OPTS_SYNC_IMPORTS = {
	importers: [
		{
			/**
			 * @param {string} url
			 * @returns {URL|null}
			 */
			canonicalize(url) {
				return url.startsWith('color:') ? new URL(url) : null;
			},
			/**
			 * @param {URL} url
			 * @returns {Promise<{ contents: string, syntax: string }>}
			 */
			load(url) {
				return {
					contents: `body { color: ${url.pathname}; }`,
					syntax: 'scss',
				};
			},
		},
	],
};

const OPTS_ASYNC_IMPORTS = {
	importers: [
		{
			/**
			 * @param {string} url
			 * @returns {Promise<URL|null>}
			 */
			canonicalize(url) {
				return new Promise(resolve => {
					resolve(url.startsWith('color:') ? new URL(url) : null);
				});
			},
			/**
			 * @param {URL} url
			 * @returns {Promise<{ contents: string, syntax: string }>}
			 */
			load(url) {
				return new Promise(resolve => {
					resolve({
						contents: `body { color: ${url.pathname}; }`,
						syntax: 'scss',
					});
				});
			},
		},
	],
};

describe.each([
	['Async', async],
	['Sync', sync],
])(`%s compilation`, (_name, compiler) => {
	test.each([
		['Compiles @import directive', 'imports', {}],
		['Compiles empty input file', 'empty', {}],
		['Compiles @use directive', 'use', {}],
		['Compiles @use directive with named members', 'use-members', {}],
		['Compiles @use with @forward directives', 'forward', {}],
		['Compiles with custom synchronous importers', 'importers', OPTS_SYNC_IMPORTS],
	])('%s', async (_message, directoryName, options) => {
		const testDirectory = path.join(TEST_DIR, directoryName);
		const expected = normalise(fs.readFileSync(path.join(testDirectory, 'expected.css'), 'utf-8'));
		const file = await compileTestDirectory(compiler, testDirectory, options);

		expect(path.extname(file.path)).toBe('.css');
		expect(normalise(file.contents)).toBe(expected);
	});

	test('Fails on invalid SCSS', () => {
		const file = new Vinyl({
			cwd: TEST_DIR,
			base: TEST_DIR,
			path: path.join(__dirname, 'invalid.scss'),
			contents: Buffer.from('body { !background: red; }'),
		});

		expect(() => {
			return new Promise((resolve, reject) => {
				const stream = compiler(sass, {
					style: 'compressed',
				}).on('error', error => {
					reject(error);
				});

				// eslint-disable-next-line no-undefined
				stream.write(file);
				stream.end(() => {
					resolve(file);
				});
			});
		}).rejects.toThrow(/^expected/iu);
	});

	test('File\'s atimeMs, mtimeMs, and ctimeMs stats are updated', async () => {
		const testDirectory = path.join(TEST_DIR, 'imports');
		const testFile = path.join(testDirectory, 'input.scss');
		const stats = fs.statSync(testFile);

		const file = await compileTestDirectory(sync, testDirectory);

		expect(file.stat.atimeMs).toBeGreaterThan(stats.atimeMs);
		expect(file.stat.mtimeMs).toBeGreaterThan(stats.mtimeMs);
		expect(file.stat.ctimeMs).toBeGreaterThan(stats.ctimeMs);
	});
});

describe(`Async compilation`, () => {
	test('Compiles with custom async importers', async () => {
		const testDirectory = path.join(TEST_DIR, 'importers');
		const expected = normalise(fs.readFileSync(path.join(testDirectory, 'expected.css'), 'utf-8'));
		const file = await compileTestDirectory(async, testDirectory, OPTS_ASYNC_IMPORTS);

		expect(path.extname(file.path)).toBe('.css');
		expect(normalise(file.contents)).toBe(expected);
	});
});

describe(`Sync compilation`, () => {
	test('Cannot use async importers with sync compilation', () => {
		expect(() => {
			const testDirectory = path.join(TEST_DIR, 'importers');

			return compileTestDirectory(sync, testDirectory, OPTS_ASYNC_IMPORTS);
		}).rejects.toThrow(/canonicalize.*synchronous compile functions/iu);
	});
});
