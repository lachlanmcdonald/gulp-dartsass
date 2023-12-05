const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const TEST_SCRIPT_PATH = path.join(__dirname, '..', 'index.test.js');
const PACKAGE_NAME = 'sass';
const METADATA_URL = `https://registry.npmjs.org/${PACKAGE_NAME}`;
const DATA_URL = `https://api.npmjs.org/versions/${PACKAGE_NAME}/last-week`;

// Remove previous test files
const TEST_FILE_PATTERN = /index\.sass-\d+\.\d+\.\d+\.test\.js/;

fs.readdirSync(path.join(__dirname, '..'), 'utf-8').forEach(file => {
	if (TEST_FILE_PATTERN.test(file)) {
		fs.unlinkSync(path.join(__dirname, '..', file));
	}
});

// Fetch file
const fetch = url => {
	return new Promise((resolve, reject) => {
		https.get(url, response => {
			let data = '';

			response.on('data', chunk => {
				data += chunk;
			});

			response.on('end', () => {
				resolve(JSON.parse(data));
			});
		}).on('error', err => {
			reject(err);
		});
	});
};

Promise.all([
	fetch(METADATA_URL),
	fetch(DATA_URL),
]).then(([metadata, downloadData]) => {
	// Get most recent versions
	const recentVersions = Object.keys(metadata.versions).slice(-5);

	// Get the top downloaded versions this week
	// const topVersions = Object.entries(downloadData.downloads).sort((a, b) => {
	// 	return b[1] - a[1];
	// }).slice(0, 10).map(x => x[0]);

	// Target versions
	const targetVersions = new Set([
		...recentVersions,
		// ...topVersions,
	]);

	// Parse package.json and remove the existing sass dependencies
	const package = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));

	Object.keys(package.devDependencies).forEach(key => {
		if (/^sass-.+$/.test(key)) {
			delete package.devDependencies[key];
		}
	});

	// Avoid installing the existing sass version twice
	targetVersions.delete(package.devDependencies.sass.replace('^', ''));

	// Add dependencies for new versions
	targetVersions.forEach(version => {
		package.devDependencies[`sass-${ version }`] = `npm:sass@${ version }`;
	});

	// Update package.json
	fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(package, null, 2), 'utf-8');

	// Read test script
	// /* const pattern = /\/\/ DO NOT UPDATE BELOW.*\/\/ DO NOT UPDATE ABOVE[^\n]+/gis;
	const testScript = fs.readFileSync(TEST_SCRIPT_PATH, 'utf-8');

	targetVersions.forEach(version => {
		const contents = testScript.replace("const sass = require('sass');", `const sass = require('sass-${ version }');`);

		fs.writeFileSync(path.join(path.dirname(TEST_SCRIPT_PATH), `index.sass-${ version }.test.js`), contents, 'utf-8');
	});
});
