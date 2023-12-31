const PluginError = require('plugin-error');
const through2 = require('through2');
const replaceExtension = require('replace-ext');
const path = require('path');
const { pathToFileURL } = require('url');
const applySourceMap = require('vinyl-sourcemaps-apply');

const PLUGIN_NAME = 'gulp-dartsass';

/**
 * @typedef CompileResult
 * @property {string} css
 * @property {URL[]} loadedUrls
 * @property {unknown} [sourceMap]
 */

/**
 * @typedef SassCompiler
 * @property {(source: string, options?: Record<string, any>) => Promise<CompileResult>} compileStringAsync
 * @property {(source: string, options?: Record<string, any>) => CompileResult} compileString
 */

/**
 * @param {boolean} async
 * @param {SassCompiler} sass
 * @param {Record<string, any>} options
 */
const gulpDartSass = (async, sass, options) => {
	const handleResult = (file, result, callback) => {
		file.contents = Buffer.from(result.css, 'utf-8');
		file.path = replaceExtension(file.path, '.css');

		// Handle sourcemap
		if (file.sourceMap) {
			applySourceMap(file, {
				...result.sourceMap,
				file: 'input.css',
			});
		}

		// Update file times
		if (file.stat) {
			const now = Math.floor(new Date().getTime());

			file.stat.atimeMs = now;
			file.stat.mtimeMs = now;
			file.stat.ctimeMs = now;
		}

		return callback(null, file);
	};

	const transformer = through2.obj((file, _encoding, callback) => {
		// Ignore null files
		if (file.isNull()) {
			return callback(null, file);
		}

		// Streams are not supported
		if (file.isStream()) {
			return callback(new PluginError(PLUGIN_NAME, 'Streams not supported!'));
		}

		// Ignore files beginning with an underscore
		if (path.basename(file.path).startsWith('_')) {
			return callback();
		}

		// Ignore empty files
		if (file.contents.length === 0) {
			file.path = replaceExtension(file.path, '.css');
			return callback(null, file);
		}

		const sassOptions = {
			syntax: 'scss',
			url: pathToFileURL(file.path).toString(),
		};

		// Generate Source Maps
		sassOptions.sourceMap = Boolean(file.sourceMap);

		// Update syntax to reflect the file-extension
		if (path.extname(file.path) === '.sass') {
			sassOptions.syntax = 'indented';
		}

		if (async) {
			return sass.compileStringAsync(file.contents.toString('utf-8'), {
				...sassOptions,
				...options || {},
			}).then(result => {
				return handleResult(file, result, callback);
			}).catch(error => {
				return callback(new PluginError(PLUGIN_NAME, error));
			});
		} else {
			try {
				const result = sass.compileString(file.contents.toString('utf-8'), {
					...sassOptions,
					...options || {},
				});

				return handleResult(file, result, callback);
			} catch (error) {
				return callback(new PluginError(PLUGIN_NAME, error));
			}
		}
	});

	return transformer;
};

module.exports = {
	/**
	 * @param {SassCompiler} sass
	 * @param {Record<string, any>} [options]
	 * @returns
	 */
	sync(sass, options) {
		return gulpDartSass(false, sass, options);
	},
	/**
	 * @param {SassCompiler} sass
	 * @param {Record<string, any>} [options]
	 * @returns
	 */
	async(sass, options) {
		return gulpDartSass(true, sass, options);
	},
};
