const path = require('path');
const sass = require('sass');
const fs = require('fs');
const { pathToFileURL } = require('url');
const chalk = require('chalk');

const TEST_DIRECTORIES = [
	'empty',
	'forward',
	'imports',
	'use',
	'use-members',
];

TEST_DIRECTORIES.forEach(testDirectory => {
	const stat = fs.statSync(path.join(__dirname, testDirectory));

	if (stat.isDirectory()) {
		const inputSassPath = path.join(__dirname, testDirectory, 'input.sass');
		const inputScssPath = path.join(__dirname, testDirectory, 'input.scss');
		const expectedFilePath = path.join(__dirname, testDirectory, 'expected.css');

		let contents = null;
		let syntax = null;
		let url = null;

		console.log(`${chalk.underline(testDirectory)}`);

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
