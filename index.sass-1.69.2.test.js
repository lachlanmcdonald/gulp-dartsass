const Vinyl = require('vinyl');
const fs = require('fs');
const path = require('path');
const sass = require('sass-1.69.2');
const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const tap = require('gulp-tap');
const { async, sync } = require('.');
const replaceExt = require('replace-ext');

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
 * Hastily decode the JSON of an embedded sourcemap within a buffer. Handles URI and Base64 encoding,
 * but otherwise this function is only intended for these tests and not a universal solution.
 *
 * @param {Buffer} buffer
 */
const extractSourceMap = buffer => {
	const sourceMapPattern = /(?<=sourceMappingURL=)(?<url>.*)(?=\s*\*\/)/i;
	const contents = buffer.toString('utf-8');
	const match = contents.match(sourceMapPattern);

	if (match) {
		const urlPattern = /(?:data:)([^;,]+)(;[^;,]+)*?(?<isBase64>;base64)?(?:,)(?<contents>.*)/;
		const urlMatch = match.groups.url.match(urlPattern);

		if (urlMatch) {
			let contents = urlMatch.groups.contents;

			if (urlMatch.groups.isBase64) {
				contents = Buffer.from(contents, 'base64').toString('utf-8');
			} else {
				contents = decodeURI(contents);
			}

			try {
				return JSON.parse(contents.trim());
			} catch (e) {
				console.warn(e);
				return null;
			}
		}
	}

	return null;
};

/**
 * Creates a new Vinyl file from `input.scss` in the provided directory,
 * then passes that to the plugin to be compiled. Results are compared
 * with `expected.css` from the provided directory.
 *
 * @param {(sass: any, options: any) => internal.Transform} compiler
 * @param {string} testDirectory
 * @param {sass.Options<"sync" | "async">} options
 * @returns {Promise<Vinyl>}
 */
const compileTestDirectory = (compiler, testDirectory, options = {}) => {
	const filePath = path.join(testDirectory, 'input.scss');

	const file = new Vinyl({
		cwd: __dirname,
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
					setTimeout(() => {
						resolve(url.startsWith('color:') ? new URL(url) : null);
					}, 500);
				});
			},
			/**
			 * @param {URL} url
			 * @returns {Promise<{ contents: string, syntax: string }>}
			 */
			load(url) {
				return new Promise(resolve => {
					setTimeout(() => {
						resolve({
							contents: `body { color: ${url.pathname}; }`,
							syntax: 'scss',
						});
					}, 500);
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


				stream.write(file);
				stream.end(() => {
					resolve(file);
				});
			});
		}).rejects.toThrow(/^expected/iu);
	});

	test("File's atimeMs, mtimeMs, and ctimeMs stats are updated", async () => {
		const testDirectory = path.join(TEST_DIR, 'imports');
		const testFile = path.join(testDirectory, 'input.scss');
		const stats = fs.statSync(testFile);

		const file = await compileTestDirectory(sync, testDirectory);

		expect(file.stat.atimeMs).toBeGreaterThan(stats.atimeMs);
		expect(file.stat.mtimeMs).toBeGreaterThan(stats.mtimeMs);
		expect(file.stat.ctimeMs).toBeGreaterThan(stats.ctimeMs);
	});

	describe('gulp', () => {
		const filePath = path.join(TEST_DIR, 'sourcemaps', 'input.scss');
		const outputPath = path.join(path.dirname(filePath), 'results');

		const trashResults = () => {
			fs.readdirSync(outputPath, 'utf-8').forEach(file => {
				if (['.css', '.map'].includes(path.extname(file))) {
					fs.unlinkSync(path.join(outputPath, file));
				}
			});
		};

		beforeAll(trashResults);
		afterEach(trashResults);

		test('Works with gulp-sourcemaps', () => {
			return new Promise((resolve, reject) => {
				gulp.src(filePath)
					.pipe(sourcemaps.init())
					.pipe(compiler(sass))
					.pipe(sourcemaps.write())
					.pipe(tap(file => {
						try {
							expect(file).toHaveProperty('sourceMap');
							expect(extractSourceMap(file.contents)).toMatchObject({
								file: replaceExt(path.basename(filePath), '.css'),
								names: [],
								sources: [
									/\/_imported.scss$/,
								],
							});
						} catch (e) {
							reject(e);
						}
					}))
					.on('finish', () => {
						resolve();
					});
			});
		});

		test('Works with internal inlined sourcemap support', async () => {
			await new Promise(resolve => {
				gulp.src(filePath, { sourcemaps: true })
					.pipe(compiler(sass))
					.pipe(gulp.dest(outputPath, {
						sourcemaps: true,
					}))
					.on('finish', () => {
						resolve();
					});
			});

			const outputFile = path.join(outputPath, 'input.css');
			const outputContents = fs.readFileSync(outputFile);

			expect(extractSourceMap(outputContents)).toMatchObject({
				file: path.basename(outputFile),
				names: [],
				sources: [
					/\/_imported.scss$/,
				],
			});
		});

		test('Works with internal external sourcemap support', async () => {
			await new Promise(resolve => {
				gulp.src(filePath, { sourcemaps: true })
					.pipe(compiler(sass))
					.pipe(gulp.dest(outputPath, {
						sourcemaps: '.',
					}))
					.on('finish', () => {
						resolve();
					});
			});

			const outputFile = path.join(outputPath, 'input.css');
			const outputContents = fs.readFileSync(outputFile, 'utf-8');

			expect(outputContents).toMatch(/sourceMappingURL=input\.css\.map/);
		});
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

describe('normalise()', () => {
	test('Trims', () => {
		const a = ' test\r\nline\r\n ';

		expect(normalise(a)).toBe('test\nline');
	});
});

describe('extractSourceMap()', () => {
	const INPUT = {
		version: 3,
		sourceRoot: '',
		sources: ['_imported.scss'],
		names: [],
		mappings: 'AAAA,KACC',
		file: 'expected.css',
	};

	const URL_ENCODED_INPUT = [
		'/*# sourceMappingURL=',
		'data:application/json,',
		encodeURI(JSON.stringify(INPUT)),
		' */',
	].join('');

	const BASE64_INPUT = [
		'/*# sourceMappingURL=',
		'data:application/json;base64,',
		Buffer.from(JSON.stringify(INPUT), 'utf-8').toString('base64'),
		' */',
	].join('');

	test('Extracts JSON from URL-encoded sourcemap', () => {
		const result = extractSourceMap(URL_ENCODED_INPUT);

		expect(result).not.toBeNull();
		expect(result).toMatchObject(INPUT);
	});

	test('Extracts JSON from base64 encoded sourcemap', () => {
		const result = extractSourceMap(BASE64_INPUT);

		expect(result).not.toBeNull();
		expect(result).toMatchObject(INPUT);
	});
});
