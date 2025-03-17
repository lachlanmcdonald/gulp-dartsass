import path from 'node:path';
import { pathToFileURL } from 'node:url';
import PluginError from 'plugin-error';
import { Transform } from 'stream';
import replaceExtension from 'replace-ext';
import applySourceMap from 'vinyl-sourcemaps-apply';

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
 * @param {boolean} isAsync
 * @param {SassCompiler} sass
 * @param {Record<string, any>} options
 */
const gulpDartSass = (isAsync, sass, options) => {
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

	return new Transform({
		objectMode: true,
		transform(file, _encoding, callback) {
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

			const defaultOptions = {
				syntax: 'scss',
				url: pathToFileURL(file.path).toString(),
			};

			// Generate Source Maps
			defaultOptions.sourceMap = Boolean(file.sourceMap);

			// Update syntax to reflect the file-extension
			if (path.extname(file.path) === '.sass') {
				defaultOptions.syntax = 'indented';
			}

			if (isAsync) {
				return sass.compileStringAsync(file.contents.toString('utf-8'), {
					...defaultOptions,
					...options || {},
				}).then(result => {
					return handleResult(file, result, callback);
				}).catch(error => {
					return callback(new PluginError(PLUGIN_NAME, error));
				});
			} else {
				try {
					const result = sass.compileString(file.contents.toString('utf-8'), {
						...defaultOptions,
						...options || {},
					});

					return handleResult(file, result, callback);
				} catch (error) {
					return callback(new PluginError(PLUGIN_NAME, error));
				}
			}
		},
	});
};

/**
 * @param {SassCompiler} sass
 * @param {Record<string, any>} [options]
 */
export const sync = (sass, options) => {
	return gulpDartSass(false, sass, options);
};

/**
 * @param {SassCompiler} sass
 * @param {Record<string, any>} [options]
 */
export const async = (sass, options) => {
	return gulpDartSass(true, sass, options);
};
