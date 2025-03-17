import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as sass from 'sass';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

const TEST_DIRECTORIES = [
	'empty',
	'forward',
	'imports',
	'use',
	'use-members',
];

TEST_DIRECTORIES.forEach(testDirectory => {
	const stat = fs.statSync(path.join(CURRENT_DIR, testDirectory));

	if (stat.isDirectory()) {
		const inputSassPath = path.join(CURRENT_DIR, testDirectory, 'input.sass');
		const inputScssPath = path.join(CURRENT_DIR, testDirectory, 'input.scss');
		const expectedFilePath = path.join(CURRENT_DIR, testDirectory, 'expected.css');

		let contents = null;
		let syntax = null;
		let url = null;

		console.log(`${ chalk.underline(testDirectory) }`);

		if (fs.existsSync(inputSassPath)) {
			url = pathToFileURL(inputSassPath);
			contents = fs.readFileSync(inputSassPath, 'utf-8');
			syntax = 'intended';
		} else if (fs.existsSync(inputScssPath)) {
			url = pathToFileURL(inputScssPath);
			contents = fs.readFileSync(inputScssPath, 'utf-8');
			syntax = 'scss';
		}

		if (typeof contents === 'string') {
			try {
				const result = sass.compileString(contents, {
					style: 'compressed',
					syntax,
					url,
				});

				fs.writeFileSync(expectedFilePath, result.css.trim() + '\n', 'utf-8');

				console.log(chalk.green('Written: ' + expectedFilePath));
			} catch (e) {
				console.error(e);
			}
		} else {
			console.log(chalk.yellow('Skipping; No input file.'));
		}
	}
});
